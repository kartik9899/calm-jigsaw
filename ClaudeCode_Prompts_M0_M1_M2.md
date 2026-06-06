# Claude Code Prompts — M0 / M1 / M2

**How to use:** run these in order in Claude Code from an empty project directory. Each prompt is self-contained, states the fixed stack, and ends with acceptance criteria. Do **not** start the M2 prompt until M1's tests pass; do not build beyond M2 until the 350 gate passes.

**Fixed stack (state it every time):** React Native · Expo (dev client, not Expo Go) · TypeScript (strict) · Expo Router · @shopify/react-native-skia · react-native-reanimated · react-native-gesture-handler · Zustand · MMKV. Offline-first, no backend, no ads/IAP SDKs.

> Note for the model running these: verify current package versions/APIs against the installed Expo SDK at build time — pin to whatever is compatible with the project's Expo version rather than assuming.

---

## PROMPT — M0 (Skeleton)

```
You are my lead RN engineer. Set up the skeleton for a calm premium jigsaw app.

FIXED STACK (do not substitute): React Native + Expo with a custom DEV CLIENT (NOT Expo Go),
TypeScript with "strict": true, Expo Router (file-based), @shopify/react-native-skia,
react-native-reanimated, react-native-gesture-handler, react-native-mmkv, Zustand.
Offline-first. No backend. No ads or IAP SDKs. Verify package versions against the installed
Expo SDK; don't assume versions.

Do this:
1. Initialize an Expo TypeScript app; set tsconfig strict: true.
2. Install and configure: expo-router, @shopify/react-native-skia, react-native-reanimated
   (add its babel plugin LAST), react-native-gesture-handler (wrap root in
   GestureHandlerRootView), react-native-mmkv, zustand. Configure for a dev client via
   expo prebuild. Explain the one command I run to launch on a real device.
3. Add ESLint + Prettier. Add a no-restricted-imports rule that FORBIDS importing
   "react-native", "@shopify/react-native-skia", "react-native-reanimated", or anything
   starting with "expo" inside src/core/**. This boundary is critical.
4. Create Expo Router routes as placeholders: app/_layout.tsx, app/index.tsx (Home),
   app/category/[id].tsx, app/puzzle/[id].tsx, app/play/[id].tsx, app/gallery.tsx,
   app/settings.tsx. Navigation between them must work.
5. Create src/ui/theme.ts: spacing scale (4/8/12/16/24/32/48/64), type scale, light/dark
   color tokens, ONE muted accent. Apply tokens to the Home placeholder.
6. Create src/state/settingsStore.ts (Zustand) persisted to MMKV (sound, haptics,
   reducedMotion booleans). Create an empty src/state/sessionStore.ts.
7. Configure Jest to run tests in src/core with a node environment; add src/core/__tests__/
   smoke.test.ts that passes.
8. In app/play/[id].tsx, render a Skia <Canvas> that draws one bundled image and one Path
   (hello-Skia) at 60fps.
9. Add a GitHub Actions workflow running typecheck + lint + jest on push.

ACCEPTANCE:
- App boots on a real device via dev client; I can navigate between all placeholder screens.
- Toggling a setting persists across an app restart (MMKV).
- The Skia canvas renders the image + path.
- `npm test` is green; CI passes typecheck + lint + tests.
- Lint FAILS if I add a react-native import inside src/core.

Give me the file tree, the key files in full, and the exact run/build commands. Keep it minimal —
no game logic yet.
```

---

## PROMPT — M1 (Generation core, pure TypeScript)

```
Continue the jigsaw app. Build the ENTIRE puzzle logic core in pure TypeScript under src/core,
with NO react-native / skia / reanimated / expo imports, and full unit tests. No rendering.

Same fixed stack as before. This milestone is logic + tests only.

Create these files in src/core:

types.ts
  - EdgeType = 'flat' | 'knob' | 'blank'
  - EdgeSpec { type: EdgeType; jitter: number; size: number }  // jitter -1..1, size ~0.18..0.22
  - PieceSpec { index; row; col; edges: {top,right,bottom,left: EdgeSpec};
                correctPos: {x,y}; pathCommands: PathCmd[] }   // PathCmd is plain data, NOT a Skia Path
  - GeneratedPuzzle { pieces: PieceSpec[]; rows; cols; cellW; cellH; tabOverhang }
  - Difficulty enum/const for 24 | 96 | 350  (350 is the hard max)
  - SolveState, GroupState (root, translation {x,y}, rotationRad=0)

generation/prng.ts
  - Owned mulberry32(seed:number): () => number. Deterministic. Do NOT use Math.random.

generation/grid.ts
  - gridForDifficulty(count:number, imageAspect:number): {rows, cols}
    Choose rows*cols nearest `count` with cell aspect (cellW/cellH) closest to imageAspect.

generation/edgeGrid.ts
  - Generate ONE EdgeSpec per interior grid line (random knob/blank + jitter + size from the PRNG);
    border lines are flat. Each piece reads its 4 edges; the shared edge is the SAME physical edge,
    so a piece's edge must be the exact inverse (knob<->blank) of its neighbor's shared edge.

generation/edgeCurve.ts
  - Pure function turning one edge (start, end, EdgeSpec, outward normal) into PathCmd[] data:
    flat = a line; knob/blank = a line with a centered cubic-bezier tab (offset by jitter,
    bulging out for knob / in for blank). Emit DATA, not a Skia object.

generation/generator.ts
  - generate({rows, cols, seed, imageAspect}): GeneratedPuzzle. PURE: identical inputs => deep-equal output.
    Assembles edges, builds each piece's pathCommands and correctPos = (col*cellW, row*cellH).

solve/unionFind.ts
  - PieceUnionFind(n): find (path compression), union (by size), connected, groupCount.

solve/snapResolver.ts
  - resolveSnap(group, allGroups, zoom): neighbor-snap. For piece a in group G and grid-neighbor b
    in a different group H, delta = G.translation - H.translation. snapTolerance = SNAP_PX / zoom
    (SNAP_PX ~ 22). If |delta| <= tolerance, return a merge intent toward the larger group.
    On multiple candidates, pick the smallest |delta|.

solve/completion.ts
  - isSolved(unionFind): groupCount === 1.

save/serialize.ts
  - serialize(SolveState): string and deserialize(string): SolveState. Persist seed, rows, cols,
    group translations, singleton positions, unionParent[], elapsedMs, hintsUsed.

TESTS (src/core/__tests__) — these are the deliverable:
  - determinism: generate twice => deep-equal; different seed => different cut.
  - interlock: for every interior edge, piece edge == inverse of neighbor's shared edge.
  - grid: 24/96/350 give sensible rows*cols; aspect close to imageAspect; test a wide/tall image.
  - unionFind: fuzz against a brute-force reference; groupCount equals distinct roots.
  - snap: snaps just inside tolerance, not just outside; tolerance scales with zoom; closest wins.
  - completion: true only when one group.
  - save round-trip: serialize -> deserialize -> regenerate reproduces identical solvable state;
    placed-piece count preserved.

ACCEPTANCE:
- All core tests pass in CI.
- No file under src/core imports any native module (lint enforces this).
- edgeCurve/generator emit path-command DATA; Skia is never imported in core.

Give me each file in full plus the tests. Prioritize correctness and readable pure functions.
```

