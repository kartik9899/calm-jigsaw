// ─── Edge ────────────────────────────────────────────────────────────────────

export type EdgeType = 'flat' | 'knob' | 'blank';

export interface EdgeSpec {
  type: EdgeType;
  /** Lateral offset of tab centre along the edge, −1..1 fraction of edge length */
  jitter: number;
  /** Tab height as a fraction of the cell's shorter dimension, ~0.18..0.22 */
  size: number;
}

// ─── Path commands (pure data — NOT Skia objects) ────────────────────────────

export type PathCmd =
  | { cmd: 'moveTo'; x: number; y: number }
  | { cmd: 'lineTo'; x: number; y: number }
  | { cmd: 'cubicTo'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { cmd: 'close' };

// ─── Piece ───────────────────────────────────────────────────────────────────

export interface PieceEdges {
  top: EdgeSpec;
  right: EdgeSpec;
  bottom: EdgeSpec;
  left: EdgeSpec;
}

export interface PieceSpec {
  index: number;
  row: number;
  col: number;
  edges: PieceEdges;
  /** Top-left corner of this cell in normalised world space (origin = top-left of image) */
  correctPos: { x: number; y: number };
  /** Closed piece outline in piece-local coordinates (origin = cell top-left). Pure data. */
  pathCommands: PathCmd[];
}

// ─── Puzzle ──────────────────────────────────────────────────────────────────

export interface GeneratedPuzzle {
  pieces: PieceSpec[];
  rows: number;
  cols: number;
  /** Width of one cell in normalised units */
  cellW: number;
  /** Height of one cell in normalised units */
  cellH: number;
  /** Extra units a tab extends beyond its cell boundary */
  tabOverhang: number;
  seed: number;
  imageAspect: number;
}

/** The three valid piece-count targets. 350 is the hard maximum for MVP. */
export type Difficulty = 24 | 96 | 350;

// ─── Solve state ─────────────────────────────────────────────────────────────

export interface GroupState {
  /** Index of the root piece (smallest index in the group by convention) */
  root: number;
  /** Current world-space offset applied to every piece in this group */
  translation: { x: number; y: number };
  /** Always 0 for MVP — rotation deferred post-MVP */
  rotationRad: number;
}

export interface SolveState {
  puzzleId: string;
  rows: number;
  cols: number;
  seed: number;
  imageAspect: number;
  /**
   * Maps each group's ROOT piece index → GroupState.
   * To find a piece's group: `groups[unionFind.find(pieceIndex)]`.
   */
  groups: Record<number, GroupState>;
  /** Union-find parent array (length = rows × cols). Restored via PieceUnionFind.fromArrays. */
  unionParent: number[];
  /** Union-find size array (same length). */
  unionSize: number[];
  elapsedMs: number;
  hintsUsed: number;
}
