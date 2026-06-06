# GATE-001 Results — 350-Piece Performance Gate

**Puzzle:** 14 rows × 25 cols = 350 pieces  
**Config:** `puzzleId: gate-14x25`, `seed: 42`, `imageAspect: 3/2`  
**Device:** [ fill in: model, OS version, RAM ]  
**Build:** [ fill in: EAS dev build / `expo run:android` ]  
**Date:** [ fill in ]

---

## How to run

1. `GATE_MODE = true` is already set in `app/play/[id].tsx` (committed).
2. Build a dev client: `npx expo run:android` (or `run:ios` on Mac).
3. Navigate to the Play screen.
4. **Collect drag FPS samples**: drag pieces around for ≥ 30 seconds while the app renders the 350-piece board. The overlay shows `Drag n=X` — aim for n ≥ 10.
5. **Collect zoomed-out FPS samples**: pinch all the way out (scale < 0.5) so all 350 pieces are visible. Hold for ≥ 30 seconds idle. The overlay shows `ZOut n=X` — aim for n ≥ 10.
6. Tap **LOG REPORT** in the overlay. Copy the output from Metro / ADB logcat.
7. Fill in the measured values below.
8. After recording, reset `GATE_MODE = false` in `play/[id].tsx`.

---

## Criterion 1 — Generation time

*Pure-TS `generate()` on the JS thread. Must not freeze a frame (< 16ms).*

| Measurement | Value | Threshold | Status |
|---|---|---|---|
| Node/V8 median (CI) | 2.78ms | < 200ms | ✅ PASS |
| Node/V8 max (CI) | 5.28ms | < 200ms | ✅ PASS |
| Hermes estimate (×2.5) | ~7ms | < 16ms | ✅ PASS |
| **Device measured** | [ ms ] | < 16ms | [ ] |

**Notes:** Generation is pure synchronous TypeScript with no allocations beyond the piece array. At 350 pieces the Node median is 2.78ms — well under one frame at 60fps. This criterion passes in CI and is expected to pass on any device.

---

## Criterion 2 — Rasterization time

*350 offscreen Skia surfaces, chunked 8/tick. Must complete without visible hang.*

| Measurement | Value | Threshold | Status |
|---|---|---|---|
| **Device measured** | [ s ] | < 10s | [ ] |

**How to read:** The overlay shows `Rast X%…` during bake and `Rast X.XXs` once complete.

**Notes:** Each chunk of 8 pieces bakes synchronously, then `setTimeout(0)` yields. On a mid-range device, Skia surface creation is GPU-backed; 350 × ~(cellW+2×overhang) × ~(cellH+2×overhang) pixels per surface. At 14×25 with a 3/2 image, each surface is roughly `(40+18) × (47+18)` = 58×65 world units. At image resolution the actual pixel size depends on the source image.

---

## Criterion 3 — Memory (textures + heap)

*Peak JS heap measured by `performance.memory` every 2s. No OOM on a 3–4GB device.*

| Measurement | Value | Threshold | Status |
|---|---|---|---|
| **Peak memory (device)** | [ MB ] | < 400MB | [ ] |

**How to read:** The overlay shows `Peak XXXMB`. Tap **LOG REPORT** for the final value in the console.

**Notes:** `performance.memory.usedJSHeapSize` measures the JS heap. The Skia texture memory is GPU/native heap and is not captured here — this is a known gap. If the app OOMs without the JS heap exceeding 400MB, native texture memory is the culprit and the fix is a source-resolution cap or texture atlas.

---

## Criterion 4 — Drag FPS

*Dragging a piece/group while all 350 pieces are rendered. Measured as 1-second FPS windows while `isDraggingPiece = true`.*

| Measurement | Value | Threshold | Status |
|---|---|---|---|
| **p50 (median)** | [ fps ] | ≥ 55fps | [ ] |
| **p05 (5th pct)** | [ fps ] | ≥ 45fps | [ ] |
| Sample count | [ n ] | ≥ 10 | [ ] |

**How to read:** Drag pieces for ≥ 30 seconds. Each second of active drag produces one sample. Tap **LOG REPORT** — look for `C4: Drag FPS`.

---

## Criterion 5 — Zoomed-out FPS

*All 350 pieces visible simultaneously (camera scale < 0.5). Measured while idle (not dragging).*

| Measurement | Value | Threshold | Status |
|---|---|---|---|
| **p50 (median)** | [ fps ] | ≥ 55fps | [ ] |
| **p05 (5th pct)** | [ fps ] | ≥ 45fps | [ ] |
| Sample count | [ n ] | ≥ 10 | [ ] |

**How to read:** Pinch to zoom out until all pieces are visible, then hold still for ≥ 30 seconds. Tap **LOG REPORT** — look for `C5: Zoomed-out FPS`.

---

## Overall verdict

| Criterion | Status |
|---|---|
| C1 Generation | ✅ PASS (CI-verified) |
| C2 Rasterization | [ PASS / FAIL ] |
| C3 Memory | [ PASS / FAIL ] |
| C4 Drag FPS | [ PASS / FAIL ] |
| C5 Zoomed-out FPS | [ PASS / FAIL ] |
| **GATE-001** | **[ PASS / FAIL ]** |

---

## If any criterion fails — smallest fixes

### C2 fails (rasterization too slow / hangs)
- **Reduce chunk size** from 8 to 4 or 2 to yield more often (less smooth progress bar, same total time).
- **Cap source resolution**: downscale the source image before baking. At max zoom 5×, useful resolution per cell is `cellW × 5 × devicePixelRatio` pixels. Anything above that is wasted.
- **Pre-warm**: start rasterizing in the background during the puzzle selection screen.

### C3 fails (OOM or > 400MB)
- **Source resolution cap** (same as above) — this is the primary texture memory lever.
- **Lazy textures**: only rasterize pieces within 2× the viewport; evict pieces that leave view.
- Fallback: **texture atlas** — pack all cells into one large SkImage (eliminates per-surface overhead).

### C4 fails (drag FPS < target)
- **Root cause check**: use the FPS overlay to confirm it drops specifically during drag, not globally. If global, see C5 fix.
- The drag overlay renders only the dragged group's pieces at a `useDerivedValue` transform — there should be no React re-renders. If FPS is low, suspect Skia overdraw from the main-layer groups.
- **Fix**: hide non-visible groups more aggressively during drag (increase culling margin); or composite settled multi-piece groups into single textures.

### C5 fails (zoomed-out FPS < target)
- All 350 pieces are drawn every frame. The Skia canvas repaints fully.
- **Fix 1**: impose a max visible-piece limit (e.g. 200). Pan/zoom reveals pieces progressively.
- **Fix 2**: region compositing — at zoom < 0.3, bake clusters of already-snapped pieces into a single larger texture, reducing draw calls.
- **Fix 3**: LOD — use a single low-res preview image at extreme zoom-out, switch to pieces as the user zooms in.

---

## Raw console output

```
[ paste output of LOG REPORT here ]
```
