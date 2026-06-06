import { PieceUnionFind } from './unionFind';

/**
 * A puzzle is solved when every piece belongs to a single group.
 */
export function isSolved(uf: PieceUnionFind): boolean {
  return uf.groupCount() === 1;
}
