/**
 * Mulberry32 — a small, fast, seedable 32-bit PRNG.
 * Returns a factory whose output is deterministic for a given seed.
 *
 * Do NOT use Math.random() anywhere in src/core.
 *
 * @param seed  Any 32-bit integer (treated as uint32 internally).
 * @returns     A zero-argument function that yields floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  // Force uint32
  let s = seed >>> 0;

  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}
