import { isSolved } from '../solve/completion';
import { PieceUnionFind } from '../solve/unionFind';

describe('isSolved', () => {
  it('returns false when no pieces have been merged', () => {
    const uf = new PieceUnionFind(10);
    expect(isSolved(uf)).toBe(false);
  });

  it('returns false while multiple groups remain', () => {
    const uf = new PieceUnionFind(6);
    uf.union(0, 1);
    uf.union(2, 3);
    // groups: {0,1}, {2,3}, {4}, {5} → 4 groups
    expect(isSolved(uf)).toBe(false);
  });

  it('returns false with exactly 2 groups', () => {
    const uf = new PieceUnionFind(4);
    uf.union(0, 1);
    uf.union(0, 2); // now {0,1,2} and {3}
    expect(isSolved(uf)).toBe(false);
  });

  it('returns true when all pieces are merged into one group', () => {
    const uf = new PieceUnionFind(6);
    for (let i = 1; i < 6; i++) uf.union(0, i);
    expect(isSolved(uf)).toBe(true);
  });

  it('returns true immediately for a 1-piece puzzle', () => {
    const uf = new PieceUnionFind(1);
    expect(isSolved(uf)).toBe(true);
  });

  it('transitions from false to true on the final union', () => {
    const uf = new PieceUnionFind(3);
    uf.union(0, 1);
    expect(isSolved(uf)).toBe(false);
    uf.union(0, 2);
    expect(isSolved(uf)).toBe(true);
  });
});
