/**
 * Storage adapter for Zustand `persist` middleware.
 *
 * Uses react-native-mmkv (v3) for synchronous, native-speed key-value storage.
 * v3 ships its own TurboModule and has no react-native-nitro-modules dependency
 * (avoids the ReactModuleInfo constructor incompatibility between
 * react-native-nitro-modules >= 0.33 and React Native 0.76.x).
 * In Jest (`NODE_ENV=test`) MMKV automatically substitutes a Map-backed mock,
 * so no mocking setup is needed in tests.
 *
 * NOTE: This is a native module — a dev-client rebuild is required after
 * changing the installed react-native-mmkv version.
 */

import { MMKV } from 'react-native-mmkv';

export interface StorageAdapter {
  getItem(name: string): string | null;
  setItem(name: string, value: string): void;
  removeItem(name: string): void;
}

// One MMKV instance dedicated to Zustand-persisted settings.
const mmkv = new MMKV({ id: 'calm-jigsaw-settings' });

export const storage: StorageAdapter = {
  getItem: (name) => mmkv.getString(name) ?? null,
  setItem: (name, value) => mmkv.set(name, value),
  removeItem: (name) => mmkv.delete(name),
};
