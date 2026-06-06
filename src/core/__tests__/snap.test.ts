import { resolveSnap, SNAP_PX, SnapGroup } from '../solve/snapResolver';

// ── 1-row grid (3 pieces) — no vertical neighbours, clean horizontal tests ────

const PIECES_1x3 = [
  { index: 0, row: 0, col: 0 },
  { index: 1, row: 0, col: 1 },
  { index: 2, row: 0, col: 2 },
];

function groups1x3(
  t0: { x: number; y: number },
  t1: { x: number; y: number },
  t2: { x: number; y: number },
  sizes: [number, number, number] = [1, 1, 1],
): Map<number, SnapGroup> {
  return new Map([
    [0, { root: 0, translation: t0, size: sizes[0] }],
    [1, { root: 1, translation: t1, size: sizes[1] }],
    [2, { root: 2, translation: t2, size: sizes[2] }],
  ]);
}

const ir = (i: number) => i; // identity root — each piece is its own root

// ── Snap / no-snap boundary ───────────────────────────────────────────────────

describe('resolveSnap — boundary', () => {
  it('snaps just inside tolerance at zoom=1', () => {
    // delta 0↔1 = |0 − 20| = 20 < SNAP_PX (22) → snap
    const groups = groups1x3({ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 500, y: 0 });
    const result = resolveSnap(PIECES_1x3, ir, groups, 1, 3, 1);
    expect(result).not.toBeNull();
    expect(new Set([result!.rootA, result!.rootB])).toEqual(new Set([0, 1]));
  });

  it('does not snap just outside tolerance at zoom=1', () => {
    // delta = 23 > 22 — move ALL other groups far away too
    const groups = groups1x3({ x: 0, y: 0 }, { x: 23, y: 0 }, { x: 500, y: 0 });
    const result = resolveSnap(PIECES_1x3, ir, groups, 1, 3, 1);
    expect(result).toBeNull();
  });

  it('exact tolerance boundary snaps (≤, not <)', () => {
    // |delta|² = SNAP_PX² — should snap (≤ not <)
    const groups = groups1x3({ x: 0, y: 0 }, { x: SNAP_PX, y: 0 }, { x: 500, y: 0 });
    const result = resolveSnap(PIECES_1x3, ir, groups, 1, 3, 1);
    expect(result).not.toBeNull();
  });

  it('diagonal delta within tolerance snaps', () => {
    // delta = {x:15, y:15}, distSq = 450 < 484 → snap
    const groups = groups1x3({ x: 0, y: 0 }, { x: 15, y: 15 }, { x: 500, y: 0 });
    const result = resolveSnap(PIECES_1x3, ir, groups, 1, 3, 1);
    expect(result).not.toBeNull();
  });
});

// ── Zoom ─────────────────────────────────────────────────────────────────────

describe('resolveSnap — zoom', () => {
  it('tolerance shrinks as zoom increases: delta=12 snaps at zoom=1, not at zoom=2', () => {
    // zoom=1 → tolerance=22, distSq=144 ≤ 484 → snap
    // zoom=2 → tolerance=11, distSq=144 > 121 → no snap
    const groups = groups1x3({ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 500, y: 0 });

    const snap1 = resolveSnap(PIECES_1x3, ir, groups, 1, 3, 1);
    expect(snap1).not.toBeNull();
    expect(new Set([snap1!.rootA, snap1!.rootB])).toEqual(new Set([0, 1]));

    const snap2 = resolveSnap(PIECES_1x3, ir, groups, 1, 3, 2);
    expect(snap2).toBeNull();
  });

  it('zoomed-out view has larger tolerance: delta=40 snaps at zoom=0.5', () => {
    // zoom=0.5 → tolerance=44, distSq=1600 ≤ 1936 → snap
    const groups = groups1x3({ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 500, y: 0 });
    const result = resolveSnap(PIECES_1x3, ir, groups, 1, 3, 0.5);
    expect(result).not.toBeNull();
  });

  it('delta=40 does NOT snap at zoom=1 (outside default tolerance)', () => {
    const groups = groups1x3({ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 500, y: 0 });
    const result = resolveSnap(PIECES_1x3, ir, groups, 1, 3, 1);
    expect(result).toBeNull();
  });
});

// ── Closest candidate wins ────────────────────────────────────────────────────

describe('resolveSnap — closest wins', () => {
  it('returns the pair with smallest |delta| when two pairs qualify', () => {
    // 0↔1: delta={x:3,y:0}, dist=3   (closer)
    // 1↔2: delta={x:3-20,y:0}={x:-17,y:0}, dist=17  (farther)
    // Both < 22 → resolver must return 0↔1
    const groups = groups1x3({ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 20, y: 0 });
    const result = resolveSnap(PIECES_1x3, ir, groups, 1, 3, 1);
    expect(result).not.toBeNull();
    expect(new Set([result!.rootA, result!.rootB])).toEqual(new Set([0, 1]));
  });
});

// ── Surviving group ───────────────────────────────────────────────────────────

describe('resolveSnap — surviving group', () => {
  it('the larger group survives', () => {
    // Group 0 has size=3, group 1 has size=1 → group 0 survives
    const groups = groups1x3({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 500, y: 0 }, [3, 1, 1]);
    const result = resolveSnap(PIECES_1x3, ir, groups, 1, 3, 1);
    expect(result).not.toBeNull();
    expect(result!.survivingRoot).toBe(0); // size 3 > size 1
    expect(result!.absorbedRoot).toBe(1);
  });

  it('when equal size, piece-A group survives (first iterated)', () => {
    // Both groups same size → the one on rootA survives (≥ check)
    const groups = groups1x3({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 500, y: 0 });
    const result = resolveSnap(PIECES_1x3, ir, groups, 1, 3, 1);
    expect(result).not.toBeNull();
    expect(result!.survivingRoot).toBe(result!.rootA);
  });

  it('returns null when all pieces share one group (no cross-group neighbours)', () => {
    const groups = new Map<number, SnapGroup>([
      [0, { root: 0, translation: { x: 0, y: 0 }, size: 3 }],
    ]);
    const result = resolveSnap(PIECES_1x3, () => 0, groups, 1, 3, 1);
    expect(result).toBeNull();
  });
});
