import type { Transforms3d } from '@shopify/react-native-skia';
import {
  Canvas,
  Fill,
  Group,
  Image as SkiaImage,
  Path,
  Skia,
  useImage,
} from '@shopify/react-native-skia';
import type { SkImage } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  runOnJS,
  runOnUI,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { PieceSpec } from '../core/types';
import { isSolved } from '../core/solve/completion';
import type { SnapCandidate, SnapGroup } from '../core/solve/snapResolver';
import { resolveSnap } from '../core/solve/snapResolver';
import { useCamera } from './camera';
import { buildAabbTable } from './hitTest';
import type { AabbEntry } from './hitTest';
import { usePerfStats } from './perf';
import { rasterizeAll } from './pieceTexture';
import { usePuzzleSession } from './usePuzzleSession';
import type { PuzzleSessionParams } from './usePuzzleSession';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JigsawCanvasProps extends PuzzleSessionParams {
  /** Metro require() result (number) or URL string for the puzzle photograph. */
  imageSource: number | string;
  /** Show FPS + memory overlay for GATE-001 performance measurement. */
  showPerfOverlay?: boolean;
  /**
   * Called once when the last two groups snap together and the puzzle is solved.
   * Fired synchronously on the JS thread after the snap merge is committed.
   * Will not be called more than once per mount.
   */
  onComplete?: () => void;
}

