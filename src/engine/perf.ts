import { useEffect, useState } from 'react';
import { runOnJS, useFrameCallback, useSharedValue } from 'react-native-reanimated';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PerfStats {
  /** Frames per second measured on the UI thread over a 1-second window. */
  fps: number;
  /** JS heap usage in MB from Performance.memory, or null when unavailable. */
  memoryMB: number | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Measure UI-thread FPS and JS-heap memory for GATE-001 performance validation.
 *
 * FPS is counted on the UI thread via Reanimated's frame callback and sent to
 * React state once per second via runOnJS.
 * Memory is polled from Performance.memory every 2 s (Hermes / V8 only).
 *
 * Always call this hook — pass enabled=false to suppress all side-effects and
 * return zeroed stats.
 */
export function usePerfStats(enabled: boolean): PerfStats {
  const [fps, setFps] = useState(0);
  const [memoryMB, setMemoryMB] = useState<number | null>(null);

  // SharedValues let the frame-callback worklet read the latest `enabled`
  // value without needing to re-create the worklet closure on each render.
  const enabledSV = useSharedValue(enabled);
  const frameCount = useSharedValue(0);
  const windowStart = useSharedValue(0);

  // Sync React prop → SharedValue, and reset counters when disabled.
  useEffect(() => {
    enabledSV.value = enabled;
    if (!enabled) {
      frameCount.value = 0;
      windowStart.value = 0;
    }
  }, [enabled]); // eslint-disable-line

  // Count frames on the UI thread; push fps to React state once per second.
  useFrameCallback(({ timestamp }) => {
    'worklet';
    if (!enabledSV.value) return;
    if (windowStart.value === 0) {
      windowStart.value = timestamp;
      return;
    }
    frameCount.value += 1;
    const elapsed = timestamp - windowStart.value;
    if (elapsed >= 1000) {
      runOnJS(setFps)(Math.round((frameCount.value * 1000) / elapsed));
      frameCount.value = 0;
      windowStart.value = timestamp;
    }
  });

  // Poll JS-heap memory every 2 s (Performance.memory is engine-specific).
  useEffect(() => {
    if (!enabled) return;
    const measure = () => {
      type PerfMem = Performance & { memory?: { usedJSHeapSize: number } };
      const mem = (performance as PerfMem).memory;
      if (mem?.usedJSHeapSize != null) {
        setMemoryMB(Math.round(mem.usedJSHeapSize / (1024 * 1024)));
      }
    };
    measure();
    const id = setInterval(measure, 2000);
    return () => clearInterval(id);
  }, [enabled]);

  return { fps: enabled ? fps : 0, memoryMB: enabled ? memoryMB : null };
}
