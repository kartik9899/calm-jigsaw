import { GeneratedPuzzle, PathCmd, PieceSpec } from '../types';
import { edgePathCmds } from './edgeCurve';
import { buildEdgeGrid, getPieceEdges } from './edgeGrid';
import { mulberry32 } from './prng';

export interface GenerateInput {
  rows: number;
  cols: number;
  seed: number;
  /** imageWidth / imageHeight */
  imageAspect: number;
}

/**
 * Generate a complete, deterministic puzzle layout.
 *
 * Pure function — identical inputs always produce deep-equal output.
 *
 * World space is normalised so the full image occupies [0, 1000] × [0, 1000/imageAspect].
 * Piece paths are in PIECE-LOCAL coordinates (origin = cell top-left corner).
 */
export function generate(input: GenerateInput): GeneratedPuzzle {
  const { rows, cols, seed, imageAspect } = input;

  const prng = mulberry32(seed);

  // Normalised canvas dimensions (arbitrary scale — 1000 units wide)
  const imageW = 1000;
  const imageH = imageW / imageAspect;
  const cellW = imageW / cols;
  const cellH = imageH / rows;
  const cellMinDim = Math.min(cellW, cellH);

  // Maximum tab protrusion beyond a cell boundary
  const tabOverhang = 0.22 * cellMinDim;

  const edgeGrid = buildEdgeGrid(rows, cols, prng);
  const pieces: PieceSpec[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const index = r * cols + c;
      const edges = getPieceEdges(r, c, rows, cols, edgeGrid);

      // Build path in piece-local space (origin at cell top-left).
      // Winding order: clockwise (Y increases downward).
      const cmds: PathCmd[] = [{ cmd: 'moveTo', x: 0, y: 0 }];

      // Top  (0,0) → (cellW,0)  outward normal: up  (0,−1)
      cmds.push(
        ...edgePathCmds({ x: 0, y: 0 }, { x: cellW, y: 0 }, { x: 0, y: -1 }, edges.top, cellMinDim),
      );

      // Right  (cellW,0) → (cellW,cellH)  outward normal: right  (1,0)
      cmds.push(
        ...edgePathCmds(
          { x: cellW, y: 0 },
          { x: cellW, y: cellH },
          { x: 1, y: 0 },
          edges.right,
          cellMinDim,
        ),
      );

      // Bottom  (cellW,cellH) → (0,cellH)  outward normal: down  (0,1)
      cmds.push(
        ...edgePathCmds(
          { x: cellW, y: cellH },
          { x: 0, y: cellH },
          { x: 0, y: 1 },
          edges.bottom,
          cellMinDim,
        ),
      );

      // Left  (0,cellH) → (0,0)  outward normal: left  (−1,0)
      cmds.push(
        ...edgePathCmds(
          { x: 0, y: cellH },
          { x: 0, y: 0 },
          { x: -1, y: 0 },
          edges.left,
          cellMinDim,
        ),
      );

      cmds.push({ cmd: 'close' });

      pieces.push({
        index,
        row: r,
        col: c,
        edges,
        correctPos: { x: c * cellW, y: r * cellH },
        pathCommands: cmds,
      });
    }
  }

  return { pieces, rows, cols, cellW, cellH, tabOverhang, seed, imageAspect };
}
