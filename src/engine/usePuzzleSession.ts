import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { generate } from '../core/generation/generator';
import { mulberry32 } from '../core/generation/prng';
import type { SnapCandidate } from '../core/solve/snapResolver';
import { PieceUnionFind } from '../core/solve/unionFind';
import type { GeneratedPuzzle, SolveState } from '../core/types';
import { saveSession } from '../state/persistence';
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
  const [solveState, setSolveState] = useState<SolveState>(() =>
    makeFreshSolveState(puzzleId, puzzle),
  );

  // Live union-find kept in sync with the solve state arrays.
  const ufRef = useRef<PieceUnionFind | null>(null);
  if (ufRef.current === null) {
    ufRef.current = PieceUnionFind.fromArrays(solveState.unionParent, solveState.unionSize);
  }

  // Sync initial state to the session store for future M3 background persistence.
  // Empty deps: intentional mount-only sync.
  useEffect(() => {
    setSession(solveState);
  }, []); // eslint-disable-line

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
        saveSession(next);
        return next;
      });
    },
    [setSession],
  );

  return { puzzle, solveState, uf: ufRef.current, applySnap, moveGroup, generationMs };
}
