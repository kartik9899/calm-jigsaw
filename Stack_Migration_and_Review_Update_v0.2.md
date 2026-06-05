# Stack Migration & Review Update — Calm Premium Jigsaw

**Version:** 0.2 (addendum)
**Supersedes:** the Flutter + Flame technical direction in PRD/UX/Tech v0.1 and the Review v0.1
**New official stack:** React Native · Expo · TypeScript · Expo Router · Zustand · MMKV · offline-first · no backend in MVP · ads/IAP deferred · ~$0 run cost
**Mandate carried over:** ship a polished, calm MVP with the best cost-to-result ratio for a solo founder.

> What survives the reset: the single best architectural idea in the v0.1 docs — a **pure logic core with no UI/engine imports**, with a thin renderer on top. It ports directly from "pure Dart domain" to "pure TypeScript core," and is *easier* in TS. Everything else re-maps below.

---

## 1. Stack mapping (old → new)

| Concern | v0.1 (Flutter) | v0.2 (React Native + Expo) | Notes |
|---|---|---|---|
| App framework | Flutter | React Native + **Expo** | Managed workflow + config plugins + **EAS Build / dev client** (not Expo Go — see §2) |
| Language | Dart | **TypeScript** | Pure-TS core is unit-testable with Jest/Vitest, no device |
| Solve canvas | Flame (game loop) | **@shopify/react-native-skia** | GPU canvas; draw images clipped to piece paths; offscreen rasterize to `SkImage` |
| Input/gestures | Flame gesture arena | **react-native-gesture-handler + react-native-reanimated** | Pan/pinch/drag composition on the **UI thread** — better than Flame here |
| State | Riverpod | **Zustand** (+ persist middleware) | Lighter, AI-friendly |
| Local persistence | Isar/Hive | **react-native-mmkv** | Fast KV for settings + small save blobs (JSON, a few KB). `expo-sqlite` only if saves grow |
| Navigation | stack router | **Expo Router** (file-based) | Tab-less still possible via route layout |
| IAP | RevenueCat (Dart) | `react-native-purchases` | **Deferred** until monetization is proven |
| Ads | AdMob (Dart) | `react-native-google-mobile-ads` | **Deferred** until app is playable |
| Backend | Firebase/Supabase (v1) | **none** in MVP | Bundled content; seed-based local generation |

**The one non-negotiable technical call:** the board is **Skia**, not RN `<View>`s. Hundreds of masked draggable image-Views will not hold 60fps — wrong tool. Skia gives a real GPU canvas with image-clip-to-path and a render loop. This is the realistic premium-feel path in RN.

---

## 2. Expo reality check (cost + workflow)

- **Skia, Reanimated, gesture-handler, and MMKV are native modules** → you cannot use **Expo Go**. You use Expo's prebuild + a **custom dev client** (EAS dev build or `expo run:[ios|android]`). Still the Expo managed workflow with config plugins — just not the Go sandbox. This is standard and free.
- **Running cost stays ~$0:** all libraries are OSS; no servers in MVP; EAS Build has a free tier (or build locally for $0). Ads/IAP are revenue-share, not fixed cost, and arrive post-MVP.
- **Unavoidable fixed costs:** Apple Developer **$99/yr**, Google Play **$25 one-time**. Everything else is content.
- **The real spend is still content** (licensed/commissioned/AI-with-commercial-rights imagery) — unchanged from v0.1, and still your #1 budget line.

---

## 3. Updated architecture

```
┌──────────────────────────────────────────────┐
│ PRESENTATION                                   │
│  • Expo Router screens (Home, Category, …)     │
│  • Skia <Canvas> board (Gameplay only)         │
│  • Reanimated shared values (live drag/zoom)   │
│  • Zustand stores (app + session state)        │
└───────────────▲────────────────────────────────┘
                │ reads selectors / dispatches
┌───────────────┴────────────────────────────────┐
│ CORE (pure TypeScript — NO rn/skia/expo imports)│
│  • generation (grid, edges, seeded PRNG)        │
│  • solve (snapResolver, unionFind, completion)  │
│  • save (serialize / deserialize SolveState)    │
│  • types                                        │
└───────────────▲────────────────────────────────┘
                │ used by
┌───────────────┴────────────────────────────────┐
│ SERVICES / DATA                                 │
│  • MMKV (settings, saves)                       │
│  • content (bundled pack manifest + loader)     │
│  • (later) ads, purchases, analytics — stubbed  │
│    behind interfaces now, no SDKs in MVP        │
└─────────────────────────────────────────────────┘
```

