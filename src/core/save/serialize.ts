import { SolveState } from '../types';

/**
 * Serialize a SolveState to a compact JSON string suitable for MMKV storage.
 *
 * Persists: puzzleId, rows, cols, seed, imageAspect, groups (root → translation),
 * unionParent, unionSize, elapsedMs, hintsUsed.
 *
 * Geometry (piece paths, edge specs) is NOT persisted — it is regenerated
 * deterministically from (seed, rows, cols, imageAspect) on resume.
 */
export function serialize(state: SolveState): string {
  return JSON.stringify(state);
}

/**
 * Restore a SolveState from a JSON string.
 * Throws if the string is not valid JSON or is missing required fields.
 */
export function deserialize(json: string): SolveState {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('SolveState: invalid JSON');
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('SolveState: expected object');
  }

  const s = raw as Record<string, unknown>;

  if (
    typeof s['puzzleId'] !== 'string' ||
    typeof s['rows'] !== 'number' ||
    typeof s['cols'] !== 'number' ||
    typeof s['seed'] !== 'number' ||
    typeof s['imageAspect'] !== 'number' ||
    typeof s['elapsedMs'] !== 'number' ||
    typeof s['hintsUsed'] !== 'number' ||
    !Array.isArray(s['unionParent']) ||
    !Array.isArray(s['unionSize']) ||
    typeof s['groups'] !== 'object' ||
    s['groups'] === null
  ) {
    throw new Error('SolveState: missing or malformed required fields');
  }

  return raw as SolveState;
}
