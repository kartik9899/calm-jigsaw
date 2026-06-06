import { useCallback, useEffect, useRef, useState } from 'react';
import { runOnJS, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Camera scale below this is "zoomed out" for gate FPS bucketing. */
const ZOOMED_OUT_THRESHOLD = 0.5;

/** Minimum samples before a percentile is considered meaningful. */
const MIN_SAMPLES = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * p-th percentile of an already-sorted ascending array.
 * Returns null when fewer than MIN_SAMPLES values have been collected.
 */
function pct(sorted: number[], p: number): number | null {
  if (sorted.length < MIN_SAMPLES) return null;
  const idx = Math.max(0, Math.floor((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PerfStats {
  /** Frames per second measured on the UI thread over a 1-second window. */
  fps: number;
  /** JS heap usage in MB from Performance.memory, or null when unavailable. */
  memoryMB: number | null;
  /** Peak JS heap observed since this hook mounted. */
  peakMemoryMB: number | null;
  /** Number of 1-second FPS samples collected while a drag was active. */
  dragSampleCount: number;
  /** Number of 1-second FPS samples collected while zoomed out (scale < 0.5) and idle. */
  zoomedOutSampleCount: number;
  /**
   * Log the full GATE-001 report to the JS console.
   * Percentiles are computed at call time from all accumulated samples.
   * Copy output from Metro / ADB logcat into GATE_001_RESULTS.md.
   */
  printReport: (generationMs: number | null, rasterMs: number | null) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Measure UI-thread FPS, JS-heap memory, and GATE-001 percentile statistics.
 *
 * Pass `isDraggingSV` and `cameraScaleSV` to enable drag / zoomed-out FPS
 * bucketing for gate measurements. Without them samples are uncategorised.
 *
 * Always call this hook — pass enabled=false to suppress all side-effects and
 * return zeroed / null stats.
 */
export function usePerfStats(
  enabled: boolean,
  isDraggingSV?: SharedValue<boolean>,
  cameraScaleSV?: SharedValue<number>,
): PerfStats {
  const [fps, setFps] = useState(0);
  const [memoryMB, setMemoryMB] = useState<number | null>(null);
  const [peakMemoryMB, setPeakMemoryMB] = useState<number | null>(null);
  const [dragSampleCount, setDragSampleCount] = useState(0);
  const [zoomedOutSampleCount, setZoomedOutSampleCount] = useState(0);

  // Accumulated FPS arrays — refs so mutations don't trigger re-renders and
  // are always current when read inside the stable printReport callback.
  const dragSamplesRef = useRef<number[]>([]);
  const zoomedOutSamplesRef = useRef<number[]>([]);

  // ── Reanimated SharedValues ────────────────────────────────────────────────

  const enabledSV = useSharedValue(enabled);
  const frameCount = useSharedValue(0);
  const windowStart = useSharedValue(0);

  // Sync React prop → SharedValue; reset counters when disabled.
  useEffect(() => {
    enabledSV.value = enabled;
    if (!enabled) {
      frameCount.value = 0;
      windowStart.value = 0;
    }
  }, [enabled]); // eslint-disable-line

  // ── JS-thread sample recorder ──────────────────────────────────────────────

  // Intentionally stable (empty deps) — references only refs and state setters.
  // Safe to capture once inside useFrameCallback's worklet closure.
  const recordFpsSample = useCallback(
    (currentFps: number, dragging: boolean, scale: number) => {
      setFps(currentFps);
      if (dragging) {
        dragSamplesRef.current.push(currentFps);
        setDragSampleCount(dragSamplesRef.current.length);
      } else if (scale < ZOOMED_OUT_THRESHOLD) {
        zoomedOutSamplesRef.current.push(currentFps);
        setZoomedOutSampleCount(zoomedOutSamplesRef.current.length);
      }
    },
    [], // eslint-disable-line
  );

  // ── UI-thread frame counter ────────────────────────────────────────────────

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
      const currentFps = Math.round((frameCount.value * 1000) / elapsed);
      const dragging = isDraggingSV ? isDraggingSV.value : false;
      const scale = cameraScaleSV ? cameraScaleSV.value : 1;
      runOnJS(recordFpsSample)(currentFps, dragging, scale);
      frameCount.value = 0;
      windowStart.value = timestamp;
    }
  });

  // ── JS-heap memory poller ──────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;
    const measure = () => {
      type PerfMem = Performance & { memory?: { usedJSHeapSize: number } };
      const mem = (performance as PerfMem).memory;
      if (mem?.usedJSHeapSize != null) {
        const mb = Math.round(mem.usedJSHeapSize / (1024 * 1024));
        setMemoryMB(mb);
        setPeakMemoryMB((prev) => (prev === null ? mb : Math.max(prev, mb)));
      }
    };
    measure();
    const id = setInterval(measure, 2000);
    return () => clearInterval(id);
  }, [enabled]);

  // ── Report ─────────────────────────────────────────────────────────────────

  const printReport = useCallback(
    (generationMs: number | null, rasterMs: number | null) => {
      const dragSorted = [...dragSamplesRef.current].sort((a, b) => a - b);
      const zoSorted = [...zoomedOutSamplesRef.current].sort((a, b) => a - b);

      const fmt = (v: number | null, unit = '') =>
        v !== null ? `${v}${unit}` : 'N/A (need ≥ 5 samples)';

      const status = (ok: boolean | null) =>
        ok === true ? 'PASS ✅' : ok === false ? 'FAIL ❌' : 'PENDING ⏳';
      const gate = <T>(v: T | null, threshold: (x: T) => boolean) =>
        v !== null ? status(threshold(v)) : status(null);

      /* eslint-disable no-console */
      console.log(
        [
          '',
          '╔══════════════════════════════════════════════════╗',
          '║              GATE-001 RESULTS                    ║',
          '╚══════════════════════════════════════════════════╝',
          '',
          '── C1: Generation ───────────────────────────────',
          `   Value    : ${generationMs != null ? generationMs.toFixed(1) + 'ms' : 'N/A'}`,
          `   Threshold: < 16ms (single-frame budget)`,
          `   Status   : ${gate(generationMs, (t) => t < 16)}`,
          '',
          '── C2: Rasterization ────────────────────────────',
          `   Value    : ${rasterMs != null ? (rasterMs / 1000).toFixed(2) + 's' : 'N/A'}`,
          `   Threshold: completes without hang (< 10s)`,
          `   Status   : ${gate(rasterMs, (t) => t < 10_000)}`,
          '',
          '── C3: Peak Memory ──────────────────────────────',
          `   Value    : ${fmt(peakMemoryMB, 'MB')}`,
          `   Threshold: < 400MB`,
          `   Status   : ${gate(peakMemoryMB, (m) => m < 400)}`,
          '',
          `── C4: Drag FPS  (n=${dragSamplesRef.current.length} samples) ─────────────────`,
          `   p50      : ${fmt(pct(dragSorted, 50))}`,
          `   p05      : ${fmt(pct(dragSorted, 5))}`,
          `   Threshold: p50 ≥ 55fps, p05 ≥ 45fps`,
          `   p50      : ${gate(pct(dragSorted, 50), (v) => v >= 55)}`,
          `   p05      : ${gate(pct(dragSorted, 5), (v) => v >= 45)}`,
          '',
          `── C5: Zoomed-out FPS  (n=${zoomedOutSamplesRef.current.length} samples) ────────────`,
          `   p50      : ${fmt(pct(zoSorted, 50))}`,
          `   p05      : ${fmt(pct(zoSorted, 5))}`,
          `   Threshold: p50 ≥ 55fps, p05 ≥ 45fps`,
          `   p50      : ${gate(pct(zoSorted, 50), (v) => v >= 55)}`,
          `   p05      : ${gate(pct(zoSorted, 5), (v) => v >= 45)}`,
          '',
          '════════════════════════════════════════════════════',
        ].join('\n'),
      );
      /* eslint-enable no-console */
    },
    [peakMemoryMB], // eslint-disable-line
  );

  return {
    fps: enabled ? fps : 0,
    memoryMB: enabled ? memoryMB : null,
    peakMemoryMB: enabled ? peakMemoryMB : null,
    dragSampleCount,
    zoomedOutSampleCount,
    printReport,
  };
}
