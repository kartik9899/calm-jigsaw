# DEV_BACKLOG.md — Calm Premium Jigsaw (MVP)

**Order = implementation order.** Each ticket: ID · size (S ≤ ½ day, M ≈ 1–2 days, L ≈ 3–5 days) · depends-on · acceptance. Stack fixed per PROJECT_PLAN.md.

> Rule: do not start a ticket whose dependencies aren't done. Do not start M3 tickets until **GATE-001** passes.

---

## EPIC M0 — Skeleton

- **M0-01 · S · —** Init Expo + TypeScript app; enable `strict`. → app boots in dev client on a real device (not Expo Go).
- **M0-02 · S · M0-01** Add deps: expo-router, skia, reanimated, gesture-handler, mmkv, zustand. Configure config plugins; `expo prebuild`. → dev client builds with all native modules linked.
- **M0-03 · S · M0-01** ESLint + Prettier; add `no-restricted-imports` banning native imports inside `src/core`. → lint fails if `src/core` imports rn/skia/expo.
- **M0-04 · S · M0-02** Expo Router scaffold: `app/_layout.tsx`, `index` (Home), `category/[id]`, `puzzle/[id]`, `play/[id]`, `gallery`, `settings` (all placeholder). → navigation between empty screens works.
- **M0-05 · S · M0-01** Theme tokens (`src/ui/theme.ts`): spacing scale, type scale, light/dark color tokens, single accent. → tokens consumed by one sample screen.
- **M0-06 · S · M0-02** Zustand stores skeleton (`settingsStore`, `sessionStore`) + MMKV persistence adapter for settings. → toggling a setting persists across app restart.
- **M0-07 · S · M0-01** Jest config for `src/core` (node env) + one trivial passing test. → `npm test` green.
- **M0-08 · S · M0-02** Hello-Skia: a `<Canvas>` drawing one image + one path on `play/[id]`. → renders on device at 60fps.
- **M0-09 · S · M0-07** GitHub Actions CI: typecheck + lint + core tests on push. → CI green.

**M0 done when:** navigable shell, all native modules in a dev client, CI green, one Skia canvas renders.

---

## EPIC M1 — Generation core (pure TS, no rendering)

- **M1-01 · S · M0-07** `src/core/types.ts`: `EdgeType`, `EdgeSpec`, `PieceSpec`, `GeneratedPuzzle`, `Difficulty`, `SolveState`, `GroupState`. → compiles; exported.
- **M1-02 · S · M1-01** `prng.ts`: owned mulberry32 (seeded). → same seed ⇒ same sequence; test.
- **M1-03 · M · M1-02** `gridForDifficulty()`: map 24/96/350 → rows×cols nearest target with cell aspect ≈ image aspect. → unit tests for the 3 caps + non-square aspects.
- **M1-04 · M · M1-02** `edgeGrid.ts`: generate one `EdgeSpec` per interior line (knob/blank + jitter + size), border = flat. → shared edges complementary (test: piece right == inverse of neighbor left for all interior).
- **M1-05 · M · M1-04** `edgeCurve.ts`: build a piece path from 4 edges (flat = line, knob/blank = cubic-bézier tab), with tab overhang. → path is closed; tab bulges correct side; pure (no `dart:ui`/skia).
- **M1-06 · M · M1-03,M1-05** `generator.ts`: `generate({rows, cols, seed, imageAspect}) → GeneratedPuzzle` (PieceSpecs + cellSize + tabOverhang + correctPos per piece). PURE. → determinism test (same inputs ⇒ deep-equal output); different seed ⇒ different cuts.
- **M1-07 · S · M1-06** `unionFind.ts`: path-compression + union-by-size + `connected` + `groupCount`. → fuzz vs brute-force reference.
- **M1-08 · M · M1-06,M1-07** `snapResolver.ts`: neighbor-snap delta math; tolerance scales with zoom (`SNAP_PX / zoom`); closest-neighbor selection. → tests: snaps just inside tolerance, not just outside; closest wins.
- **M1-09 · S · M1-07** `completion.ts`: solved iff `groupCount === 1` (+ optional board tolerance). → test.
- **M1-10 · M · M1-06** `save/serialize.ts`: `SolveState ⇄ JSON`; store seed + group translations + singleton positions + unionParent[] + elapsed + hints. → round-trip test: serialize→deserialize→regenerate reproduces identical solvable state.

**M1 done when:** the full cut/snap/group/complete/save logic is correct and tested with **zero rendering**.

---

## EPIC M2 — Skia engine + GATE

