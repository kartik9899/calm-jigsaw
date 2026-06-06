import { EdgeSpec, EdgeType } from '../types';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface EdgeGrid {
  /**
   * hEdge[r][c] is the PHYSICAL shared edge between piece(r,c)'s BOTTOM and
   * piece(r+1,c)'s TOP.  Exists for r ∈ [0, rows−2], c ∈ [0, cols−1].
   *
   * Convention: the stored EdgeSpec represents the edge from piece(r,c)'s
   * perspective (its BOTTOM), so a knob points downward into piece(r+1,c).
   */
  hEdge: EdgeSpec[][];
  /**
   * vEdge[r][c] is the PHYSICAL shared edge between piece(r,c)'s RIGHT and
   * piece(r,c+1)'s LEFT.  Exists for r ∈ [0, rows−1], c ∈ [0, cols−2].
   *
   * Convention: a knob points rightward into piece(r,c+1).
   */
  vEdge: EdgeSpec[][];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flat(): EdgeSpec {
  return { type: 'flat', jitter: 0, size: 0 };
}

function randomEdge(prng: () => number): EdgeSpec {
  const type: EdgeType = prng() < 0.5 ? 'knob' : 'blank';
  // Jitter: −1..1, per EdgeSpec definition. edgeCurve multiplies by 0.15,
  // giving a maximum lateral shift of ±15 % of edge length from the midpoint.
  const jitter = prng() * 2 - 1;
  // Tab height as a fraction of the cell's shorter side
  const size = 0.18 + prng() * 0.04; // 0.18 … 0.22
  return { type, jitter, size };
}

/**
 * Produce the inverse of an edge so the two pieces that share it interlock.
 *
 * • type:   knob ↔ blank (flat stays flat)
 * • jitter: negated so the tab centre lands at the same world-space x/y
 *           when both pieces traverse the shared edge in opposite directions.
 * • size:   unchanged.
 */
export function invertEdge(edge: EdgeSpec): EdgeSpec {
  if (edge.type === 'flat') return flat();
  return {
    type: edge.type === 'knob' ? 'blank' : 'knob',
    jitter: -edge.jitter,
    size: edge.size,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Build the complete edge grid for a rows×cols puzzle using the given PRNG. */
export function buildEdgeGrid(rows: number, cols: number, prng: () => number): EdgeGrid {
  // Horizontal edges (between row r and r+1)
  const hEdge: EdgeSpec[][] = [];
  for (let r = 0; r < rows - 1; r++) {
    hEdge[r] = [];
    for (let c = 0; c < cols; c++) {
      hEdge[r][c] = randomEdge(prng);
    }
  }

  // Vertical edges (between col c and c+1)
  const vEdge: EdgeSpec[][] = [];
  for (let r = 0; r < rows; r++) {
    vEdge[r] = [];
    for (let c = 0; c < cols - 1; c++) {
      vEdge[r][c] = randomEdge(prng);
    }
  }

  return { hEdge, vEdge };
}

/**
 * Return the four edges for piece at (row, col), applying invertEdge where
 * needed so that neighbouring pieces interlock correctly.
 */
export function getPieceEdges(
  row: number,
  col: number,
  rows: number,
  cols: number,
  grid: EdgeGrid,
): { top: EdgeSpec; right: EdgeSpec; bottom: EdgeSpec; left: EdgeSpec } {
  // top: shared with piece above.  hEdge[row-1][col] is stored from the piece
  //      above's perspective (its bottom = knob pointing down), so for the
  //      current piece the top is the inverse.
  const top = row === 0 ? flat() : invertEdge(grid.hEdge[row - 1][col]);

  // right: stored from THIS piece's perspective (knob pointing right).
  const right = col === cols - 1 ? flat() : grid.vEdge[row][col];

  // bottom: stored from THIS piece's perspective (knob pointing down).
  const bottom = row === rows - 1 ? flat() : grid.hEdge[row][col];

  // left: shared with piece to the left.  vEdge[row][col-1] is stored from
  //       the left piece's perspective (knob pointing right), so this piece's
  //       left is the inverse.
  const left = col === 0 ? flat() : invertEdge(grid.vEdge[row][col - 1]);

  return { top, right, bottom, left };
}
