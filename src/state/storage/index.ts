/**
 * Storage adapter for Zustand `persist` middleware.
 *
 * M0: in-memory map — survives re-renders, not app restarts.
 *     Settings are reset on every cold launch. This is intentional for M0;
 *     persistence is not required until M3.
 *
 * M3 swap — replace the `_memoryStore` implementation below with MMKV:
 *
 *   import { createMMKV } from 'react-native-mmkv';
 *   const mmkv = createMMKV({ id: 'calm-jigsaw-settings' });
 *   export const storage: StorageAdapter = {
 *     getItem:    (name) => mmkv.getString(name) ?? null,
 *     setItem:    (name, value) => mmkv.set(name, value),
 *     removeItem: (name) => mmkv.remove(name),
 *   };
 *
 * The interface, the `settingsStore`, and every other caller are unchanged.
 * Also: add `"react-native-mmkv"` back to `app.json#plugins` and
 * `package.json#dependencies` when performing the M3 swap.
 */

export interface StorageAdapter {
  getItem(name: string): string | null;
  setItem(name: string, value: string): void;
  removeItem(name: string): void;
}

// ─── M0 implementation ────────────────────────────────────────────────────────

const _memoryStore = new Map<string, string>();

export const storage: StorageAdapter = {
  getItem: (name) => _memoryStore.get(name) ?? null,
  setItem: (name, value) => {
    _memoryStore.set(name, value);
  },
  removeItem: (name) => {
    _memoryStore.delete(name);
  },
};
