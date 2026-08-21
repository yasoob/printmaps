# Mission findings

## 2026-08-21 — Mission initialized

- Research and implementation plan exist in the workspace.
- No app or git repository existed at mission start.
- User selected a Figma-like three-pane editor with a bottom Atlas-style tool palette.
- The current model has one print frame, not a page collection: no `Page 1` hierarchy belongs in the Layers sidebar. Layer order is changed by dragging left-sidebar handles; Duplicate/Delete live in the compact layer overflow menu. Hover will preview map content without selecting it; click remains the selection action.
- Every UI interaction must receive automated behavioral coverage as it is implemented.
- React Doctor is installed locally and required as a warning-blocking per-slice quality gate.
- Every autonomous run must deliver the latest 1440×900 UI screenshot at `docs/screenshots/latest-desktop.png`.
- UI constraints: minimal, tight, no gradients, no unnecessary shadows.
- A public Mapbox token is available in local untracked configuration; origin filtering may currently reject this deployment.
- Primary unresolved technical risks remain Mapbox display/storage terms, browser memory limits for large exports, and honest layered-export semantics.

## Evidence log

### 2026-08-21 — Vertical slice 1: editor shell and contextual selection

- Added React 19, TypeScript, Vite, TailwindCSS v4, MapLibre GL JS, Vitest and Playwright foundations.
- Added global design tokens in `src/theme.css`; `tests/unit/design-tokens.test.ts` prevents ad-hoc color literals in component CSS and requires Tailwind integration.
- Implemented a Figma-like 44px top bar, 240px Layers sidebar, full map canvas, 272px contextual properties sidebar, and compact bottom tool palette.
- Project properties are shown with no selection. Selecting `Route 01` from the layer tree switches to Layer properties; clicking the map clears selection.
- Live OpenFreeMap tiles render in Chromium/WebKit. Browsers without WebGL 2 receive an in-canvas fallback while the rest of the editor remains usable.
- Verified commands:
  - `npm run typecheck` — pass
  - `npm run lint` — pass
  - `npm run build` — pass (bundle-size warning remains)
  - `npm test -- --run` — 2 tests pass
  - `npm run test:e2e` — 6 tests pass across Chromium, Firefox and WebKit
- Screenshot evidence: `test-results/editor-desktop-editor-swit-334b3-roject-and-layer-properties-chromium/editor-desktop.png`.
- Screenshot review: core density/hierarchy is strong; next slice should dim map outside the print frame, prevent bottom toolbar/attribution overlap, and populate actual route/POI/shape canvas layers.
- The vendored Liberty style at `public/styles/liberty.json` was retrieved from `https://tiles.openfreemap.org/styles/liberty` on 2026-08-21. It retains the 111-layer OpenFreeMap/OpenMapTiles style and its OpenFreeMap/OpenMapTiles/OpenStreetMap attributions. Three highway-shield filters (`highway-shield-non-us`, `highway-shield-us-interstate`, `road_shield_us`) were changed to coalesce missing `ref_length` values before numeric comparison, eliminating MapLibre filter warnings. SHA-256: `76e7ba1ac44425ff9efdb4a73abd78020cf2d07c370518465891304be88a990c`.

### 2026-08-21 — Vertical slice 2: versioned project/layer store and history

- Added a schema-versioned `ProjectDocument` and a Zustand vanilla store as the canonical layer source of truth.
- Layer visibility, lock, rename, opacity, reorder, duplicate and delete now create immutable history entries; undo/redo controls expose valid disabled states and new edits clear redo history.
- Selection moved into the store. Undo/redo reconcile selection against restored documents; deleting the selected layer clears context and moves focus predictably, while duplication selects the new layer.
- Text and numeric property fields use draft transactions and commit once on blur, so one Undo restores the previous visible value.
- Wired layer-list controls and Layer properties to the store. Drag handles reorder layers directly in the sidebar; Duplicate and Delete are available from the compact layer overflow menu rather than four persistent inspector buttons.
- Removed the misleading `Page 1` sidebar hierarchy because the current document has a single print frame. Fit page now issues a real MapLibre fit-bounds command, orientation controls update state, and attribution is an 8px control at the lower map edge.
- Strict TDD evidence: focused tests were observed failing for the redo-selection invariant, non-finite reorder, duplication, property transaction, access-name, tool-state, clean-style and real-canvas deselection behavior before implementation.
- Review remediation: vendored and sanitized the Liberty style, added pre-load MapLibre error fallback, made console warnings/page errors test-visible, added real-canvas deselection E2E, replaced incomplete tree semantics with an accessible list, exposed pressed/current states, labeled property controls, increased contrast, removed component color literals, opted React Doctor out of telemetry, fixed draft-to-click event loss, and added final-delete focus fallback.
- Verified commands:
  - `npm run typecheck` — pass
  - `npm run lint` — pass, zero warnings
  - `npm run doctor` — pass, no issues at warning-blocking severity; telemetry disabled
  - `npm test -- --run` — 3 files / 24 tests pass
  - `npm run build` — pass (bundle-size warning remains)
  - `npm run test:e2e` — 10 pass / 2 Firefox WebGL-environment skips across 12 Chromium, Firefox and WebKit cases