**State-ownership seam (was domain/Flame; now core/Reanimated):**
During a drag, the piece/group transform lives in a **Reanimated shared value on the UI thread** (60fps, no bridge crossing). The **Zustand `SolveState` is authoritative** and is reconciled on snap / merge / idle / app-background. On background mid-drag, discard the in-flight delta and revert to the last committed state. This is the same ARCH-1 contract from the review, restated for this stack — specify it crisply and write one test.

### Folder structure
```
app/                       # Expo Router (file-based routes)
  _layout.tsx
  index.tsx                # Home
  category/[id].tsx
  puzzle/[id].tsx          # selection (difficulty)
  play/[id].tsx            # Gameplay — hosts the Skia canvas
  gallery.tsx
  settings.tsx
src/
  core/                    # PURE TS — unit-tested, no native imports
    generation/            # generator.ts, edgeCurve.ts, prng.ts
    solve/                 # snapResolver.ts, unionFind.ts, completion.ts
    save/                  # serialize.ts
    types.ts
  engine/                  # Skia + Reanimated renderer (board only)
    JigsawCanvas.tsx
    pieceTexture.ts        # offscreen Skia rasterization → SkImage
    camera.ts              # world↔screen transform
    gestures.ts            # gesture-handler composition
  state/                   # Zustand stores + MMKV persistence adapter
  content/                 # bundled pack manifest + asset loader
  ui/                      # shared components + theme tokens
  services/                # ads/purchases/analytics INTERFACES (stubbed in MVP)
assets/
  puzzles/                 # bundled free pack
  sfx/
__tests__/                 # Jest/Vitest over src/core
```

**Rule (unchanged in spirit):** anything importing `react-native`, `@shopify/react-native-skia`, or `expo-*` lives outside `src/core`. The core stays pure so the hard logic is tested with zero device.

### Generation/snap/grouping specifics that change
- **PRNG:** JS `Math.random` isn't seedable → ship a tiny owned PRNG (mulberry32 / xorshift) in `core/generation/prng.ts`. This gives shape-identical regeneration from `seed` and clean cross-platform determinism — resolves the over-promise from review TECH-2.
- **Rasterization:** generate piece *paths* + cell data in pure TS (cheap), then clip the source image to each path on a Skia **offscreen surface** → `makeImageSnapshot()` → cache the `SkImage`. Draw sprites thereafter. Mirrors the v0.1 pre-rasterize plan.
- **Union-find / snap math:** unchanged — pure TS, identical algorithms.
- **Save:** serialize `{ puzzleId, rows, cols, seed, group translations, singleton positions, unionParent[], elapsedMs, hintsUsed }` to a JSON string in MMKV. Tiny. Regenerate geometry from seed on resume.

---

## 4. Updated risk assessment (deltas vs Review v0.1)

| ID | Risk | Change | New severity | Note / mitigation |
|---|---|---|---|---|
| **NEW-RN1** | Generation/rasterization blocks the single JS thread (no isolates) | **New** | **High** | Conservative MVP caps; chunked async generation that yields to the event loop behind "Preparing…"; keep heavy pixel work in native Skia, not JS loops |
| **NEW-RN2** | Skia sprite/overdraw ceiling at high counts less proven than a game engine | **New** | **Med-High** | 350 is the hard cap; composite settled regions; the M2 gate must prove 350 on a real mid device before any further build |
| TECH-3 | Gesture/camera arbitration | **Lowered** | **Low-Med** | gesture-handler + Reanimated handle pan/pinch/drag composition cleanly on the UI thread |
| TECH-4 | Persistence layer maturity (was Isar) | **Lowered** | **Low** | MMKV is simple/proven; `expo-sqlite` as fallback if saves grow |
| TECH-2 | Determinism not stable | **Lowered** | **Low** | Owned PRNG in TS; deterministic per platform |
| MISS-1 | Ads consent/CMP (UMP/ATT) | **Moved** | n/a for MVP | Ads are post-playable → consent becomes a gating requirement at the **ads milestone**, not MVP |
| TECH-1 | Off-thread image handoff | **Reframed** | folded into NEW-RN1 | RN has no isolate handoff problem, but also no isolates — different shape, same "don't block the thread" goal |
| **Unchanged (still the real risks):** MON-1 (economics unmodeled), RET-1 (solo content treadmill), UX-1/MISS-3 (piece-finding at high counts) | — | **High** | These are stack-independent and remain the top product risks |

**Net:** the stack swap **lowers** infra/gesture/persistence risk and **raises** the JS-thread/render-ceiling risk. For a *calm* app with modest MVP piece counts, that trade is favorable. The engine spike (below) is now even more the make-or-break.

