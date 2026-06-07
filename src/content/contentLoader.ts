/**
 * Content catalogue accessors.
 *
 * Thin wrappers over the bundled pack that provide a stable interface for
 * the UI layer. Future implementations may merge remote packs here without
 * changing any caller.
 */

import { BUNDLED_PUZZLES } from './bundledPack';
import type { PuzzleContent } from './types';

/**
 * Returns all available puzzles in display order.
 * For M3 this is just the bundled pack; future versions may append
 * downloaded packs.
 */
export function getAllPuzzles(): PuzzleContent[] {
  return BUNDLED_PUZZLES;
}

/**
 * Look up a single puzzle by its unique id.
 * Returns null when no matching puzzle is found (unknown id or not yet loaded).
 */
export function getPuzzle(id: string): PuzzleContent | null {
  return BUNDLED_PUZZLES.find((p) => p.id === id) ?? null;
}