- Browser evidence:
  - Stable latest desktop UI: `docs/screenshots/latest-desktop.png` (1440×900), showing the selected Route layer, direct drag handles, compact lower attribution, no fake page hierarchy, and no persistent inspector action stack.
  - 390×844 smoke remains covered by Playwright with no body overflow.
- Remaining known issue: the main JavaScript bundle is about 1.15 MB before gzip; MapLibre lazy loading/code splitting remains a later performance task.

## 2026-08-21 — Vertical slice 3: live content overlays and diagnostic recovery

- Added typed point, line and polygon geometry to the canonical project document and rendered real route, POI and shape GeoJSON through a dedicated MapLibre content adapter.
- Sidebar hover previews only the matching visible overlay without selecting it. Canvas feature hits select back into the canonical store; background clicks still clear selection. Visibility and drag/keyboard ordering propagate to actual MapLibre paint and stacking order.
- Selection/hover paint updates keep stable MapLibre sources and layers. The adapter distinguishes synced/deferred/failed states, retries deferred state on idle, contains readiness/paint/rollback/hit-test/destroy failures, and preserves retryable cleanup state.
- Strict TDD evidence:
  - Earlier focused recovery tests failed before implementation for deferred synchronization, style-error preservation, hit-test recovery, exception-safe teardown, and visible fallback recovery.
  - `npm test -- --run tests/unit/map-content-adapter.test.ts -t "clears a previous hit-test diagnostic"` failed 2/2 with the expected stale `data-map-content-error="true"` assertion after successful feature and background hits.
  - The minimal adapter change clears that diagnostic only after a successful query; the same focused command then passed 2/2.
- Fresh verification on the completed working tree:
  - `npm test -- --run` — pass, 5 files / 54 tests.
  - `npm run typecheck` — pass.
  - `npm run lint` — pass, zero warnings.
  - `npm run doctor` — pass, no issues at warning-blocking severity; telemetry disabled.
  - `npm run build` — pass; existing ~1.16 MB pre-gzip bundle warning remains.
  - `npm run test:e2e` — 12 pass / 3 documented Firefox WebGL-environment skips across 15 Chromium, Firefox and WebKit cases.
- Browser evidence:
  - Fresh 1440×900 Chromium screenshot: `docs/screenshots/latest-desktop.png`, SHA-256 `6ac8c9cdea89f7ed15db3a431aee572f5896cf732e137f5bcdce22af063cb383`.
  - Live browser inspection reported `mapReady=true`, overlay order `route-01,poi-cafe,area-center`, no visible fallback, no stale content-error diagnostic, no body overflow and zero console errors/page errors. Route, POI and polygon overlays were all visible; screenshot review found no material clipping, overlap, gradient, decorative shadow or hierarchy defect.
- Fail-closed review remediation:
  - Review 1 rejected incomplete old-overlay cleanup, ignored post-load renderer errors, and a lifecycle mock that could hide stale handlers. An independent fix agent added RED-first regressions (`expected 'synced' to be 'failed'` and `Unable to find role="status"`), blocked rebuilds until cleanup succeeds, surfaced an actionable renderer fallback, and added per-map/per-adapter tracking.
  - Review 2 found the empty-target cleanup fast path still reachable and pre-side-effect cleanup exceptions still unproved. A second independent fix agent observed RED failures with one stale MapLibre layer and leaked map `0`, then added an explicit cleanup-pending invariant plus one bounded teardown retry. The first retry helper form triggered React Doctor's `effect-needs-cleanup`; inlining the same bounded retries made React Doctor pass with no suppression.
  - Final independent re-review passed with no security concerns or logic errors. Its only non-blocking suggestion is a combined style-error/post-load-error precedence regression; the implementation was verified to preserve the existing style error.
- `.env.local` and tokens remain untracked/uncommitted. `docs/COMPLETE.md` does not exist and the scheduler remains enabled.

### 2026-08-21 — Vertical slice 4: canonical page orientation and versioned migration

- Moved A4 width, height and orientation from transient React state into schema-versioned `ProjectDocument.page`; Project properties and the canvas now read the same canonical values.
- Portrait/Landscape is one immutable history transaction. Undo and redo restore the segmented control, 297×210 / 210×297 mm fields and canvas-frame orientation together.
- Bumped the document schema to version 2 and added an explicit version-1 migration at the store boundary so pre-page documents receive fresh A4 landscape settings instead of failing at `document.page` access.
- Orientation changes canonicalize edge ordering even when a malformed document declares the requested orientation with swapped dimensions; already-canonical repeated clicks remain history no-ops.
- Strict TDD evidence:
  - `npm test -- --run tests/unit/app-selection.test.tsx -t "commits project orientation"` first failed at the post-Undo landscape assertion (`aria-pressed` remained `false`), then passed after the document/store/UI wiring.
  - Review remediation added RED-first regressions for legacy v1 migration (received schema 1/no page instead of schema 2/A4) and same-orientation canonicalization (landscape remained 210×297); both focused commands passed after the minimal fixes.
