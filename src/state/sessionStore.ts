import { create } from 'zustand';

// Placeholder — wired up in M3 with full SolveState
interface SessionState {
  activePuzzleId: string | null;
}

export const useSessionStore = create<SessionState>()(() => ({
  activePuzzleId: null,
}));
