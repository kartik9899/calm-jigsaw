/**
 * GATE-001 — Generation timing benchmark (Node.js reference).
 *
 * Node (V8) runs faster than Hermes on-device, so multiply Node times by ~2–3×
 * to estimate worst-case device time. The gate threshold for generation is
 * < 500 ms on device (one raster batch cycle, not a visible freeze).
 *
 * This test DOES NOT replace a real device run — it only validates that the
 * pure-TS generation step is cheap enough to be non-blocking.
 */

import { generate } from '../generation/generator';

const GATE_ROWS = 14;
const GATE_COLS = 25;
const GATE_SEED = 42;
const GATE_ASPECT = 3 / 2;
const WARMUP = 2;
const RUNS = 8;

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

describe('GATE-001 — generation timing at 350 pieces', () => {
  it('generates 14×25 puzzle repeatedly and records timing', () => {
    // Warm up JIT
    for (let i = 0; i < WARMUP; i++) {
      generate({ rows: GATE_ROWS, cols: GATE_COLS, seed: GATE_SEED + i, imageAspect: GATE_ASPECT });
    }

    const times: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now();
      const puzzle = generate({
        rows: GATE_ROWS,
        cols: GATE_COLS,
        seed: GATE_SEED + i,
        imageAspect: GATE_ASPECT,
      });
      times.push(performance.now() - t0);
      // Sanity: correct piece count
      expect(puzzle.pieces).toHaveLength(GATE_ROWS * GATE_COLS);
    }

    times.sort((a, b) => a - b);
    const min = times[0];
    const med = median(times);
    const max = times[times.length - 1];

    // eslint-disable-next-line no-console
    console.log(
      `\nGATE-001 generation (Node/V8, ${RUNS} runs):\n` +
        `  min    ${min.toFixed(2)}ms\n` +
        `  median ${med.toFixed(2)}ms\n` +
        `  max    ${max.toFixed(2)}ms\n` +
        `  (Hermes device estimate: median × 2.5 = ~${(med * 2.5).toFixed(0)}ms)\n`,
    );

    // Gate: Node max must be < 200 ms (leaves 3× headroom for Hermes device run).
    // Failing this means the generator has a pathological case to investigate.
    expect(max).toBeLessThan(200);
  });

  it('produces correct geometry at 350 pieces', () => {
    const puzzle = generate({
      rows: GATE_ROWS,
      cols: GATE_COLS,
      seed: GATE_SEED,
      imageAspect: GATE_ASPECT,
    });
    expect(puzzle.pieces).toHaveLength(350);
    expect(puzzle.cellW).toBeCloseTo(1000 / GATE_COLS, 5);
    expect(puzzle.cellH).toBeCloseTo(1000 / GATE_ASPECT / GATE_ROWS, 5);
    expect(puzzle.tabOverhang).toBeGreaterThan(0);
    // Every piece has a non-empty path
    for (const piece of puzzle.pieces) {
      expect(piece.pathCommands.length).toBeGreaterThan(4);
    }
  });
});
