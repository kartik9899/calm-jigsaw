# M0 / M1 / M2 Implementation Plan — Calm Premium Jigsaw

**Scope:** the first three milestones only — skeleton, pure-TS generation core, and the Skia engine with the 350-piece gate.
**Stack (fixed):** RN · Expo · TypeScript · Expo Router · Skia · Reanimated · gesture-handler · Zustand · MMKV. Offline-first, no backend, no ads/IAP SDKs.
**Reference:** PROJECT_PLAN.md (decisions), DEV_BACKLOG.md (tickets).

---

## M0 — Skeleton

**Goal:** a navigable Expo app running in a custom dev client, all native modules linked, CI green, one Skia canvas rendering. No game logic yet.

**Build:**
1. `create-expo-app` with the TypeScript template; set `tsconfig` `strict: true`.
2. Install: `expo-router`, `@shopify/react-native-skia`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-mmkv`, `zustand`. Add Reanimated's Babel plugin; wrap the app root in `GestureHandlerRootView`. Run `expo prebuild` and launch via **dev client** (`expo run:ios` / `expo run:android` or an EAS dev build). **Not Expo Go.**
3. ESLint + Prettier; add `no-restricted-imports` forbidding `react-native`, `@shopify/react-native-skia`, `react-native-reanimated`, `expo*` inside `src/core/**`.
4. Expo Router routes (placeholders): `app/_layout.tsx`, `index.tsx` (Home), `category/[id].tsx`, `puzzle/[id].tsx`, `play/[id].tsx`, `gallery.tsx`, `settings.tsx`.
5. `src/ui/theme.ts`: spacing/type/color tokens + one accent; light/dark.
6. `src/state/`: `settingsStore` (Zustand) + MMKV persistence adapter; `sessionStore` placeholder.
7. Jest config targeting `src/core` (node environment) + one passing test.
8. `app/play/[id].tsx`: a Skia `<Canvas>` drawing one image + one path (hello-Skia).
9. GitHub Actions: typecheck + lint + `src/core` tests on push.

**Definition of done:** app boots on a real device via dev client; can navigate between empty screens; a setting persists across restart; Skia canvas renders; CI green.

**Watch:** Reanimated Babel plugin must be **last** in the plugin list. MMKV/Skia confirm the dev client picked up native modules (they won't work in Expo Go — expected).

---

## M1 — Generation core (pure TypeScript, no rendering)

**Goal:** the entire cut / snap / group / completion / save logic, correct and unit-tested, with **zero rendering** and zero native imports. This is where correctness is cheap.

**Files (all in `src/core`):**
- `types.ts` — `EdgeType` (`flat|knob|blank`), `EdgeSpec` (type, jitter, size), `PieceSpec` (index, row, col, edges, correctPos), `GeneratedPuzzle`, `Difficulty` (24/96/350), `SolveState`, `GroupState`.
- `generation/prng.ts` — owned **mulberry32**; seeded; deterministic.
- `generation/grid.ts` — `gridForDifficulty(count, imageAspect)` → `{rows, cols}` nearest target with cell aspect ≈ image aspect.
- `generation/edgeGrid.ts` — one `EdgeSpec` per interior line; borders flat; neighbors read complementary polarity.
- `generation/edgeCurve.ts` — pure path description for one edge (flat = line; knob/blank = cubic-bézier tab offset by jitter). Emits **path commands as data** (not a Skia `Path`), so the core stays pure; the engine turns commands into a Skia path.
- `generation/generator.ts` — `generate({rows, cols, seed, imageAspect})` → `GeneratedPuzzle`. **Pure**: same inputs ⇒ deep-equal output.
- `solve/unionFind.ts` — path compression + union by size + `groupCount`.
- `solve/snapResolver.ts` — neighbor-snap delta math; `snapTolerance = SNAP_PX / zoom`; closest-neighbor selection.
- `solve/completion.ts` — solved iff `groupCount === 1`.
- `save/serialize.ts` — `SolveState ⇄ JSON` (seed + group translations + singleton positions + `unionParent[]` + elapsed + hints).

**Tests (the bulk of the work):**
- Determinism: `generate` twice ⇒ deep-equal; different seed ⇒ different cut.
- Interlock: for every interior edge, piece's edge == inverse of neighbor's shared edge.
- Grid: 24/96/350 produce sensible rows×cols; aspect close to image aspect; non-square images handled.
- Union-find: fuzz vs brute-force reference; `groupCount` matches distinct roots.
- Snap: snaps just inside tolerance, not just outside; tolerance scales with zoom; closest neighbor wins.
- Completion: true only when one group.
- Save round-trip: serialize → deserialize → regenerate reproduces identical solvable state; placed-piece count preserved.

**Definition of done:** all core tests pass in CI; no file in `src/core` imports a native module.

**Key decision baked in:** `edgeCurve` emits **path-command data**, not a Skia object — this keeps generation testable in node and lets the engine (M2) build the actual `SkPath`. Don't leak Skia into core.

---

## M2 — Skia engine + the 350 GATE (make-or-break)

**Goal:** solve a hard-coded puzzle that *feels* premium, then **prove 350 pieces hold up on a real mid-range device.** If the gate fails, the render strategy changes here — before any feature is built on top.

**Build (in `src/engine`):**
1. `pieceTexture.ts` — build a `SkPath` from a `PieceSpec`'s path-command data; clip the source image to it on an **offscreen Skia surface**; `makeImageSnapshot()` → cache `SkImage`. Bake a subtle bevel/edge-light. Source rect = cell expanded by `tabOverhang`.
2. **Chunked async rasterization** — bake textures in batches that yield to the event loop, behind a "Preparing…" state. Never block the JS thread.
3. `camera.ts` — world↔screen transform driven by Reanimated shared values; pinch-zoom centered on the pinch midpoint; momentum pan with gentle deceleration.
4. `gestures.ts` + `JigsawCanvas.tsx` — gesture-handler composition: hit-test topmost piece (point-in-path in piece-local), drag the piece/group on the UI thread, pan on empty space, **drag beats pan**, two-finger → zoom.
5. Group drag + merge — a group is one translation; on release call core `snapResolver`; on snap, `union` + align translation + ~140ms settle + haptic + sfx hook.
6. Completion detection → placeholder callback.
7. **Perf scaffolding** — viewport culling (skip off-view pieces); only the moving group redraws; scatter pieces into safe zones (avoid notch/home-indicator); an FPS + memory sampler for the gate.

**GATE-001 (binding) — measured at 350 pieces on a real mid-range device:**
1. **Generation** completes without freezing the JS thread.
2. **Rasterization** of 350 textures stays within budget behind "Preparing…" (no visible hang).
3. **Drag** of a piece/group holds ~60fps.
4. **Memory** (textures + heap) within a defined ceiling; no OOM on a 3–4GB device.
5. **Zoomed-out overdraw** — all 350 pieces in view holds an acceptable frame rate.

Record p50/p05 frame times and peak memory for each. **All five pass, or apply a render fix at M2:** region-compositing of settled clusters into a single texture, a texture atlas, a source-resolution cap (downscale to what max-zoom can show), or a visible-loose-piece limit.

**Definition of done:** a hard-coded puzzle is satisfying to solve (generous snap, smooth drag) **and GATE-001 passes at 350.** Only then does M3 begin.

**Highest-risk items to de-risk first (do these before the rest of M2):**
- `pieceTexture` + chunked rasterization at 350 (NEW-RN1: JS-thread budget).
- Zoomed-out draw of 350 sprites (NEW-RN2: overdraw ceiling).
If either looks shaky, you'll know within days — which is the entire point of gating here.

---

## Sequencing note
M0 and M1 can overlap slightly (M1 is pure logic, independent of the shell). M2 depends on M1's `generator`/`snapResolver`/`unionFind` and M0's dev client + hello-Skia. **Nothing past M2 starts until GATE-001 passes.**
