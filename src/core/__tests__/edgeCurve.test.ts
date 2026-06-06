import { edgePathCmds } from '../generation/edgeCurve';
import { EdgeSpec, PathCmd } from '../types';

// ── Helper ────────────────────────────────────────────────────────────────────

/** Collect every numeric coordinate from a PathCmd array. */
function allCoords(cmds: PathCmd[]): number[] {
  const result: number[] = [];
  for (const c of cmds) {
    switch (c.cmd) {
      case 'moveTo':
      case 'lineTo':
        result.push(c.x, c.y);
        break;
      case 'cubicTo':
        result.push(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
        break;
      case 'close':
        break;
    }
  }
  return result;
}

// ── Flat edge ─────────────────────────────────────────────────────────────────

describe('edgePathCmds — flat edge', () => {
  const cmds = edgePathCmds(
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: -1 },
    { type: 'flat', jitter: 0, size: 0 },
    100,
  );

  it('returns exactly 1 command', () => {
    expect(cmds).toHaveLength(1);
  });

  it('command is lineTo', () => {
    expect(cmds[0].cmd).toBe('lineTo');
  });

  it('lands exactly at the end point', () => {
    const c = cmds[0];
    if (c.cmd !== 'lineTo') throw new Error('Expected lineTo');
    expect(c.x).toBeCloseTo(100);
    expect(c.y).toBeCloseTo(0);
  });
});

// ── Tab structure ─────────────────────────────────────────────────────────────

describe('edgePathCmds — tab command structure', () => {
  const knob = edgePathCmds(
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: -1 },
    { type: 'knob', jitter: 0, size: 0.2 },
    100,
  );
  const blank = edgePathCmds(
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: -1 },
    { type: 'blank', jitter: 0, size: 0.2 },
    100,
  );

  it('knob returns exactly 4 commands', () => {
    expect(knob).toHaveLength(4);
  });

  it('blank returns exactly 4 commands', () => {
    expect(blank).toHaveLength(4);
  });

  it('knob: lineTo → cubicTo → cubicTo → lineTo', () => {
    expect(knob[0].cmd).toBe('lineTo');
    expect(knob[1].cmd).toBe('cubicTo');
    expect(knob[2].cmd).toBe('cubicTo');
    expect(knob[3].cmd).toBe('lineTo');
  });

  it('blank: same sequence as knob', () => {
    expect(blank[0].cmd).toBe('lineTo');
    expect(blank[1].cmd).toBe('cubicTo');
    expect(blank[2].cmd).toBe('cubicTo');
    expect(blank[3].cmd).toBe('lineTo');
  });
});

// ── End-point accuracy ────────────────────────────────────────────────────────

describe('edgePathCmds — last command lands at end', () => {
  const cases: Array<[string, { x: number; y: number }, EdgeSpec]> = [
    ['flat  horizontal', { x: 100, y: 0 }, { type: 'flat', jitter: 0, size: 0 }],
    ['knob  horizontal', { x: 100, y: 0 }, { type: 'knob', jitter: 0.5, size: 0.2 }],
    ['blank horizontal', { x: 100, y: 0 }, { type: 'blank', jitter: -0.5, size: 0.18 }],
    ['knob  vertical', { x: 0, y: 100 }, { type: 'knob', jitter: 0, size: 0.2 }],
    ['blank vertical', { x: 0, y: 100 }, { type: 'blank', jitter: 0, size: 0.22 }],
  ];

  it.each(cases)('%s', (_, end, spec) => {
    const outNormal = end.x !== 0 ? { x: 0, y: -1 } : { x: 1, y: 0 };
    const cmds = edgePathCmds({ x: 0, y: 0 }, end, outNormal, spec, 100);
    const last = cmds[cmds.length - 1];
    expect(last.cmd).toBe('lineTo');
    if (last.cmd !== 'lineTo') return;
    expect(last.x).toBeCloseTo(end.x);
    expect(last.y).toBeCloseTo(end.y);
  });
});

// ── Tab direction ─────────────────────────────────────────────────────────────
//
// The first cubicTo's endpoint is the tab head.
// Knob: head must be displaced in the outNormal direction from the baseline.
// Blank: head must be displaced opposite the outNormal direction.

