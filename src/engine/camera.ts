import type { Transforms3d } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CameraState {
  /** Camera X translate in screen pixels (shifts world origin right). */
  translateX: SharedValue<number>;
  /** Camera Y translate in screen pixels (shifts world origin down). */
  translateY: SharedValue<number>;
  /** Zoom: screen pixels per world unit. */
  scale: SharedValue<number>;
  /**
   * Animated Transforms3d array for <Group transform={camera.transform}>.
   *
   * screen = world × scale + translate
   *
   * RNSK applies the transform array right-to-left to points, so
   * [{translateX}, {translateY}, {scale}] = T(tx,ty) × S(s), which means:
   *   scale is applied first, then translate → screen = world*s + (tx, ty)  ✓
   */
  transform: SharedValue<Transforms3d>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute the initial camera state that fits the world image inside the screen
 * with a 5 % margin on the constraining axis.
 */
export function fitToScreen(
  screenW: number,
  screenH: number,
  imageAspect: number,
): { scale: number; translateX: number; translateY: number } {
  const worldW = 1000;
  const worldH = 1000 / imageAspect;
  const s = Math.min(screenW / worldW, screenH / worldH) * 0.95;
  return {
    scale: s,
    translateX: (screenW - worldW * s) / 2,
    translateY: (screenH - worldH * s) / 2,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Camera Reanimated shared values for the puzzle board.
 *
 * World space: 1000 units wide × (1000/imageAspect) units tall.
 * Initial state: image centred in the screen at 95 % of fit-to-screen scale.
 */
export function useCamera(screenW: number, screenH: number, imageAspect: number): CameraState {
  const init = fitToScreen(screenW, screenH, imageAspect);

  const translateX = useSharedValue(init.translateX);
  const translateY = useSharedValue(init.translateY);
  const scale = useSharedValue(init.scale);

  const transform = useDerivedValue<Transforms3d>(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ]);

  return { translateX, translateY, scale, transform };
}

// ── Worklet coordinate helpers ────────────────────────────────────────────────

/** Convert a world-space point to screen pixels. Worklet-safe. */
export function worldToScreen(
  wx: number,
  wy: number,
  tx: number,
  ty: number,
  s: number,
): { x: number; y: number } {
  'worklet';
  return { x: wx * s + tx, y: wy * s + ty };
}

/** Convert a screen-pixel point to world space. Worklet-safe. */
export function screenToWorld(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  s: number,
): { x: number; y: number } {
  'worklet';
  return { x: (sx - tx) / s, y: (sy - ty) / s };
}
