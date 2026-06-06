/**
 * Snap resolver — pure geometry, no rendering.
 *
 * A piece in group G snaps to a grid-adjacent piece in group H when
 * |G.translation − H.translation| ≤ snapTolerance.
 *
 * Why translation-delta works:
 *   piece.worldPos = piece.correctPos + group.translation
 *   Two pieces are in their correct relative position iff
 *   G.translation === H.translation (the correctPos deltas cancel).
 *   So the snap condition reduces to |ΔT| ≤ tolerance.
 */

/** Minimum pixel gap at zoom=1 that triggers a snap. */
export const SNAP_PX = 22;

export interface SnapGroup {
  root: number;
  translation: { x: number; y: number };
  /** Number of pieces in this group (used to determine which group survives). */
  size: number;
}

export interface SnapCandidate {
  /** Piece in group A that detected the snap */
  pieceA: number;
  /** Its grid-adjacent neighbour in group B */
  pieceB: number;
  rootA: number;
  rootB: number;
  /** G_A.translation − G_B.translation at the moment of snap */
  delta: { x: number; y: number };
  /** Root of the group that absorbs the other (larger group) */
  survivingRoot: number;
  /** Root of the group that gets absorbed */
  absorbedRoot: number;
}

/**
 * Scan all piece-pairs that are grid-adjacent but in different groups.
 * Return the SnapCandidate with the smallest |delta|, or null if none qualifies.
 *
 * @param pieceCoords   At minimum: index, row, col for each piece.
 * @param pieceToRoot   union-find.find(pieceIndex) — maps any piece to its group root.
 * @param groups        root → SnapGroup (only roots are keys).
 * @param rows          Grid row count.
 * @param cols          Grid column count.
 * @param zoom          Current camera zoom level (≥ 1 = no zoom-out).
 */
export function resolveSnap(
  pieceCoords: ReadonlyArray<{ index: number; row: number; col: number }>,
  pieceToRoot: (index: number) => number,
  groups: ReadonlyMap<number, SnapGroup>,
  rows: number,
  cols: number,
  zoom: number,
): SnapCandidate | null {
  const tolerance = SNAP_PX / zoom;
  const toleranceSq = tolerance * tolerance;

  let best: SnapCandidate | null = null;
  let bestDistSq = Infinity;

  // 4-directional neighbour offsets: [Δrow, Δcol]
  const dirs: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  for (const piece of pieceCoords) {
    const rootA = pieceToRoot(piece.index);
    const gA = groups.get(rootA);
    if (!gA) continue;

    for (const [dr, dc] of dirs) {
      const nr = piece.row + dr;
      const nc = piece.col + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

      const nbIndex = nr * cols + nc;
      const rootB = pieceToRoot(nbIndex);
      if (rootB === rootA) continue; // same group

      const gB = groups.get(rootB);
      if (!gB) continue;

      const dx = gA.translation.x - gB.translation.x;
      const dy = gA.translation.y - gB.translation.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= toleranceSq && distSq < bestDistSq) {
        bestDistSq = distSq;
        const survivingRoot = gA.size >= gB.size ? rootA : rootB;
        const absorbedRoot = survivingRoot === rootA ? rootB : rootA;
        best = {
          pieceA: piece.index,
          pieceB: nbIndex,
          rootA,
          rootB,
          delta: { x: dx, y: dy },
          survivingRoot,
          absorbedRoot,
        };
      }
    }
  }

  return best;
}
