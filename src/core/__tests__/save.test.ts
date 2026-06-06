import { generate } from '../generation/generator';
import { serialize, deserialize } from '../save/serialize';
import { PieceUnionFind } from '../solve/unionFind';
import { SolveState } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSolveState(overrides: Partial<SolveState> = {}): SolveState {
  const rows = 3;
  const cols = 4;
  const n = rows * cols;
  const uf = new PieceUnionFind(n);
  // Simulate some snaps
  uf.union(0, 1);
  uf.union(1, 2);
  uf.union(6, 7);

  const groups: Record<number, import('../types').GroupState> = {};
  // After unions: roots are determined by union-by-size, but let's just record
  // per-piece root as the key (call find after all unions)
  const seen = new Set<number>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!seen.has(root)) {
      seen.add(root);
      groups[root] = {
        root,
        translation: { x: root * 10, y: root * 5 },
        rotationRad: 0,
      };
    }
  }

  return {
    puzzleId: 'test-puzzle-1',
    rows,
    cols,
    seed: 42,
    imageAspect: 1.5,
    groups,
    unionParent: uf.getParent(),
    unionSize: uf.getSize(),
    elapsedMs: 12345,
    hintsUsed: 2,
    ...overrides,
  };
}

// ── Round-trip ────────────────────────────────────────────────────────────────

describe('serialize / deserialize', () => {
  it('round-trip produces deep-equal state', () => {
    const original = makeSolveState();
    const restored = deserialize(serialize(original));
    expect(restored).toEqual(original);
  });

  it('preserves all scalar fields', () => {
    const s = makeSolveState();
    const r = deserialize(serialize(s));
    expect(r.puzzleId).toBe(s.puzzleId);
    expect(r.rows).toBe(s.rows);
    expect(r.cols).toBe(s.cols);
    expect(r.seed).toBe(s.seed);
    expect(r.imageAspect).toBeCloseTo(s.imageAspect);
    expect(r.elapsedMs).toBe(s.elapsedMs);
    expect(r.hintsUsed).toBe(s.hintsUsed);
  });

  it('preserves union-find arrays', () => {
    const s = makeSolveState();
    const r = deserialize(serialize(s));
    expect(r.unionParent).toEqual(s.unionParent);
    expect(r.unionSize).toEqual(s.unionSize);
  });

  it('preserves group translations', () => {
    const s = makeSolveState();
    const r = deserialize(serialize(s));
    expect(r.groups).toEqual(s.groups);
  });

  // ── Regeneration: seed reproduces the same geometry ──────────────────────

  it('regenerate from seed after restore produces identical geometry', () => {
    const s = makeSolveState();
    const r = deserialize(serialize(s));

    const original = generate({
      rows: s.rows,
      cols: s.cols,
      seed: s.seed,
      imageAspect: s.imageAspect,
    });
    const restored = generate({
      rows: r.rows,
      cols: r.cols,
      seed: r.seed,
      imageAspect: r.imageAspect,
    });

    expect(restored.pieces).toEqual(original.pieces);
    expect(restored.cellW).toBeCloseTo(original.cellW);
    expect(restored.cellH).toBeCloseTo(original.cellH);
  });

  // ── Placed-piece count preserved ─────────────────────────────────────────

  it('union-find connectivity is preserved through restore', () => {
    const s = makeSolveState();
    const r = deserialize(serialize(s));

    const ufOrig = PieceUnionFind.fromArrays(s.unionParent, s.unionSize);
    const ufRest = PieceUnionFind.fromArrays(r.unionParent, r.unionSize);

    expect(ufRest.groupCount()).toBe(ufOrig.groupCount());
    // Pieces 0,1,2 were unioned together
    expect(ufRest.connected(0, 1)).toBe(true);
    expect(ufRest.connected(0, 2)).toBe(true);
    // Pieces 6,7 were unioned
    expect(ufRest.connected(6, 7)).toBe(true);
    // Pieces 0 and 6 were NOT unioned
    expect(ufRest.connected(0, 6)).toBe(false);
  });

  // ── Error handling ───────────────────────────────────────────────────────

  it('throws on invalid JSON', () => {
    expect(() => deserialize('not json')).toThrow();
  });

  it('throws on empty object', () => {
    expect(() => deserialize('{}')).toThrow();
  });

  it('throws on missing required field', () => {
    const s = makeSolveState();
    const raw = JSON.parse(serialize(s)) as Record<string, unknown>;
    delete raw['seed'];
    expect(() => deserialize(JSON.stringify(raw))).toThrow();
  });
});
