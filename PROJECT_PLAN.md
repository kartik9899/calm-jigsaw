# PROJECT_PLAN.md — Calm Premium Jigsaw

**Status:** active build plan
**Stack (fixed):** React Native · Expo · TypeScript · Expo Router · @shopify/react-native-skia · react-native-reanimated · react-native-gesture-handler · Zustand · MMKV
**Mode:** offline-first, no backend, ~$0 run cost, MVP-only
**Companion docs:** PRD v0.1, UX Spec v0.1, Tech Spec v0.1, Review v0.1, Stack Migration v0.2

---

## 1. What we're building (one paragraph)

A calm, premium jigsaw puzzle app for adults. Beautiful curated images, buttery-smooth pieces, zero clutter, no interruptions during a solve. MVP ships **free and offline** with one bundled pack; its only job is to prove the solve *feels* premium and that people complete puzzles. Monetization (ads, then IAP) layers on **after** the engine is proven.

---

## 2. Locked decisions

- **Piece caps:** **24 / 96 / 350**. **350 is the hard maximum for now.** No 500+.
- **Renderer:** Skia canvas for the board *only*. Plain RN `<View>` sprites are forbidden for pieces.
- **Input:** gesture-handler + Reanimated, on the UI thread.
- **State:** Zustand; live drag transform in Reanimated shared values; Zustand `SolveState` is authoritative, reconciled on snap/merge/idle/background.
- **Persistence:** MMKV (settings + save blobs as JSON). `expo-sqlite` only if saves outgrow KV.
- **Core logic:** pure TypeScript in `src/core`, no native imports, fully unit-tested.
- **Generation:** seed-based, deterministic via an owned PRNG (mulberry32). Persist seed, regenerate geometry on resume.
- **No backend, no ads SDK, no IAP SDK in MVP.** Ads/IAP interfaces are stubbed behind types now.
- **Workflow:** Expo prebuild + **custom dev client** (EAS dev build or `expo run`). **Not Expo Go** (Skia/Reanimated/MMKV are native).

---

## 3. Principles (how we decide what to build)

1. **Feel before features.** A great solve engine with rough menus can ship and be loved; the reverse cannot.
2. **Prove the hard thing early.** The M2 gate (350 pieces on a real mid device) precedes the feature shell.
3. **Pure core, thin shell.** If logic can live in `src/core` without native imports, it does — that's where correctness and test coverage live.
4. **Defer infrastructure.** No server, no SDK, no account until something is *proven* to need it.
5. **Cost-to-result.** Every dependency is OSS/free; the only fixed costs are Apple ($99/yr) and Google ($25 once).

---

## 4. Architecture (summary)

```
app/        Expo Router screens (Home, Category, Puzzle Select, Gameplay, Gallery, Settings)
src/
  core/     PURE TS: generation/ solve/ save/ types  (Jest, no device)
  engine/   Skia + Reanimated board: JigsawCanvas, pieceTexture, camera, gestures
  state/    Zustand stores + MMKV persistence adapter
  content/  bundled pack manifest + asset loader
  ui/       shared components + theme tokens
  services/ ads/purchases/analytics INTERFACES (stubbed in MVP)
assets/     puzzles/ (bundled free pack), sfx/
__tests__/  Jest/Vitest over src/core
```

**Boundary rule:** nothing under `src/core` may import `react-native`, `@shopify/react-native-skia`, `react-native-reanimated`, or `expo-*`. Enforced by an ESLint `no-restricted-imports` rule.

**State seam:** during a drag, the active group's transform is a Reanimated shared value (UI thread, 60fps). On release/snap/merge/idle/app-background, write the committed state to the Zustand store; MMKV autosave is debounced off the store. On background mid-drag, discard the in-flight delta.

---

## 5. Milestones (MVP)

| Milestone | Outcome | Gate |
|---|---|---|
| **M0 Skeleton** | Navigable Expo app, dev client, routes, theme, Zustand+MMKV, Jest green, hello-Skia | CI runs core tests; app boots on device |
| **M1 Generation core** | Pure-TS deterministic cut + tests, no rendering | Determinism + interlock + aspect tests pass |
| **M2 Engine + GATE** | Solve a hard-coded puzzle satisfyingly | **350-piece gate (§6) passes on a real mid device** |
| **M3 Loop closure** | Full calm MVP loop: select → solve → complete → resume; tray + ghost; settings | Resume is exact; one bundled pack playable offline |
| **M4 Polish + ship** | States, haptics/sfx, perf pass, store assets | Perf gates hold at 350; store-review checklist green → **submit free MVP** |

**Post-MVP (only if validated):** M5 Ads (+ UMP/ATT consent), M6 IAP (remove-ads), then daily/streaks/packs/themes.

---

## 6. The M2 gate (binding)

Measured at **350 pieces on a real mid-range device** (not a simulator). All five must hold:

1. **Generation** — pure-TS cut at 350 completes without freezing the JS thread (chunked/yielding).
2. **Rasterization** — 350 piece textures bake within budget behind a "Preparing…" state; no visible hang.
3. **Drag** — dragging a piece/group holds ~60fps at 350.
4. **Memory** — texture + heap within a defined ceiling at 350; no OOM on a 3–4GB device.
5. **Zoomed-out overdraw** — all 350 pieces in view holds an acceptable frame rate.

**If any fails:** fix render strategy (region compositing, texture atlas, source-resolution cap, visible-piece limit) *at M2*. Do not build M3+ on an unproven engine.

---

## 7. Conventions

- **TypeScript strict** (`strict: true`). No `any` in `src/core`.
- **Tests:** `src/core` is the test target; aim for high coverage there, not on UI.
- **Commits per ticket** (see DEV_BACKLOG.md); each ticket has acceptance criteria.
- **No premature abstraction:** repository interfaces only where a test needs a fake (save, later ads/purchases).
- **Theme tokens only** for spacing/type/color (UX Spec §0). One accent, one type family.

---

## 8. Cost ledger

| Item | Cost |
|---|---|
| All libraries (Expo, Skia, Reanimated, gesture-handler, Zustand, MMKV, Jest) | $0 (OSS) |
| EAS Build | free tier, or build locally ($0) |
| Backend / servers (MVP) | $0 (none) |
| Apple Developer | $99/yr |
| Google Play | $25 one-time |
| **Content/imagery (licensing or AI-with-commercial-rights)** | **#1 real spend** |

---

*Read DEV_BACKLOG.md for the ordered ticket list, M0_M1_M2_Implementation_Plan.md for the near-term detail, and ClaudeCode_Prompts_M0_M1_M2.md for the runnable prompts.*