- **M2-01 · M · M1-06, M0-08** `pieceTexture.ts`: clip source image to a piece path on a Skia offscreen surface → `makeImageSnapshot()` → cache `SkImage`. Bake subtle bevel. → one piece renders as a clean masked sprite.
- **M2-02 · M · M2-01** Chunked async rasterization of all pieces with yielding + a "Preparing…" state. → 350 pieces bake without freezing the JS thread.
- **M2-03 · M · M2-01** `camera.ts`: world↔screen transform; pan + pinch-zoom as Reanimated shared values; zoom centered on pinch midpoint. → smooth pan/zoom of a static scene.
- **M2-04 · L · M2-03, M1-08** `gestures.ts` + `JigsawCanvas.tsx`: gesture-handler composition — hit-test topmost piece (path.contains in piece-local); drag a piece/group on the UI thread; pan on empty space; drag beats pan. → drag/pan/zoom coexist correctly.
- **M2-05 · M · M2-04, M1-07** Group drag + merge: dragging moves a whole group (one translation); on release call `snapResolver`; on snap, `union` + align translation + settle animation (~140ms) + haptic + sfx hook. → two pieces snap & merge; group drags together.
- **M2-06 · S · M2-05, M1-09** Completion detection → fire a placeholder "solved" callback. → solving a hard-coded 24-piece puzzle triggers completion.
- **M2-07 · M · M2-04** Viewport culling + only-moving-group redraw; scatter pieces into safe zones (avoid notch/home-indicator). → static pieces don't re-rasterize; off-view pieces skipped.
- **GATE-001 · L · M2-02..M2-07** **The 350 gate** on a real mid-range device: (1) generation, (2) rasterization, (3) drag ~60fps, (4) memory ceiling/no OOM, (5) zoomed-out overdraw. Record p50/p05 frame times + peak memory. → **all five pass at 350, or render strategy is revised here.**

**M2 done when:** you can satisfyingly solve a hard-coded puzzle AND **GATE-001 passes at 350**.

---

## EPIC M3 — Loop closure (MVP playable) — *blocked until GATE-001*

- **M3-01 · M** Puzzle Selection screen: large image preview + 24/96/350 difficulty pills + Start/Resume CTA.
- **M3-02 · M** Wire Start → generate → rasterize → enter Gameplay with scatter-from-preview transition.
- **M3-03 · M** Save/resume via MMKV: debounced autosave + forced save on background/pause/quit; resume rebuilds exact state from seed.
- **M3-04 · M** Home: Continue card (if save exists) + bundled collection rail; Settings/Gallery entry.
- **M3-05 · M** Completion screen: baked-image dissolve reveal (not per-piece) + quiet success line + "Next / Back".
- **M3-06 · M** **Piece tray + ghost outline** (UX-1 fix): pinned tray for unplaced pieces + "gather" action + optional faint solved-grid outline.
- **M3-07 · S** Pause sheet: sound/haptics/reduced-motion toggles, Resume, Restart (confirm), Quit-to-Home.
- **M3-08 · S** Reference-image toggle in Gameplay.
- **M3-09 · S** Limited free hint (highlight a piece's slot).
- **M3-10 · S** Reduced-motion baseline (dissolve → crossfade; no settle overshoot).
- **M3-11 · S** First-run gesture coaching (skippable, ≤3 contextual tips).

**M3 done when:** full offline loop works end-to-end with one bundled pack; resume is exact.

---

## EPIC M4 — Polish + ship

- **M4-01 · M** Designed empty/loading/offline/error states across screens.
- **M4-02 · M** Haptics + sfx pass (pickup, snap, merge, complete; respect toggles).
- **M4-03 · L** Perf pass on real low/mid devices; finalize behavior at 350; region-compositing if needed.
- **M4-04 · S** Local analytics counters (no SDK): puzzles started/completed, durations — stored in MMKV for self-review.
- **M4-05 · M** Store assets: icon, screenshots, listing copy, age rating, privacy policy link.
- **M4-06 · S** Store-review checklist: no ads, honest content, privacy linked, age set.

**M4 done when:** perf gates hold at 350 and the store-review checklist is green → **submit free MVP**.

---

## Post-MVP (not started until MVP validates)

- **M5 — Ads:** `react-native-google-mobile-ads` + **UMP/ATT consent** + capped interstitial on Completion.
- **M6 — IAP:** `react-native-purchases` remove-ads + entitlement gating.
- **M7+ —** daily/streaks, premium packs (CDN manifest), themes, etc.

---

## Critical path
`M0-01→02 → M1-06 → M2-01→02→04→05 → GATE-001 → M3 → M4`. Everything gates on **GATE-001**.
