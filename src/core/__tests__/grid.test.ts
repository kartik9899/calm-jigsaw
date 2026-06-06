import { gridForDifficulty } from '../generation/grid';

describe('gridForDifficulty', () => {
  // ── Piece-count proximity ─────────────────────────────────────────────────

  it.each([
    [24, 1.0],
    [96, 1.0],
    [350, 1.0],
  ])('total pieces for count=%i aspect=%f is within 15%% of target', (count, aspect) => {
    const { rows, cols } = gridForDifficulty(count, aspect);
    const total = rows * cols;
    expect(Math.abs(total - count) / count).toBeLessThan(0.15);
  });

  // ── Square cells for square image ─────────────────────────────────────────

  it.each([24, 96, 350])(
    'square image produces roughly equal rows and cols (count=%i)',
    (count) => {
      const { rows, cols } = gridForDifficulty(count, 1.0);
      const ratio = cols / rows;
      // Should be close to 1:1 (within factor of 2)
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(2.0);
    },
  );

  // ── Wide image ───────────────────────────────────────────────────────────

  it('wide image (16:9) produces more columns than rows', () => {
    const { rows, cols } = gridForDifficulty(96, 16 / 9);
    // cellAspect = imageAspect * rows / cols ≈ 1 → cols ≈ 1.78 * rows
    expect(cols).toBeGreaterThan(rows);
  });

  it('wide image cells have aspect close to 1 (square pieces)', () => {
    const aspect = 16 / 9;
    const { rows, cols } = gridForDifficulty(96, aspect);
    const cellAspect = (aspect * rows) / cols;
    expect(Math.abs(cellAspect - 1)).toBeLessThan(0.35);
  });

  // ── Tall image ───────────────────────────────────────────────────────────

  it('tall image (9:16) produces more rows than cols', () => {
    const { rows, cols } = gridForDifficulty(96, 9 / 16);
    expect(rows).toBeGreaterThan(cols);
  });

  it('tall image cells also have aspect close to 1', () => {
    const aspect = 9 / 16;
    const { rows, cols } = gridForDifficulty(96, aspect);
    const cellAspect = (aspect * rows) / cols;
    expect(Math.abs(cellAspect - 1)).toBeLessThan(0.35);
  });

  // ── Sanity ───────────────────────────────────────────────────────────────

  it('always returns at least 1 row and 1 col', () => {
    const { rows, cols } = gridForDifficulty(1, 1);
    expect(rows).toBeGreaterThanOrEqual(1);
    expect(cols).toBeGreaterThanOrEqual(1);
  });

  it('rows and cols are positive integers', () => {
    const { rows, cols } = gridForDifficulty(350, 1.5);
    expect(Number.isInteger(rows)).toBe(true);
    expect(Number.isInteger(cols)).toBe(true);
    expect(rows).toBeGreaterThan(0);
    expect(cols).toBeGreaterThan(0);
  });
});
