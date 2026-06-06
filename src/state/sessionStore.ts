import { create } from 'zustand';

import type { SolveState } from '../core/types';

interface SessionStore {
  /** Active puzzle's solve state. Null between sessions. */
  solveState: SolveState | null;
  setSession: (state: SolveState) => void;
  patchSession: (updater: (s: SolveState) => SolveState) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionStore>()((set) => ({
  solveState: null,
  setSession: (solveState) => set({ solveState }),
  patchSession: (updater) =>
    set((s) => ({ solveState: s.solveState ? updater(s.solveState) : null })),
  clearSession: () => set({ solveState: null }),
}));