- Final verification on the reviewed working tree:
  - `npm test -- --run` — pass, 5 files / 56 tests.
  - `npm run typecheck` — pass.
  - `npm run lint` — pass, zero warnings.
  - `npm run doctor` — pass, no issues at warning-blocking severity; telemetry disabled.
  - `npm run build` — pass; existing ~1.16 MB pre-gzip bundle warning remains.
  - `npm run test:e2e` — 12 pass / 3 documented Firefox WebGL-environment skips across 15 Chromium, Firefox and WebKit cases.
- Browser evidence:
  - Stable 1440×900 Chromium screenshot: `docs/screenshots/latest-desktop.png`, SHA-256 `6ac8c9cdea89f7ed15db3a431aee572f5896cf732e137f5bcdce22af063cb383`.
  - Fresh live-browser interaction changed to Portrait and Undo restored 297×210 landscape with Redo enabled; `data-map-ready=true`, body overflow was 0 and the browser console/page-error buffers were empty.
  - Screenshot review found the live map and all three editor panes readable with no material clipping, toolbar overlap, gradient or decorative shadow.
- Fail-closed review initially rejected missing schema migration and inconsistent same-orientation dimensions. An independent fix agent added the RED-first regressions and minimal remediation; independent re-review then passed with no security concerns or logic errors. The only non-blocking suggestion is a direct page-object isolation regression across both history directions.
- `.env.local` and tokens remain untracked/uncommitted. `docs/COMPLETE.md` does not exist and scheduler job `3a05bbc81515` remains enabled.

### 2026-08-21 — Vertical slice 5: canonical standard page presets

- Added canonical `A4`, `A3`, `Letter`, and `Custom` preset identity to schema-version 3 page settings. Version-1 documents receive A4 defaults; version-2 documents preserve dimensions/orientation and infer a matching standard preset or `Custom`.
- The Project preset control is now controlled by the project store. Choosing A4, A3, or Letter commits dimensions in the current orientation as one history entry; Undo restores the prior preset, dimensions, and visible frame together. Custom remains visibly disabled until transaction-safe dimension editing is implemented.
- The print frame now reads the canonical page dimensions for its aspect ratio and displays the canonical preset in its label rather than hard-coding A4.
- Strict TDD evidence:
  - `npm test -- --run tests/unit/app-selection.test.tsx -t "applies a standard page preset"` first failed at the expected width assertion (`expected 420`, received `297`).
  - After the minimal store/UI/frame implementation, the focused command passed 1/1. The existing orientation regression then caught a missing preset spread in the full suite; preserving the page object made both focused tests and the full suite pass.
- Fresh verification on the completed working tree:
  - `npm test -- --run` — pass, 5 files / 61 tests.
  - `npm run typecheck` — pass.
  - `npm run lint` — pass, zero warnings.
  - `npm run doctor` — pass, no issues at warning-blocking severity; telemetry disabled.
  - `npm run build` — pass; existing ~1.16 MB pre-gzip bundle warning remains.
  - `npm run test:e2e` — 12 pass / 3 documented Firefox WebGL-environment skips across 15 Chromium, Firefox and WebKit cases.
- Browser evidence:
  - Fresh 1440×900 Chromium screenshot: `docs/screenshots/latest-desktop.png`, SHA-256 `151c3a8038d928fe31161d88556f527bd7fb9c6ad3a4928ee254e3ce87e72be8`.
  - Live browser selection of A3 produced `420×297`, frame label `A3 · Landscape`, CSS aspect ratio `420 / 297`, enabled Undo, a ready live map, zero body overflow, and no JavaScript errors. The exact-size headless screenshot emitted only the previously classified Chromium `GPU stall due to ReadPixels` diagnostic; the interactive browser console had zero errors or warnings.
  - Screenshot review found the three-pane hierarchy, map overlays, A3 frame, page controls, and bottom palette readable with no material clipping, overlap, gradients, or decorative shadows.
- Fail-closed review initially rejected contradictory version-2 migration states and missing migration coverage. An independent fix agent observed the expected RED failure (`Custom` expected, `A4` received) for `210×297` declared landscape, then made standard-preset inference orientation-aware and added four version-2 migration cases covering landscape, portrait, inconsistent, and custom dimensions. Full verification passed after the fix; independent re-review passed with no security concerns or logic errors. Its only non-blocking suggestion is direct A3/Letter migration and preset-redo coverage.
- `.env.local` and tokens remain untracked/uncommitted. `docs/COMPLETE.md` does not exist and scheduler job `3a05bbc81515` remains enabled.

## Next unresolved slice

Implement transaction-safe Custom page dimensions: editing width or height should switch the canonical preset to Custom, validate positive finite millimetres, commit once on blur, update the frame aspect ratio, and remain undoable.
