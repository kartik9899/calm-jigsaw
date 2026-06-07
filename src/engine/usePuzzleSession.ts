import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { generate } from '../core/generation/generator';
import { mulberry32 } from '../core/generation/prng';
import { isSolved } from '../core/solve/completion';
import type { SnapCandidate } from '../core/solve/snapResolver';
import { PieceUnionFind } from '../core/solve/unionFind';
import type { GeneratedPuzzle, SolveState } from '../core/types';
import { deleteSession, loadSession, saveSession } from '../state/persistence';
import { useSessionStore } from '../state/sessionStore';
import { scatterGroups } from './scatter';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PuzzleSessionParams {
  puzzleId: string;
  rows: number;
  cols: number;
  seed: number;
  imageAspect: number;
}

export interface PuzzleSession {
  puzzle: GeneratedPuzzle;
  solveState: SolveState;
  /** Live union-find for fast group queries without re-creating from arrays. */
  uf: PieceUnionFind;
  applySnap: (candidate: SnapCandidate) => void;
  /** Translate a group by (dx, dy) world units after a drag drop. */
  moveGroup: (root: number, dx: number, dy: number) => void;
  /**
   * Set absolute world-space translations for several groups in one commit
   * (e.g. the "Gather" action — M3-06). Unknown roots are ignored; persists
   * once for the whole batch rather than once per group.
   */
  relocateGroups: (updates: ReadonlyMap<number, { x: number; y: number }>) => void;
  /** Record that a free hint was used (M3-09); increments + persists hintsUsed. */
  consumeHint: () => void;
  /** Wall-clock time to run generate() for this puzzle (ms). GATE-001 C1. */
  generationMs: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFreshSolveState(puzzleId: string, puzzle: GeneratedPuzzle): SolveState {
  const n = puzzle.rows * puzzle.cols;
  const uf = new PieceUnionFind(n);
  // XOR-shift the seed so the scatter PRNG is independent from the edge PRNG
  const scatterPrng = mulberry32(puzzle.seed ^ 0x9e3779b9);
  const groups = scatterGroups(puzzle.pieces, puzzle, scatterPrng);
  return {
    puzzleId,
    rows: puzzle.rows,
    cols: puzzle.cols,
    seed: puzzle.seed,
    imageAspect: puzzle.imageAspect,
    groups,
    unionParent: uf.getParent(),
    unionSize: uf.getSize(),
    elapsedMs: 0,
    hintsUsed: 0,
  };
}

/**
 * Resume rebuilds exact state from seed (M3-03): prefer a saved SolveState
 * when one exists and matches this puzzle's generation parameters. The
 * parameter check guards against stale saves — e.g. a content update that
 * changes a puzzle's seed or aspect ratio would otherwise resurrect a save
 * whose geometry no longer matches the regenerated puzzle.
 */
function restoreOrCreateSolveState(puzzleId: string, puzzle: GeneratedPuzzle): SolveState {
  const saved = loadSession(puzzleId, puzzle.rows, puzzle.cols);
  if (
    saved &&
    saved.seed === puzzle.seed &&
    saved.rows === puzzle.rows &&
    saved.cols === puzzle.cols &&
    saved.imageAspect === puzzle.imageAspect
  ) {
    return saved;
  }
  return makeFreshSolveState(puzzleId, puzzle);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Manages a single puzzle play session.
 *
 * Mount this hook inside a component keyed by puzzleId:
 *   <JigsawCanvas key={puzzleId} ... />
 * The key ensures the hook resets when the user starts a different puzzle.
 *
 * piece.worldPos = piece.correctPos + group.translation
 * (translation=0 → piece at its solved position)
 */
export function usePuzzleSession(params: PuzzleSessionParams): PuzzleSession {
  const { puzzleId, rows, cols, seed, imageAspect } = params;
  const { setSession } = useSessionStore();

  const { puzzle, generationMs } = useMemo(() => {
    const t0 = performance.now();
    const p = generate({ rows, cols, seed, imageAspect });
    return { puzzle: p, generationMs: performance.now() - t0 };
  }, [rows, cols, seed, imageAspect]);

  // Solve state — local source of truth for rendering.
  // Lazy initializer runs once; component re-mount resets it (via key=puzzleId).
  // Resumes an in-progress save when one matches this puzzle, else scatters fresh.
  const [solveState, setSolveState] = useState<SolveState>(() =>
    restoreOrCreateSolveState(puzzleId, puzzle),
  );

  // Live union-find kept in sync with the solve state arrays.
  const ufRef = useRef<PieceUnionFind | null>(null);
  if (ufRef.current === null) {
    ufRef.current = PieceUnionFind.fromArrays(solveState.unionParent, solveState.unionSize);
  }

  // Always-current solve-state ref — used by the background-save effect below
  // so it never closes over a stale value.
  const liveStateRef = useRef(solveState);
  liveStateRef.current = solveState;

  // Sync initial state to the session store for future M3 background persistence.
  // Empty deps: intentional mount-only sync.
  useEffect(() => {
    setSession(solveState);
  }, []); // eslint-disable-line

  // Forced save on background/inactive (M3-03): the per-move autosave below
  // covers normal play, but a backgrounded app mid-drag could otherwise lose
  // the last unsettled position. Skipped once solved — the save was already
  // deleted and shouldn't be resurrected.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'background' && next !== 'inactive') return;
      const uf = ufRef.current;
      if (uf && !isSolved(uf)) saveSession(liveStateRef.current);
    });
    return () => sub.remove();
  }, []);

  const moveGroup = useCallback(
    (root: number, dx: number, dy: number) => {
      setSolveState((prev) => {
        const g = prev.groups[root];
        if (!g) return prev;
        const next: SolveState = {
          ...prev,
          groups: {
            ...prev.groups,
            [root]: { ...g, translation: { x: g.translation.x + dx, y: g.translation.y + dy } },
          },
        };
        setSession(next);
        saveSession(next);
        return next;
      });
    },
    [setSession],
  );

  const relocateGroups = useCallback(
    (updates: ReadonlyMap<number, { x: number; y: number }>) => {
      if (updates.size === 0) return;
      setSolveState((prev) => {
        const groups = { ...prev.groups };
        let changed = false;
        for (const [root, translation] of updates) {
          const g = groups[root];
          if (!g) continue;
          groups[root] = { ...g, translation };
          changed = true;
        }
        if (!changed) return prev;
        const next: SolveState = { ...prev, groups };
        setSession(next);
        saveSession(next);
        return next;
      });
    },
    [setSession],
  );

  const consumeHint = useCallback(() => {
    setSolveState((prev) => {
      const next: SolveState = { ...prev, hintsUsed: prev.hintsUsed + 1 };
      setSession(next);
      saveSession(next);
      return next;
    });
  }, [setSession]);

  const applySnap = useCallback(
    (candidate: SnapCandidate) => {
      const uf = ufRef.current!;

      // Union first (survivingRoot stays root because it's the larger group per snap resolver)
      uf.union(candidate.survivingRoot, candidate.absorbedRoot);

      setSolveState((prev) => {
        const groups = { ...prev.groups };
        // Absorbed group snaps to surviving group's position.
        // piece.worldPos = correctPos + translation; equality of translations = alignment.
        delete groups[candidate.absorbedRoot];
        const next: SolveState = {
          ...prev,
          groups,
          unionParent: uf.getParent(),
          unionSize: uf.getSize(),
        };
        setSession(next);
        if (isSolved(uf)) {
          // Completion leaves no dangling save — replaying starts fresh from seed.
          deleteSession(next.puzzleId, next.rows, next.cols);
        } else {
          saveSession(next);
        }
        return next;
      });
    },
    [setSession],
  );

  return {
    puzzle,
    solveState,
    uf: ufRef.current,
    applySnap,
    moveGroup,
    relocateGroups,
    consumeHint,
    generationMs,
  };
}
