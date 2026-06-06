import { PieceUnionFind } from '../solve/unionFind';

// ── Brute-force reference (BFS) ───────────────────────────────────────────────

function bfsConnected(adj: Map<number, number[]>, n: number, a: number, b: number): boolean {
  const visited = new Set<number>();
  const queue = [a];
  visited.add(a);
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node === b) return true;
    for (const nb of adj.get(node) ?? []) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  return false;
}

function bfsGroupCount(adj: Map<number, number[]>, n: number): number {
  const visited = new Set<number>();
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (!visited.has(i)) {
      count++;
      const queue = [i];
      visited.add(i);
      while (queue.length > 0) {
        const node = queue.shift()!;
        for (const nb of adj.get(node) ?? []) {
          if (!visited.has(nb)) {
            visited.add(nb);
            queue.push(nb);
          }
        }
      }
    }
  }
  return count;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PieceUnionFind', () => {
  it('starts with n distinct groups', () => {
    expect(new PieceUnionFind(10).groupCount()).toBe(10);
  });

  it('union reduces group count by one for a new pair', () => {
    const uf = new PieceUnionFind(5);
    expect(uf.union(0, 1)).toBe(true); // merged
    expect(uf.groupCount()).toBe(4);
    expect(uf.union(0, 1)).toBe(false); // already connected
    expect(uf.groupCount()).toBe(4);
  });

  it('connected returns true for merged pieces', () => {
    const uf = new PieceUnionFind(6);
    uf.union(0, 1);
    uf.union(1, 2);
    expect(uf.connected(0, 2)).toBe(true);
    expect(uf.connected(0, 3)).toBe(false);
  });

  it('groupCount equals n after zero unions', () => {
    const uf = new PieceUnionFind(100);
    expect(uf.groupCount()).toBe(100);
  });

  it('groupCount equals 1 after unioning all pieces', () => {
    const n = 20;
    const uf = new PieceUnionFind(n);
    for (let i = 1; i < n; i++) uf.union(0, i);
    expect(uf.groupCount()).toBe(1);
  });

  // ── Fuzz: compare against BFS reference ─────────────────────────────────

  it('fuzz: matches BFS for random union sequences', () => {
    const n = 30;
    const ROUNDS = 50;
    // Deterministic pseudo-random sequence
    let rng = 17;
    const nextRng = () => {
      rng = (rng * 1664525 + 1013904223) & 0xffff_ffff;
      return Math.abs(rng) % n;
    };

    const uf = new PieceUnionFind(n);
    const adj = new Map<number, number[]>();
    for (let i = 0; i < n; i++) adj.set(i, []);

    for (let round = 0; round < ROUNDS; round++) {
      const a = nextRng();
      const b = nextRng();
      if (a === b) continue;

      uf.union(a, b);
      adj.get(a)!.push(b);
      adj.get(b)!.push(a);

      // Verify connected() matches BFS
      const qa = nextRng();
      const qb = nextRng();
      expect(uf.connected(qa, qb)).toBe(bfsConnected(adj, n, qa, qb));
    }

    // Verify groupCount matches BFS
    expect(uf.groupCount()).toBe(bfsGroupCount(adj, n));
  });

  // ── Serialisation round-trip ─────────────────────────────────────────────

  it('fromArrays restores find/connected/groupCount', () => {
    const uf = new PieceUnionFind(8);
    uf.union(0, 1);
    uf.union(2, 3);
    uf.union(4, 5);

    const restored = PieceUnionFind.fromArrays(uf.getParent(), uf.getSize());
    expect(restored.connected(0, 1)).toBe(true);
    expect(restored.connected(2, 3)).toBe(true);
    expect(restored.connected(0, 2)).toBe(false);
    expect(restored.groupCount()).toBe(uf.groupCount());
  });
});

// ── groupSize ─────────────────────────────────────────────────────────────────

describe('PieceUnionFind — groupSize', () => {
  it('singleton groups each return size 1', () => {
    const uf = new PieceUnionFind(5);
    expect(uf.groupSize(0)).toBe(1);
    expect(uf.groupSize(2)).toBe(1);
    expect(uf.groupSize(4)).toBe(1);
  });

  it('merged pair returns size 2 for both members', () => {
    const uf = new PieceUnionFind(5);
    uf.union(0, 1);
    expect(uf.groupSize(0)).toBe(2);
    expect(uf.groupSize(1)).toBe(2); // same group as 0
    expect(uf.groupSize(2)).toBe(1); // untouched
  });

  it('sequential unions accumulate size correctly', () => {
    const uf = new PieceUnionFind(6);
    uf.union(0, 1); // {0,1}=2, rest=1
    uf.union(0, 2); // {0,1,2}=3
    uf.union(0, 3); // {0,1,2,3}=4
    expect(uf.groupSize(0)).toBe(4);
    expect(uf.groupSize(1)).toBe(4);
    expect(uf.groupSize(3)).toBe(4);
    expect(uf.groupSize(4)).toBe(1);
    expect(uf.groupSize(5)).toBe(1);
  });

  it('merging two groups adds their sizes', () => {
    const uf = new PieceUnionFind(6);
    uf.union(0, 1); // {0,1}=2
    uf.union(2, 3); // {2,3}=2
    uf.union(0, 2); // {0,1,2,3}=4
    expect(uf.groupSize(0)).toBe(4);
    expect(uf.groupSize(1)).toBe(4);
    expect(uf.groupSize(2)).toBe(4);
    expect(uf.groupSize(3)).toBe(4);
  });

  it('fromArrays round-trip preserves group sizes', () => {
    const uf = new PieceUnionFind(8);
    uf.union(0, 1);
    uf.union(0, 2); // {0,1,2}=3
    uf.union(5, 6); // {5,6}=2

    const restored = PieceUnionFind.fromArrays(uf.getParent(), uf.getSize());
    expect(restored.groupSize(0)).toBe(uf.groupSize(0)); // 3
    expect(restored.groupSize(2)).toBe(uf.groupSize(2)); // 3
    expect(restored.groupSize(5)).toBe(uf.groupSize(5)); // 2
    expect(restored.groupSize(7)).toBe(uf.groupSize(7)); // 1
  });
});
