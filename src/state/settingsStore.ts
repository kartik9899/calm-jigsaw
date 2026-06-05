import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { storage } from './storage';

interface SettingsState {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  setSound: (v: boolean) => void;
  setHaptics: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sound: true,
      haptics: true,
      reducedMotion: false,
      setSound: (sound) => set({ sound }),
      setHaptics: (haptics) => set({ haptics }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => storage),
    },
  ),
);
