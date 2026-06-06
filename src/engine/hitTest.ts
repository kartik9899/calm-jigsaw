import type { PieceUnionFind } from '../core/solve/unionFind';
import type { GeneratedPuzzle, SolveState } from '../core/types';

// ── Types ─────────────────────────────────────────────────────────────────────

/** One entry per piece, stored in a Reanimated SharedValue for UI-thread hit-testing. */
export interface AabbEntry {
  /** World-space left edge (tab overhang included). */
  minX: number;
  /** World-space top edge (tab overhang included). */
  minY: number;
  /** World-space right edge (tab overhang included). */
  maxX: number;
  /** World-space bottom edge (tab overhang included). */
  maxY: number;
  /** Group root index, or -1 for an inactive entry. */
  root: number;
  /** Group translation.x at the time the table was built. */
  transX: number;
  /** Group translation.y at the time the table was built. */
  transY: number;
}

// ── Functions ─────────────────────────────────────────────────────────────────

/**
 * Build an AABB table for every piece from the current solve state.
 *
 * Store the result in a Reanimated SharedValue so gesture handlers can
 * hit-test on the UI thread without a runOnJS round-trip.
 * Rebuild whenever solveState.groups changes (drag-drop or snap).
 */
export function buildAabbTable(
  puzzle: GeneratedPuzzle,
  solveState: SolveState,
  uf: PieceUnionFind,
): AabbEntry[] {
  return puzzle.pieces.map((piece) => {
    const root = uf.find(piece.index);
    const g = solveState.groups[root];
    if (!g) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, root: -1, transX: 0, transY: 0 };
    }
    const wx = piece.correctPos.x + g.translation.x;
    const wy = piece.correctPos.y + g.translation.y;
    return {
      minX: wx - puzzle.tabOverhang,
      minY: wy - puzzle.tabOverhang,
      maxX: wx + puzzle.cellW + puzzle.tabOverhang,
      maxY: wy + puzzle.cellH + puzzle.tabOverhang,
      root,
      transX: g.translation.x,
      transY: g.translation.y,
    };
  });
}
