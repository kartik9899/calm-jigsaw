import { generate } from '../generation/generator';
import { EdgeType } from '../types';

function inverseType(t: EdgeType): EdgeType {
  if (t === 'knob') return 'blank';
  if (t === 'blank') return 'knob';
  return 'flat';
}

describe('generation — interlock', () => {
  const puzzle = generate({ rows: 5, cols: 7, seed: 1234, imageAspect: 1.6 });
  const byIndex = new Map(puzzle.pieces.map((p) => [p.index, p]));

  it('every interior horizontal edge interlocks (type)', () => {
    for (const piece of puzzle.pieces) {
      if (piece.row === puzzle.rows - 1) continue; // bottom border
      const below = byIndex.get((piece.row + 1) * puzzle.cols + piece.col)!;
      expect(below.edges.top.type).toBe(inverseType(piece.edges.bottom.type));
    }
  });

  it('every interior vertical edge interlocks (type)', () => {
    for (const piece of puzzle.pieces) {
      if (piece.col === puzzle.cols - 1) continue; // right border
      const right = byIndex.get(piece.row * puzzle.cols + piece.col + 1)!;
      expect(right.edges.left.type).toBe(inverseType(piece.edges.right.type));
    }
  });

  it('shared horizontal edges have equal size', () => {
    for (const piece of puzzle.pieces) {
      if (piece.row === puzzle.rows - 1) continue;
      const below = byIndex.get((piece.row + 1) * puzzle.cols + piece.col)!;
      expect(below.edges.top.size).toBeCloseTo(piece.edges.bottom.size);
    }
  });

  it('shared vertical edges have equal size', () => {
    for (const piece of puzzle.pieces) {
      if (piece.col === puzzle.cols - 1) continue;
      const right = byIndex.get(piece.row * puzzle.cols + piece.col + 1)!;
      expect(right.edges.left.size).toBeCloseTo(piece.edges.right.size);
    }
  });

  it('shared horizontal edges have negated jitter (canonical world position)', () => {
    for (const piece of puzzle.pieces) {
      if (piece.row === puzzle.rows - 1) continue;
      if (piece.edges.bottom.type === 'flat') continue;
      const below = byIndex.get((piece.row + 1) * puzzle.cols + piece.col)!;
      expect(below.edges.top.jitter).toBeCloseTo(-piece.edges.bottom.jitter);
    }
  });

  it('shared vertical edges have negated jitter', () => {
    for (const piece of puzzle.pieces) {
      if (piece.col === puzzle.cols - 1) continue;
      if (piece.edges.right.type === 'flat') continue;
      const right = byIndex.get(piece.row * puzzle.cols + piece.col + 1)!;
      expect(right.edges.left.jitter).toBeCloseTo(-piece.edges.right.jitter);
    }
  });

  it('border edges are always flat', () => {
    for (const piece of puzzle.pieces) {
      if (piece.row === 0) expect(piece.edges.top.type).toBe('flat');
      if (piece.row === puzzle.rows - 1) expect(piece.edges.bottom.type).toBe('flat');
      if (piece.col === 0) expect(piece.edges.left.type).toBe('flat');
      if (piece.col === puzzle.cols - 1) expect(piece.edges.right.type).toBe('flat');
    }
  });
});
