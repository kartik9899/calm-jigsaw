/**
 * Union-Find (Disjoint Set Union) for jigsaw piece groups.
 *
 * Uses path compression (find) and union by size for near-O(α) amortised ops.
 */
export class PieceUnionFind {
  private parent: number[];
  private sz: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.sz = new Array<number>(n).fill(1);
  }

  /** Find root of the group containing x (with path compression). */
  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]); // path compression
    }
    return this.parent[x];
  }

  /**
   * Merge the groups containing x and y.
   * @returns true if they were in different groups (merge happened), false if already connected.
   */
  union(x: number, y: number): boolean {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx === ry) return false;

    // Union by size: attach smaller tree under larger
    if (this.sz[rx] >= this.sz[ry]) {
      this.parent[ry] = rx;
      this.sz[rx] += this.sz[ry];
    } else {
      this.parent[rx] = ry;
      this.sz[ry] += this.sz[rx];
    }
    return true;
  }

  /** Whether x and y belong to the same group. */
  connected(x: number, y: number): boolean {
    return this.find(x) === this.find(y);
  }

  /** Total number of distinct groups. */
  groupCount(): number {
    let count = 0;
    for (let i = 0; i < this.parent.length; i++) {
      if (this.find(i) === i) count++;
    }
    return count;
  }

  /** Size of the group containing x. */
  groupSize(x: number): number {
    return this.sz[this.find(x)];
  }

  // ── Serialisation ─────────────────────────────────────────────────────────

  /** Snapshot of the parent array (for persistence). */
  getParent(): number[] {
    // Return after a full path-compression pass so roots are canonical
    for (let i = 0; i < this.parent.length; i++) this.find(i);
    return [...this.parent];
  }

  /** Snapshot of the size array (for persistence). */
  getSize(): number[] {
    return [...this.sz];
  }

  /** Restore from serialised arrays. */
  static fromArrays(parent: number[], size: number[]): PieceUnionFind {
    const uf = new PieceUnionFind(parent.length);
    uf.parent = [...parent];
    uf.sz = [...size];
    return uf;
  }
}