interface GroupData {
  pieces: PieceSpec[];
  /** Min x relative to group translation, tab overhang included. */
  localMinX: number;
  localMaxX: number;
  localMinY: number;
  localMaxY: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_SCALE = 0.05;
const MAX_SCALE = 5;

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Full-screen jigsaw puzzle canvas.
 *
 * Coordinate contract:
 *   piece.worldPos = piece.correctPos + group.translation
 *   (translation = 0 → piece renders at solved position)
 *
 * Render the parent view with flex:1 so the canvas fills it.
 * Use key={puzzleId} on the parent so this component remounts on new games.
 */
export function JigsawCanvas({
  imageSource,
  showPerfOverlay = false,
  onComplete,
  ...sessionParams
}: JigsawCanvasProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { puzzle, solveState, uf, moveGroup, applySnap, relocateGroups, generationMs } =
    usePuzzleSession(sessionParams);
  const camera = useCamera(screenW, screenH, sessionParams.imageAspect);
  const image = useImage(imageSource);

  // ── Rasterisation state ────────────────────────────────────────────────────

  const [textures, setTextures] = useState<Map<number, SkImage>>(new Map());
  const [rasterPct, setRasterPct] = useState(0);
  const [rasterMs, setRasterMs] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  // ── Solve-state ref (always current, avoids stale closure in endDrag) ──────

  const solveStateRef = useRef(solveState);
  solveStateRef.current = solveState;

  // ── Drag state (React) ─────────────────────────────────────────────────────

  // Which group root is currently being dragged (null = no active drag).
  // Changing this triggers one re-render at drag-start and one at drag-end.
  const [draggedRoot, setDraggedRoot] = useState<number | null>(null);

  // ── Tray / ghost-outline UX (M3-06) ────────────────────────────────────────

  // Faint reference grid at the solved layout — toggleable orientation aid.
  const [showGhostOutline, setShowGhostOutline] = useState(false);

  // isDraggingPiece declared here (before usePerfStats) so it can be passed
  // as a SharedValue for drag-FPS bucketing in the gate instrumentation.
  const isDraggingPiece = useSharedValue(false);

  // ── Perf / gate instrumentation ───────────────────────────────────────────

  const perfStats = usePerfStats(showPerfOverlay, isDraggingPiece, camera.scale);

  // ── Remaining drag state (Reanimated) ─────────────────────────────────────

  // AABB lookup for UI-thread hit-testing. Rebuilt when solve-state changes.
  const aabbTable = useSharedValue<AabbEntry[]>([]);

  // Preserves the dragged root across the gesture lifecycle (onBegin → onEnd).
  const dragRootForEnd = useSharedValue(-1);

  // Group translation at drag-start (world units).
  const dragBaseTransX = useSharedValue(0);
  const dragBaseTransY = useSharedValue(0);

  // Accumulated drag delta since drag-start (world units).
  const dragOffsetX = useSharedValue(0);
  const dragOffsetY = useSharedValue(0);

  // Animated group transform for the drag overlay — updated on the UI thread.
  const dragGroupTransform = useDerivedValue<Transforms3d>(() => [
    { translateX: dragBaseTransX.value + dragOffsetX.value },
    { translateY: dragBaseTransY.value + dragOffsetY.value },
  ]);

  // ── Pinch state ────────────────────────────────────────────────────────────

  const scaleAtStart = useSharedValue(1);
  const txAtStart = useSharedValue(0);
  const tyAtStart = useSharedValue(0);
  const focalXAtStart = useSharedValue(0);
  const focalYAtStart = useSharedValue(0);

  // ── Effects ───────────────────────────────────────────────────────────────

  // Rasterize all pieces once the source image is loaded (chunked, 8/tick).
  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    setReady(false);
    setRasterPct(0);
    setRasterMs(null);
    const t0 = performance.now();
    rasterizeAll(puzzle.pieces, puzzle, image, 8, (done, total) => {
      if (!cancelled) setRasterPct(Math.round((done / total) * 100));
    }).then((map) => {
      if (!cancelled) {
        setRasterMs(performance.now() - t0);
        setTextures(map);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [image, puzzle]);

  // Rebuild AABB table whenever solve-state changes (drag-drop or snap).
  useEffect(() => {
    aabbTable.value = buildAabbTable(puzzle, solveState, uf);
  }, [puzzle, solveState, uf]); // eslint-disable-line

  // ── Drag callbacks (JS thread) ─────────────────────────────────────────────

  const startDrag = useCallback((root: number) => {
    setDraggedRoot(root);
  }, []);

  // "Gather" (M3-06 UX-1 fix): collect every still-unconnected single piece
  // into a tidy cluster centred on the current viewport, so a piece that
  // scattered far away never gets lost on a large board. Multi-piece groups
  // are left alone — they're the player's in-progress work, not "lost" pieces.
  const gatherSingles = useCallback(() => {
    const roots = Object.keys(solveStateRef.current.groups).map(Number);
    const singles = roots.filter((root) => uf.groupSize(root) === 1);
    if (singles.length === 0) return;

    // Viewport centre in world units — the cluster forms wherever the player
    // is currently looking, not at some fixed/offscreen board location.
    const centerX = (screenW / 2 - camera.translateX.value) / camera.scale.value;
    const centerY = (screenH / 2 - camera.translateY.value) / camera.scale.value;

    // Roughly square grid; spacing leaves room for tab overhang so neighbours
    // in the cluster don't visually overlap.
    const cell = Math.max(puzzle.cellW, puzzle.cellH) * 1.3;
    const perRow = Math.max(1, Math.ceil(Math.sqrt(singles.length)));
    const rowCount = Math.ceil(singles.length / perRow);

    const updates = new Map<number, { x: number; y: number }>();
    singles.forEach((root, i) => {
      const piece = puzzle.pieces[root];
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const targetX = centerX + (col - (perRow - 1) / 2) * cell;
      const targetY = centerY + (row - (rowCount - 1) / 2) * cell;
      // worldPos = correctPos + translation → translation = target − correctPos
      updates.set(root, { x: targetX - piece.correctPos.x, y: targetY - piece.correctPos.y });
    });

    relocateGroups(updates);
  }, [puzzle, uf, camera, screenW, screenH, relocateGroups]);

  // Called after the settle animation (or immediately for the surviving-root case).
  const handleSnapMerge = useCallback(
    (candidate: SnapCandidate) => {
      applySnap(candidate);
      setDraggedRoot(null);
      if (isSolved(uf)) {
        onComplete?.();
      }
    },
    [applySnap, uf, onComplete],
  );

  const endDrag = useCallback(
    (root: number, dx: number, dy: number) => {
      const ss = solveStateRef.current;

      // Final world-space translation of the dropped group.
      const newTransX = dragBaseTransX.value + dx;
      const newTransY = dragBaseTransY.value + dy;

      // Build snap-groups map with the dragged root at its final position.
      const snapGroups = new Map<number, SnapGroup>();
      for (const [key, g] of Object.entries(ss.groups)) {
        const r = Number(key);
        snapGroups.set(r, {
          root: r,
          translation: r === root ? { x: newTransX, y: newTransY } : g.translation,
          size: uf.groupSize(r),
        });
      }

      const candidate = resolveSnap(
        puzzle.pieces,
        (idx) => uf.find(idx),
        snapGroups,
        puzzle.rows,
        puzzle.cols,
        camera.scale.value,
      );

      if (!candidate) {
        // No snap — commit drag position and clear overlay.
        moveGroup(root, dx, dy);
        setDraggedRoot(null);
        return;
      }

      if (root === candidate.absorbedRoot) {
        // Dragged group is absorbed → animate to the surviving group's translation.
        const survivingG = ss.groups[candidate.survivingRoot];
        const finalOffsetX = (survivingG?.translation.x ?? newTransX) - dragBaseTransX.value;
        const finalOffsetY = (survivingG?.translation.y ?? newTransY) - dragBaseTransY.value;
        runOnUI(() => {
          'worklet';
          dragOffsetX.value = withTiming(finalOffsetX, { duration: 140 }, (finished) => {
            'worklet';
            if (finished) runOnJS(handleSnapMerge)(candidate);
          });
          dragOffsetY.value = withTiming(finalOffsetY, { duration: 140 });
        })();
      } else {
        // Dragged group survives → commit its position then merge immediately.
        moveGroup(root, dx, dy);
        handleSnapMerge(candidate);
      }
    },
    [moveGroup, handleSnapMerge, puzzle, uf, camera.scale, dragBaseTransX, dragBaseTransY, dragOffsetX, dragOffsetY], // eslint-disable-line
  );

  // ── Computed ──────────────────────────────────────────────────────────────

  // True once every piece belongs to one group — hides in-canvas chrome the
  // same way the parent's CompletionOverlay takes over the rest of the screen.
  const puzzleSolved = isSolved(uf);

  // Any unconnected single pieces left to gather? Drives the toolbar button's
  // visibility — nothing to do once every piece has found a neighbour.
  const hasSingles = useMemo(() => {
    for (const root of Object.keys(solveState.groups)) {
      if (uf.groupSize(Number(root)) === 1) return true;
    }
    return false;
  }, [solveState.groups, uf]);

  // Faint reference grid at the solved layout (world-space, translation = 0):
  // one Path with every cell boundary, stroked once instead of rows×cols rects.
  const ghostGridPath = useMemo(() => {
    const path = Skia.Path.Make();
    const w = puzzle.cols * puzzle.cellW;
    const h = puzzle.rows * puzzle.cellH;
    for (let c = 0; c <= puzzle.cols; c++) {
      const x = c * puzzle.cellW;
      path.moveTo(x, 0);
      path.lineTo(x, h);
    }
    for (let r = 0; r <= puzzle.rows; r++) {
      const y = r * puzzle.cellH;
      path.moveTo(0, y);
      path.lineTo(w, y);
    }
    return path;
  }, [puzzle]);
  const ghostStrokeWidth = Math.min(puzzle.cellW, puzzle.cellH) * 0.012;

  // Piece lists and local AABBs per group root.
  // Recomputes after snaps because solveState changes (uf already mutated by then).
  const groupPieceMap = useMemo(() => {
    const map = new Map<number, GroupData>();
    for (const piece of puzzle.pieces) {
      const root = uf.find(piece.index);
      const existing = map.get(root);
      const minX = piece.correctPos.x - puzzle.tabOverhang;
      const maxX = piece.correctPos.x + puzzle.cellW + puzzle.tabOverhang;
      const minY = piece.correctPos.y - puzzle.tabOverhang;
      const maxY = piece.correctPos.y + puzzle.cellH + puzzle.tabOverhang;
      if (existing) {
        existing.pieces.push(piece);
        existing.localMinX = Math.min(existing.localMinX, minX);
        existing.localMaxX = Math.max(existing.localMaxX, maxX);
        existing.localMinY = Math.min(existing.localMinY, minY);
        existing.localMaxY = Math.max(existing.localMaxY, maxY);
      } else {
        map.set(root, {
          pieces: [piece],
          localMinX: minX,
          localMaxX: maxX,
          localMinY: minY,
          localMaxY: maxY,
        });
      }
    }
    return map;
  }, [puzzle, solveState, uf]); // eslint-disable-line

  // Dragged root goes last so it renders on top.
  const sortedRoots = useMemo(() => {
    const roots = Object.keys(solveState.groups).map(Number);
    if (draggedRoot === null) return roots;
    return [...roots.filter((r) => r !== draggedRoot), draggedRoot];
  }, [solveState.groups, draggedRoot]);

  // Viewport snapshot (camera shared-values intentionally omitted from deps —
  // they don't trigger React re-renders; culling refreshes on state/size change).
  const viewportBounds = useMemo(() => {
    const tx = camera.translateX.value;
    const ty = camera.translateY.value;
    const s = camera.scale.value;
    const margin = Math.max(puzzle.cellW, puzzle.cellH);
    return {
      minX: (0 - tx) / s - margin,
      maxX: (screenW - tx) / s + margin,
      minY: (0 - ty) / s - margin,
      maxY: (screenH - ty) / s + margin,
    };
  }, [puzzle.cellW, puzzle.cellH, screenW, screenH]); // eslint-disable-line

  // Groups whose world AABB intersects the viewport.
  const visibleRoots = useMemo(() => {
    const vp = viewportBounds;
    return sortedRoots.filter((root) => {
      const g = solveState.groups[root];
      if (!g) return false;
      const data = groupPieceMap.get(root);
      if (!data) return false;
      const worldMinX = data.localMinX + g.translation.x;
      const worldMaxX = data.localMaxX + g.translation.x;
      const worldMinY = data.localMinY + g.translation.y;
      const worldMaxY = data.localMaxY + g.translation.y;
      return (
        worldMaxX > vp.minX && worldMinX < vp.maxX && worldMaxY > vp.minY && worldMinY < vp.maxY
      );
    });
  }, [sortedRoots, solveState.groups, groupPieceMap, viewportBounds]);

  // Texture tile dimensions — constant once puzzle is generated.
  const texW = puzzle.cellW + 2 * puzzle.tabOverhang;
  const texH = puzzle.cellH + 2 * puzzle.tabOverhang;

  // Drag overlay data (null = no active drag).
  const dragData = draggedRoot !== null ? (groupPieceMap.get(draggedRoot) ?? null) : null;

  // ── Gestures ──────────────────────────────────────────────────────────────

  // Single-finger: board pan OR piece-group drag based on UI-thread AABB hit test.
  const pan = Gesture.Pan()
    .maxPointers(1)
    .onBegin((e) => {
      'worklet';
      const tx = camera.translateX.value;
      const ty = camera.translateY.value;
      const s = camera.scale.value;
      const wx = (e.x - tx) / s;
      const wy = (e.y - ty) / s;

      const table = aabbTable.value;
      let hitRoot = -1;
      let hitTransX = 0;
      let hitTransY = 0;
      // Reverse iteration → last AABB entry wins (approximates top z-order).
      for (let i = table.length - 1; i >= 0; i--) {
        const entry = table[i];
        if (
          entry.root >= 0 &&
          wx >= entry.minX &&
          wx <= entry.maxX &&
          wy >= entry.minY &&
          wy <= entry.maxY
        ) {
          hitRoot = entry.root;
          hitTransX = entry.transX;
          hitTransY = entry.transY;
          break;
        }
      }

      if (hitRoot >= 0) {
        isDraggingPiece.value = true;
        dragRootForEnd.value = hitRoot;
        dragBaseTransX.value = hitTransX;
        dragBaseTransY.value = hitTransY;
        dragOffsetX.value = 0;
        dragOffsetY.value = 0;
        runOnJS(startDrag)(hitRoot);
      } else {
        isDraggingPiece.value = false;
      }
    })
    .onChange((e) => {
      'worklet';
      if (isDraggingPiece.value) {
        // Divide by scale: screen-pixel delta → world units.
        dragOffsetX.value += e.changeX / camera.scale.value;
        dragOffsetY.value += e.changeY / camera.scale.value;
      } else {
        camera.translateX.value += e.changeX;
        camera.translateY.value += e.changeY;
      }
    })
    .onEnd(() => {
      'worklet';
      if (isDraggingPiece.value) {
        isDraggingPiece.value = false;
        runOnJS(endDrag)(dragRootForEnd.value, dragOffsetX.value, dragOffsetY.value);
      }
    });

  // Two-finger pinch-zoom with implicit two-finger pan.
  const pinch = Gesture.Pinch()
    .onBegin((e) => {
      'worklet';
      scaleAtStart.value = camera.scale.value;
      txAtStart.value = camera.translateX.value;
      tyAtStart.value = camera.translateY.value;
      focalXAtStart.value = e.focalX;
      focalYAtStart.value = e.focalY;
    })
    .onUpdate((e) => {
      'worklet';
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleAtStart.value * e.scale));
      // World point under the initial focal must stay under the live focal.
      const fwx = (focalXAtStart.value - txAtStart.value) / scaleAtStart.value;
      const fwy = (focalYAtStart.value - tyAtStart.value) / scaleAtStart.value;
      camera.scale.value = newScale;
      camera.translateX.value = e.focalX - fwx * newScale;
      camera.translateY.value = e.focalY - fwy * newScale;
    });

  const gesture = Gesture.Simultaneous(pan, pinch);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1 }}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill color="#F0EDE8" />
          {ready && (
            <Group transform={camera.transform}>
              {/* Ghost outline (M3-06): faint reference grid at the solved
                  layout — drawn first so every piece renders on top of it. */}
              {showGhostOutline && (
                <Path
                  path={ghostGridPath}
                  style="stroke"
                  strokeWidth={ghostStrokeWidth}
                  color="#5C524733"
                />
              )}

              {/* Main layer: all visible groups in z-order. The dragged group
                  is rendered with opacity=0 while the overlay shows it on top. */}
              {visibleRoots.map((root) => {
                const g = solveState.groups[root];
                const data = groupPieceMap.get(root);
                if (!g || !data) return null;
                const isDragged = root === draggedRoot;
                return (
                  <Group
                    key={root}
                    transform={[{ translateX: g.translation.x }, { translateY: g.translation.y }]}
                    opacity={isDragged ? 0 : 1}
                  >
                    {data.pieces.map((piece) => {
                      const tex = textures.get(piece.index);
                      if (!tex) return null;
                      return (
                        <SkiaImage
                          key={piece.index}
                          image={tex}
                          x={piece.correctPos.x - puzzle.tabOverhang}
                          y={piece.correctPos.y - puzzle.tabOverhang}
                          width={texW}
                          height={texH}
                          fit="fill"
                        />
                      );
                    })}
                  </Group>
                );
              })}

              {/* Drag overlay: the active group with an animated Reanimated transform.
                  The <Group transform> updates at 60 fps on the UI thread. */}
              {dragData !== null && (
                <Group transform={dragGroupTransform}>
                  {dragData.pieces.map((piece) => {
                    const tex = textures.get(piece.index);
                    if (!tex) return null;
                    return (
                      <SkiaImage
                        key={piece.index}
                        image={tex}
                        x={piece.correctPos.x - puzzle.tabOverhang}
                        y={piece.correctPos.y - puzzle.tabOverhang}
                        width={texW}
                        height={texH}
                        fit="fill"
                      />
                    );
                  })}
                </Group>
              )}
            </Group>
          )}
        </Canvas>

        {!ready && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <Text style={styles.loadingText}>
              {image ? `Preparing pieces… ${rasterPct}%` : 'Loading image…'}
            </Text>
          </View>
        )}

        {/* Tray toolbar (M3-06): ghost-outline toggle + gather action.
            Hidden once solved — the parent's completion panel owns that moment. */}
        {ready && !puzzleSolved && (
          <View style={styles.toolbar} pointerEvents="box-none">
            <Pressable
              style={[styles.toolbarButton, showGhostOutline && styles.toolbarButtonActive]}
              onPress={() => setShowGhostOutline((v) => !v)}
            >
              <Text
                style={[
                  styles.toolbarButtonLabel,
                  showGhostOutline && styles.toolbarButtonLabelActive,
                ]}
              >
                Outline
              </Text>
            </Pressable>
            {hasSingles && (
              <Pressable style={styles.toolbarButton} onPress={gatherSingles}>
                <Text style={styles.toolbarButtonLabel}>Gather pieces</Text>
              </Pressable>
            )}
          </View>
        )}

        {showPerfOverlay && (
          <View style={styles.perfOverlay}>
            {/* Live metrics */}
            <Text style={styles.perfHeader}>GATE-001</Text>
            <Text style={styles.perfText}>{`FPS  ${perfStats.fps}`}</Text>
            <Text style={styles.perfText}>
              {`MEM  ${perfStats.memoryMB ?? '—'}MB  Peak ${perfStats.peakMemoryMB ?? '—'}MB`}
            </Text>
            <Text style={styles.perfText}>{`Gen  ${generationMs.toFixed(1)}ms`}</Text>
            <Text style={styles.perfText}>
              {rasterMs !== null
                ? `Rast ${(rasterMs / 1000).toFixed(2)}s`
                : ready
                  ? 'Rast —'
                  : `Rast ${rasterPct}%…`}
            </Text>
            <Text style={styles.perfText}>
              {`Drag n=${perfStats.dragSampleCount}  ZOut n=${perfStats.zoomedOutSampleCount}`}
            </Text>
            {/* Tap to print full report with percentiles to Metro / ADB logcat */}
            <Pressable
              style={styles.perfButton}
              onPress={() => perfStats.printReport(generationMs, rasterMs)}
            >
              <Text style={styles.perfButtonText}>LOG REPORT</Text>
            </Pressable>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7FA0',
    fontWeight: '500',
  },
  toolbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 40,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  toolbarButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#FAF9F7CC',
  },
  toolbarButtonActive: {
    backgroundColor: '#6B7FA0',
  },
  toolbarButtonLabel: {
    fontSize: 14,
    color: '#6B7FA0',
    fontWeight: '500',
  },
  toolbarButtonLabelActive: {
    color: '#FFFFFF',
  },
  perfOverlay: {
    position: 'absolute',
    top: 48,
    right: 12,
    backgroundColor: '#000000CC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 200,
  },
  perfHeader: {
    fontSize: 10,
    color: '#FFFFFF88',
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginBottom: 4,
  },
  perfText: {
    fontSize: 12,
    color: '#00FF88',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  perfButton: {
    marginTop: 6,
    backgroundColor: '#00FF8833',
    borderRadius: 4,
    paddingVertical: 4,
    alignItems: 'center',
  },
  perfButtonText: {
    fontSize: 11,
    color: '#00FF88',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
});
