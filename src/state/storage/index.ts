/**
 * Storage adapter for Zustand `persist` middleware.
 *
 * Uses react-native-mmkv (v4) for synchronous, native-speed key-value storage.
 * In Jest (`NODE_ENV=test`) MMKV automatically substitutes a Map-backed mock,
 * so no mocking setup is needed in tests.
 *
 * NOTE: This is a native module — a dev-client rebuild is required after
 * installing react-native-mmkv and react-native-nitro-modules for the first time.
 */

import { createMMKV } from 'react-native-mmkv';

export interface StorageAdapter {
  getItem(name: string): string | null;
  setItem(name: string, value: string): void;
  removeItem(name: string): void;
}

// One MMKV instance dedicated to Zustand-persisted settings.
const mmkv = createMMKV({ id: 'calm-jigsaw-settings' });

export const storage: StorageAdapter = {
  getItem: (name) => mmkv.getString(name) ?? null,
  setItem: (name, value) => mmkv.set(name, value),
  removeItem: (name) => mmkv.remove(name),
};
