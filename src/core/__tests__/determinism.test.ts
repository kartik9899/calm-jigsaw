import { generate } from '../generation/generator';

const BASE = { rows: 4, cols: 6, seed: 42, imageAspect: 1.5 };

describe('generation — determinism', () => {
  it('same inputs produce deep-equal output', () => {
    const a = generate(BASE);
    const b = generate(BASE);
    expect(a).toEqual(b);
  });

  it('different seeds produce different cuts', () => {
    const a = generate(BASE);
    const b = generate({ ...BASE, seed: 99 });
    // At least one interior edge type must differ
    const typesA = a.pieces.map((p) => p.edges.right.type + p.edges.bottom.type).join('');
    const typesB = b.pieces.map((p) => p.edges.right.type + p.edges.bottom.type).join('');
    expect(typesA).not.toBe(typesB);
  });

  it('different seeds produce different jitter values', () => {
    const a = generate(BASE);
    const b = generate({ ...BASE, seed: 7 });
    const jitterA = a.pieces.map((p) => p.edges.right.jitter);
    const jitterB = b.pieces.map((p) => p.edges.right.jitter);
    expect(jitterA).not.toEqual(jitterB);
  });

  it('piece count equals rows × cols', () => {
    const p = generate(BASE);
    expect(p.pieces).toHaveLength(p.rows * p.cols);
  });

  it('correctPos values cover the full grid without overlap', () => {
    const p = generate(BASE);
    const seen = new Set<string>();
    for (const piece of p.pieces) {
      const key = `${piece.correctPos.x},${piece.correctPos.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(p.rows * p.cols);
  });

  it('tabOverhang is positive', () => {
    expect(generate(BASE).tabOverhang).toBeGreaterThan(0);
  });
});
