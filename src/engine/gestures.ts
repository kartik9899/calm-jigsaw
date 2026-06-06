import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import type { CameraState } from './camera';

const MIN_SCALE = 0.05;
const MAX_SCALE = 5;

/**
 * Composed board gesture: single-finger pan + two-finger pinch-zoom.
 *
 * Pan:   moves the camera by dragging with one finger.
 * Pinch: scales the camera while keeping the focal point fixed in world space
 *        and tracking focal-point movement as a simultaneous two-finger pan.
 *
 * Usage:
 *   const gesture = useBoardGestures(camera);
 *   <GestureDetector gesture={gesture}><Canvas …/></GestureDetector>
 */
export function useBoardGestures(camera: CameraState) {
  // Pinch start-state snapshots (read on the UI thread, stored as shared values)
  const scaleAtStart = useSharedValue(1);
  const txAtStart = useSharedValue(0);
  const tyAtStart = useSharedValue(0);
  const focalXAtStart = useSharedValue(0);
  const focalYAtStart = useSharedValue(0);

  // ── Single-finger pan ──────────────────────────────────────────────────────

  const pan = Gesture.Pan()
    .maxPointers(1) // deactivates when a second finger arrives; pinch takes over
    .onChange((e) => {
      'worklet';
      camera.translateX.value += e.changeX;
      camera.translateY.value += e.changeY;
    });

  // ── Two-finger pinch-zoom (with implicit two-finger pan) ───────────────────

  const pinch = Gesture.Pinch()
    .onBegin((e) => {
      'worklet';
      scaleAtStart.value = camera.scale.value;
      txAtStart.value = camera.translateX.value;
      tyAtStart.value = camera.translateY.value;
      focalXAtStart.value = e.focalX;
      focalYAtStart.value = e.focalY;
    })
    .onUpdate((e) => {
      'worklet';
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleAtStart.value * e.scale));

      // World position of the initial focal point — must stay under the current focal point.
      const fwx = (focalXAtStart.value - txAtStart.value) / scaleAtStart.value;
      const fwy = (focalYAtStart.value - tyAtStart.value) / scaleAtStart.value;

      // Using e.focalX (live focal point) handles two-finger pan automatically:
      // when scale is 1 the formula collapses to tx += (focalX_current − focalX_start).
      camera.scale.value = newScale;
      camera.translateX.value = e.focalX - fwx * newScale;
      camera.translateY.value = e.focalY - fwy * newScale;
    });

  return Gesture.Simultaneous(pan, pinch);
}