describe('edgePathCmds — tab direction', () => {
  it('knob protrudes in outNormal direction (horizontal edge, normal up)', () => {
    // Edge: (0,0)→(100,0). outNormal=(0,−1) = upward. Knob → head.y < 0.
    const cmds = edgePathCmds(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: -1 },
      { type: 'knob', jitter: 0, size: 0.2 },
      100,
    );
    const head = cmds[1];
    if (head.cmd !== 'cubicTo') throw new Error('Expected cubicTo at index 1');
    expect(head.y).toBeLessThan(0);
  });

  it('blank dips opposite the outNormal direction (horizontal edge, normal up)', () => {
    // outNormal=(0,−1). Blank → head.y > 0 (below baseline).
    const cmds = edgePathCmds(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: -1 },
      { type: 'blank', jitter: 0, size: 0.2 },
      100,
    );
    const head = cmds[1];
    if (head.cmd !== 'cubicTo') throw new Error('Expected cubicTo at index 1');
    expect(head.y).toBeGreaterThan(0);
  });

  it('knob protrudes in outNormal direction (vertical edge, normal right)', () => {
    // Edge: (0,0)→(0,100). outNormal=(1,0) = rightward. Knob → head.x > 0.
    const cmds = edgePathCmds(
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 1, y: 0 },
      { type: 'knob', jitter: 0, size: 0.2 },
      100,
    );
    const head = cmds[1];
    if (head.cmd !== 'cubicTo') throw new Error('Expected cubicTo at index 1');
    expect(head.x).toBeGreaterThan(0);
  });

  it('blank dips opposite the outNormal direction (vertical edge, normal right)', () => {
    // outNormal=(1,0). Blank → head.x < 0.
    const cmds = edgePathCmds(
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 1, y: 0 },
      { type: 'blank', jitter: 0, size: 0.2 },
      100,
    );
    const head = cmds[1];
    if (head.cmd !== 'cubicTo') throw new Error('Expected cubicTo at index 1');
    expect(head.x).toBeLessThan(0);
  });

  it('knob protrudes in outNormal direction (bottom edge: right-to-left, normal down)', () => {
    // Edge: (100,100)→(0,100). outNormal=(0,1) = downward. Knob → head.y > 100.
    const cmds = edgePathCmds(
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 1 },
      { type: 'knob', jitter: 0, size: 0.2 },
      100,
    );
    const head = cmds[1];
    if (head.cmd !== 'cubicTo') throw new Error('Expected cubicTo at index 1');
    expect(head.y).toBeGreaterThan(100);
  });

  it('knob protrudes in outNormal direction (left edge: bottom-to-top, normal left)', () => {
    // Edge: (0,100)→(0,0). outNormal=(−1,0) = leftward. Knob → head.x < 0.
    const cmds = edgePathCmds(
      { x: 0, y: 100 },
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { type: 'knob', jitter: 0, size: 0.2 },
      100,
    );
    const head = cmds[1];
    if (head.cmd !== 'cubicTo') throw new Error('Expected cubicTo at index 1');
    expect(head.x).toBeLessThan(0);
  });
});

// ── Finite coordinates ────────────────────────────────────────────────────────
//
// Test the full jitter range [−1, 1] (the authoritative range per EdgeSpec).

describe('edgePathCmds — all coordinates are finite (no NaN / Infinity)', () => {
  const specs: Array<[string, EdgeSpec]> = [
    ['flat', { type: 'flat', jitter: 0, size: 0 }],
    ['knob  jitter= 0', { type: 'knob', jitter: 0, size: 0.2 }],
    ['knob  jitter=+1', { type: 'knob', jitter: 1, size: 0.22 }],
    ['knob  jitter=−1', { type: 'knob', jitter: -1, size: 0.18 }],
    ['blank jitter=+1', { type: 'blank', jitter: 1, size: 0.22 }],
    ['blank jitter=−1', { type: 'blank', jitter: -1, size: 0.18 }],
  ];

  it.each(specs)('%s', (_, spec) => {
    const cmds = edgePathCmds({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: -1 }, spec, 100);
    for (const n of allCoords(cmds)) {
      expect(Number.isFinite(n)).toBe(true);
    }
  });
});