---

## PROMPT — M2 (Skia engine + the 350 gate)

```
Continue the jigsaw app. Build the Skia + Reanimated solve engine that consumes the pure core
from M1, and PROVE it holds up at 350 pieces on a real mid-range device. This is the make-or-break
milestone; gate criteria are mandatory.

Same fixed stack. The core (generation/snap/unionFind/completion/serialize) already exists and is
tested — import it; do not reimplement logic in the engine.

Build under src/engine:

pieceTexture.ts
  - Convert a PieceSpec's pathCommands into a Skia SkPath.
  - Clip the source image to that path on an OFFSCREEN Skia surface; makeImageSnapshot() -> cache SkImage.
  - Source rect = cell rect expanded by tabOverhang. Bake a subtle bevel/edge-light.
  - Provide chunked async rasterization that bakes pieces in batches, YIELDING to the event loop,
    so 350 pieces never freeze the JS thread. Surface a "Preparing..." progress state.

camera.ts
  - world<->screen transform driven by Reanimated shared values. Pan + pinch-zoom; zoom centered on
    the pinch midpoint; gentle momentum pan (no bounce).

gestures.ts + JigsawCanvas.tsx
  - react-native-gesture-handler composition: hit-test topmost piece (point-in-path, piece-local),
    drag the piece/group on the UI thread; pan board on empty space; DRAG BEATS PAN; two-finger = zoom.
  - A group is rendered as members at correctPos + group.translation. Dragging updates ONE translation.
  - On release, call core resolveSnap; on a merge intent, union + align translation + ~140ms ease-out
    settle + a haptic hook + an sfx hook. Disable settle overshoot under reducedMotion.
  - On completion (core isSolved), fire a placeholder onSolved callback.

perf:
  - Viewport culling (skip pieces fully outside the camera view).
  - Only the moving group redraws; settled/static pieces are unchanged cached sprites.
  - Scatter pieces into safe zones (avoid notch / home-indicator).
  - Add an FPS sampler (p50, p05) and a peak-memory readout for the gate.

GATE-001 (MANDATORY) — measure at 350 pieces on a REAL mid-range device, not a simulator:
  1. Generation: pure-TS cut at 350 completes without freezing the JS thread.
  2. Rasterization: 350 textures bake within budget behind "Preparing..." with no visible hang.
  3. Drag: dragging a piece/group holds ~60fps.
  4. Memory: textures + heap within a defined ceiling; no OOM on a 3-4GB device.
  5. Zoomed-out overdraw: all 350 pieces in view holds an acceptable frame rate.
  Report p50/p05 frame times and peak memory for each.
  If ANY fails, implement a render fix HERE and re-measure: region-composite settled clusters into a
  single texture, use a texture atlas, cap source resolution (downscale to what max-zoom shows), or
  limit simultaneously-visible loose pieces. Do not proceed past M2 until all five pass at 350.

DE-RISK FIRST (before the rest of M2): pieceTexture + chunked rasterization at 350, and the
zoomed-out draw of 350 sprites. If either is shaky, I want to know within days.

ACCEPTANCE:
- I can satisfyingly solve a hard-coded puzzle: generous snap, smooth drag, groups merge and move together.
- GATE-001 passes at 350 on a real mid device, with recorded p50/p05 + peak memory.
- The engine imports core logic; it does not duplicate it.

Give me each engine file in full, the gate measurement harness, and the numbers from a real device run.
```

---

## After M2
Only once GATE-001 passes: proceed to M3 (loop closure) per DEV_BACKLOG.md. If the gate forced a render-strategy change, update PROJECT_PLAN.md §6 and the Tech direction before continuing.
