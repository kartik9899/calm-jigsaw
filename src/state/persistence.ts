/**
 * Puzzle-session persistence helpers.
 *
 * Uses a dedicated MMKV instance (`calm-jigsaw-sessions`) separate from the
 * settings store. Sessions are keyed by puzzleId + grid dimensions so that
 * the same puzzle at different difficulties produces independent saves.
 *
 * All functions are synchronous and non-fatal: storage errors are swallowed
 * (the in-memory solve-state remains the source of truth).
 *
 * In Jest (`NODE_ENV=test`) MMKV returns a Map-backed mock automatically.
 */

import { createMMKV } from 'react-native-mmkv';

import { deserialize, serialize } from '../core/save/serialize';
import type { SolveState } from '../core/types';

// One MMKV instance for puzzle sessions (separate id from settings).
const sessions = createMMKV({ id: 'calm-jigsaw-sessions' });

// ── Key ───────────────────────────────────────────────────────────────────────

/**
 * Deterministic MMKV key for a puzzle session.
 * Encodes puzzleId, rows, and cols so that the same image at two different
 * difficulties produces two separate saves.
 *
 * @example saveKey('sample', 14, 25) → 'session__sample__14x25'
 */
export function saveKey(puzzleId: string, rows: number, cols: number): string {
  return `session__${puzzleId}__${rows}x${cols}`;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Persist a SolveState to MMKV.
 * Called after every drag-drop and snap; failure is non-fatal.
 */
export function saveSession(state: SolveState): void {
  try {
    sessions.set(saveKey(state.puzzleId, state.rows, state.cols), serialize(state));
  } catch {
    // Storage failure is non-fatal — in-memory state stays valid.
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Load a saved SolveState from MMKV.
 * Returns null when no save exists or the stored data fails validation.
 * Callers should start a fresh game when null is returned.
 */
export function loadSession(puzzleId: string, rows: number, cols: number): SolveState | null {
  try {
    const json = sessions.getString(saveKey(puzzleId, rows, cols));
    if (!json) return null;
    return deserialize(json);
  } catch {
    return null;
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Remove a saved SolveState from MMKV.
 * Called on puzzle completion (no dangling saves) and on "New Game".
 */
export function deleteSession(puzzleId: string, rows: number, cols: number): void {
  try {
    sessions.remove(saveKey(puzzleId, rows, cols));
  } catch {
    // Non-fatal.
  }
}