---

## 5. Revised MVP scope (this stack, MVP-only focus)

**In:** core Skia solve engine (smooth drag, generous snap, grouping, pan/zoom); **piece tray + ghost outline** (the UX-1 fix — kept in MVP); 3 difficulties — **24 / 96 / 350** (**350 is the hard maximum for now**; 500+ deferred entirely); reference toggle; basic limited hint; save/resume via MMKV + Continue card; offline; 1 bundled free pack (~10–15 images); calm completion (baked-image dissolve, not per-piece animation); settings (sound/haptics); reduced-motion baseline; first-run gesture coaching (skippable); light **local** analytics counters (no SDK).

**Out of MVP entirely (per stack rules):** AdMob, RevenueCat, premium packs, daily/streaks, cloud anything, themes beyond one, custom photos, rotation, subscription. No monetization ships in MVP — **MVP's only job is to prove the calm solve feels premium and that people complete puzzles.**

**Consequence to be honest about:** "earn small but real money" begins at the **post-playable monetization milestone**, not at MVP launch. MVP ships **free** to validate feel + retention signal, then ads/IAP layer on once the engine is proven.

---

## 6. Revised build order (MVP-only, RN/Expo)

**M0 — Skeleton.** Expo app, prebuild + **dev client**, Expo Router routes (empty screens), theme tokens, Zustand + MMKV wired, Jest running one passing `core` test, one "hello Skia canvas". → navigable shell.

**M1 — Generation core (pure TS).** `generator` + `edgeCurve` + owned `prng` + determinism/interlock tests. No rendering. → tested cut logic, zero UI risk.

**M2 — Skia engine + GATE (the make-or-break).** Rasterize pieces to `SkImage`s; scatter; Reanimated pan/zoom + gesture-handler drag; snap resolver + union-find + group drag + merge + completion. **Do not pass M2 until the gate clears, measured at 350 pieces on a real mid-range device:**
  1. **Generation** — pure-TS cut at 350 completes without freezing the JS thread (chunked async);
  2. **Rasterization** — 350 piece textures bake within budget behind "Preparing…" (no visible hang);
  3. **Drag** — dragging a piece/group holds **~60fps** at 350;
  4. **Memory** — total texture + heap stays within a defined ceiling at 350 (no OOM on a 3–4GB device);
  5. **Zoomed-out overdraw** — fitting all 350 pieces in view holds an acceptable frame rate.
  *If any of the five fails at 350, you fix the render strategy here — before building the app on top of it. 350 is the design target; the gate proves it or forces a change at this milestone, not at ship.*

**M3 — Loop closure (MVP playable).** Puzzle selection (difficulty), completion reveal, save/resume + Continue card, settings, the bundled pack, **piece tray + ghost outline**, reduced-motion. → full calm loop, offline, free, no money.

**M4 — MVP polish + ship.** Empty/loading/offline/error states, haptics/sfx pass, perf pass on real low/mid devices + finalize piece caps, store assets, local analytics counters. **Submit free MVP.**

**(Post-MVP, gated on validation — not part of MVP)**
**M5 — Ads:** `react-native-google-mobile-ads` + **UMP/ATT consent** (the deferred MISS-1, now required here), interstitial on Completion with frequency cap.
**M6 — IAP:** `react-native-purchases` remove-ads + entitlement gating.
**M7+ —** daily/streaks, packs, themes, etc., per the original roadmap, only as revenue/retention justify.

**Sequencing logic (unchanged and reinforced):** prove the *feel* (M1–M2) before the feature shell. On this stack the M2 gate matters even more, because the render ceiling — not the architecture — is the open question.

---

## 7. Cost-to-result summary

- **MVP run cost:** ~$0 (no backend, OSS libs, local content). Fixed: Apple $99/yr + Google $25 once.
- **Biggest spend:** content/imagery rights — unchanged, still #1.
- **Money arrives** at M5–M6, after the engine is proven and the app is playable — consistent with "build only what helps it ship and earn small real money."
- **Best-value decisions for a solo founder on this stack:** pure-TS testable core (cheap correctness), Skia-only-on-board (right perf tool, free), gesture-handler/Reanimated (UI-thread input, free), MMKV (zero-infra persistence), defer all paid/infra surfaces until validated.

---

*End of v0.2 addendum. The earlier PRD/UX strategy and the product-level review findings (economics, content treadmill, piece-finding UX) still stand; only the technical direction and risk weighting change. Recommended next deliverable: M0–M2 implementation prompts for the RN/Expo + Skia core and engine spike.*
