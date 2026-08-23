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

### 2026-08-21 — Vertical slice 6: transaction-safe custom page dimensions (remediated, pending combined review)

- Added controlled width/height drafts that reject empty, non-finite and non-positive values, expose `aria-invalid`, avoid history while typing, commit once on blur, switch the canonical preset to `Custom`, update the print-frame aspect ratio, and remain undoable.
- Added explicit dirty tracking so merely focusing and blurring an untouched dimension does not create history. Re-entering the same numeric value after an actual edit still creates one `Custom` transaction.
- Strict TDD evidence:
  - Initial focused command `npm test -- --run tests/unit/app-selection.test.tsx -t "validates and commits a custom"` failed 2/2 because both page fields were read-only; after implementation it passed 2/2.
  - Review remediation observed RED for re-entering `297` (`Custom` expected, `A4` received), then GREEN after the store no-op invariant was narrowed.
  - Second remediation observed RED for untouched focus/blur (`A4` expected, `Custom` received), then GREEN after per-field dirty tracking.
- Fresh verification on the current uncommitted working tree:
  - `npm test -- --run` — pass, 5 files / 65 tests.
  - `npm run typecheck` — pass.
  - `npm run lint` — pass, zero warnings.
  - `npm run doctor` — pass, no issues at warning-blocking severity; telemetry disabled.
  - `npm run build` — pass; existing ~1.16 MB pre-gzip bundle warning remains.
  - `npm run test:e2e` — 12 pass / 3 documented Firefox WebGL-environment skips across 15 Chromium, Firefox and WebKit cases.
- Browser evidence:
  - Fresh 1440×900 Chromium screenshot: `docs/screenshots/latest-desktop.png`, SHA-256 `9e10cbda5725247c5bdaaa6cc6eecb9b778b8544a076781b4f9c7f3333f1c8a8`.
  - Live invalid `-1` input set `aria-invalid=true` without enabling Undo; valid `240` committed `Custom`, produced frame aspect ratio `240 / 210`, enabled Undo, kept the live map ready, had zero body overflow, and emitted no browser console/page errors.
  - Fresh untouched focus/Tab verification preserved `A4` with Undo disabled.
  - Screenshot review found the custom frame, map, page controls and three-pane editor readable with no material clipping, overlap, gradient or decorative shadow.
- **Stale-draft blocker remediated:** the final earlier review found that an external page update could move a canonical dimension away from a dirty draft's source and later restore that source, resurrecting the abandoned draft. A focused RED regression reproduced `297 → dirty 240 → canonical 210 → canonical 297` returning `240`. Each dimension is now an independently keyed transaction field, so any canonical dimension/preset change remounts that edit boundary and permanently discards superseded drafts; untouched blur, same-value Custom, invalid reset, Undo and Redo behavior remain covered.
- Fresh combined verification after remediation: typecheck, ESLint, no-telemetry React Doctor and build pass; Vitest 6 files / 84 tests; Playwright 14 pass / 4 runtime Firefox WebGL skips across 18; audit 0 vulnerabilities. Final combined fail-closed re-review remains required before commit.
- `.env.local` and tokens remain untracked/uncommitted. `docs/COMPLETE.md` does not exist and scheduler job `3a05bbc81515` remains enabled.

### 2026-08-21 — Mobile responsiveness and attribution correction (verified, uncommitted with active slice)

- Reproduced the reported mobile defects at 390×844 and 360×800: both sidebars were `display:none`, making layer/project controls unreachable, while expanded attribution measured about 248×26 and overlapped the bottom toolbar; MapLibre's compact padding made its icon appear disproportionate.
- Added mobile Layers and Properties triggers plus modal left/right slide-in drawers, backdrop dismissal, explicit close controls, bounded toolbar sizing and safe-area-aware bottom placement. Drawers move focus inside after their transition, trap Tab, close on Escape/backdrop/selection, restore focus to the correct trigger, and respect reduced-motion preferences. The layer list scrolls independently for long projects.
- Attribution initializes collapsed on mobile by clearing both MapLibre state markers (`open` and `maplibregl-compact-show`), so the first click expands and the second collapses. Its visual glyph is 8×8 inside a 24×24 touch target; expanded text is 9.5px, constrained to the viewport, and translated above the toolbar. The toolbar and attribution derive placement from the same injectable safe-area variable, and `viewport-fit=cover` enables real iOS insets.
- Strict TDD/browser evidence:
  - The initial mobile test failed because attribution remained open, then exposed the real 6px collapsed-details height and MapLibre's 50×18 computed compact box.
  - The first independent review rejected the apparent fix because only `open` was cleared, expanded attribution still overlapped, drawer focus was unmanaged, safe-area geometry diverged, and the Firefox test assumed renderer availability from browser identity. Each issue was reproduced with focused Playwright probes before remediation.
  - The second independent review exposed three deeper lifecycle bugs: MapLibre drag removed only the class marker, topbar controls could escape the modal drawer, and an open drawer retained dialog semantics after resizing to desktop. New RED browser assertions reproduced each before implementation.
  - The third independent review found bidirectional breakpoint attribution drift, mobile Duplicate focus escaping to `BODY`, incomplete top/inline safe-area use, and a stale screenshot checksum. The browser regression was extended for every case before fixing them.
  - Final behavior now synchronizes both attribution markers on drag and in both breakpoint directions; applies native `inert` to every background application region while a drawer is modal; keeps Duplicate focus inside Properties; consumes top, bottom, left and right safe-area values; and clears drawer semantics/focus timers on desktop transition. The drawer lifecycle was extracted to `useMobilePanels` after React Doctor caught an oversized `App` component.
  - The final E2E case detects actual map-ready/fallback state; verifies pristine, post-drag, desktop-to-mobile and mobile-to-desktop attribution cycles; expanded geometry with all four simulated safe-area insets; a 24px target with 8px glyph; modal focus entry/Tab containment/Escape/backdrop/selection/Duplicate behavior; 320/390 overflow; resize cleanup; and all three browser engines.
- Fresh verification on the combined current working tree:
  - `npm run typecheck` — pass.
  - `npm run lint` — pass, zero warnings.
  - `npm run doctor` — pass, no issues; telemetry disabled.
  - `npm test -- --run` — pass, 5 files / 65 tests.
  - `npm run build` — pass; existing bundle-size warning remains.
  - `npm run test:e2e` — 12 pass / 3 documented Firefox WebGL-environment skips across 15 cases.
  - `npm audit --omit=dev` — 0 vulnerabilities.
- Browser evidence: `docs/screenshots/latest-mobile.png`, `docs/screenshots/mobile/attribution-open.png`, `docs/screenshots/mobile/layers-open.png`, and `docs/screenshots/mobile/properties-open.png`. Measured expanded attribution is 239×28 at y=754–782 versus toolbar y=786–830; the button is 24×24 with an 8×8 glyph. The Tailscale deployment at `https://ubuntu-2gb-hil-1-1.tail7787.ts.net:8443/` serves the corrected source with a clean browser console.
- These edits share `App.tsx`, `MapCanvas.tsx`, styles and tests with the custom-dimension and export corrections, so the combined tree awaits one final fail-closed review before commit.

### 2026-08-21 — Export no-op correction (verified, uncommitted with active slices)

- Reproduced the user report at both 1440×900 and 390×844: clicking `Export` produced no dialog, no download event and no focus change because the button had no handler on either layout.
- Added an accessible `Export map` modal with initial focus, Tab containment, Escape/backdrop/Cancel/close behavior, trigger-focus restoration, busy state and a visible not-ready/error path. The wording explicitly identifies this as a current print-frame preview rather than claiming the later 300-dpi/tiled export gate is complete.
- Added a real browser-only PNG path. MapLibre now preserves its drawing buffer, registers the exporter only after the first rendered idle frame, crops the live canvas to the visible print frame, and downloads `<project-id>.png`. The crop includes the rendered basemap plus route/POI/shape layers and writes the style's visible source attribution into the PNG.
- Strict TDD/browser evidence:
  - The new Playwright case first failed because no `Export map` dialog existed.
  - The attribution unit case then failed because the cropped PNG omitted source attribution.
  - Export-only fail-closed review rejected the first implementation for clipped/outside crop math, busy-modal focus loss, stale exporter availability after renderer errors, unbounded/missing attribution, object-URL cleanup, and a non-awaited browser assertion. Focused RED tests reproduced every defect before remediation.
  - The corrected exporter intersects frame/canvas bounds, rejects zero/outside/missing-attribution states, bounds attribution text, normalizes rendering/encoding errors, sanitizes filenames, and revokes object URLs even when download initiation throws. Map errors now withdraw readiness and exporter capability; late callback replacement and StrictMode cleanup are covered. Busy export focuses the modal container and keeps Escape/Tab contained.
  - Chromium and WebKit now download non-empty files from desktop, 390×844 mobile, and 390×520 short-mobile viewports; Firefox activates the same case automatically when the runtime supplies WebGL 2 instead of being skipped by browser name. The browser test awaits file size, verifies PNG signature/IHDR dimensions against frame×DPR, decodes opaque/nonblank pixels, and checks attribution-strip pixel evidence.
  - Actual PNGs were visually inspected and contain the Liberty basemap, Route 01, Coffee stop, City center and an embedded attribution strip rather than blank/transparent pixels.
  - Direct downloads through the deployed Tailscale HTTPS endpoint produced the same 687×486 and 335×237 files and checksums as the Chromium regression path, with clean browser console/page-error capture.
  - Desktop and 390px modal screenshots have zero body overflow, focus `Download PNG`, remain inside safe-area padding and emit no console/page errors.
- Fresh combined-tree verification: typecheck pass; ESLint pass with zero warnings; no-telemetry React Doctor pass/no issues; Vitest 6 files / 84 tests; production build pass with the existing bundle-size warning; Playwright 14 pass / 4 runtime Firefox WebGL-environment skips across 18; `npm audit --omit=dev` reports 0 vulnerabilities.
- Evidence: `docs/screenshots/export-desktop.png`, `docs/screenshots/export-mobile.png`, `docs/screenshots/export-preview-desktop.png` (687×486, SHA-256 `30fc9413f1c80e9cd2b91a0cb6fde07c66ebbd19ce7cc0e593b22e6b68affb48`), `docs/screenshots/export-preview-mobile.png` (335×237, SHA-256 `655102e9cfbed4e08ccbfb6a124d82fbd220581007e9747fce0fd2705cd3443a`), and `docs/screenshots/export-preview-custom-100x300.png` (223×668, approximately 1:3, SHA-256 `29be3ff44544edb77188417e80d15272a2d9a3c494d3abd2dce529adff2267c9`).
- Scope remains honest: high-resolution tiled PNG, PDF and layered SVG are still future mission stages. This correction makes the existing top-bar control visibly and functionally useful without claiming those formats are finished.

### 2026-08-21 — Combined fail-closed review remediation (pending re-review)

- The first combined review reported no security concerns but rejected six logic/evidence areas. Each was reproduced with a focused RED assertion before correction:
  1. Mobile Delete could leave `BODY` focused while Properties remained modal. Delete now restores focus to the Project heading inside the active Properties dialog (or the appropriate desktop list target), and Chromium verifies focus plus Escape closure.
  2. Orientation-inconsistent Custom dimensions could distort the frame. Custom edits now derive orientation from canonical width/height, and container-query-unit sizing fits the exact ratio inside both axes. A real 100×300 page renders and exports at approximately 1:3 (`223×668`).
  3. Degenerate frame crops could produce unusable 687×2 previews. Export now rejects output below 120×48 with an explicit useful-content/attribution error.
  4. Content synchronization failures could retain an exporter. Failed/deferred synchronization now clears `data-map-ready`, invalidates exporter capability, and blocks idle republishing until content is synchronized.
  5. The 8px attribution glyph repeated as a 3×3 tile. CSS now sets `background-repeat:no-repeat` and centered positioning; computed-style browser assertions and refreshed screenshots verify one glyph in the 24px target.
  6. Evidence was too weak. Busy export now exercises forward and reverse Tab while no controls are enabled; PNG tests verify an exact opaque surface-colored attribution strip plus non-surface text pixels rather than generic bottom-row dominance.
- Fresh final gate after these corrections: typecheck pass; ESLint zero warnings; React Doctor no issues with telemetry disabled; Vitest 6 files / 84 tests; build pass with the existing size warning; Playwright 14 pass / 4 runtime Firefox WebGL skips; audit 0 vulnerabilities; diff/security scan clean; live HTTPS 200.
- Refreshed evidence: desktop SHA-256 `9e10cbda5725247c5bdaaa6cc6eecb9b778b8544a076781b4f9c7f3333f1c8a8`, mobile SHA-256 `224dea1d3944499bc38525d0f282d64059dd2a677c4d82a37bf1eec3916b4d21`; Properties and Export screenshots now show the current disabled Browser preview/required-attribution controls.

### 2026-08-21 — Vertical slice 7: portable versioned project JSON download (verified)

- Wired the existing desktop **Save** action to download the current canonical `ProjectDocument` as human-readable JSON with the portable `.printmap.json` suffix. The filename is derived from a sanitized project ID, and the object URL is revoked after download initiation.
- The saved artifact reflects current canonical state rather than startup defaults: after changing A4 to Portrait, the browser download contains schema version 3, `210×297` portrait page settings, project identity, and all four ordered layers.
- Strict TDD evidence:
  - `npm run test:e2e -- --project=chromium --grep "Save downloads the current project"` first failed after 30 seconds waiting for a download because Save had no handler.
  - After the minimal download implementation, the same focused command passed 1/1 in 5.5 seconds.
- Fresh verification on the current working tree:
  - `npm run typecheck` — pass.
  - `npm run lint` — pass, zero warnings.
  - `npm run doctor` — pass, no issues at warning-blocking severity; telemetry disabled.
  - `npm test -- --run` — pass, 6 files / 84 tests.
  - `npm run build` — pass; existing ~1.17 MB pre-gzip bundle warning remains.
  - `npm audit --omit=dev` — 0 vulnerabilities.
  - `npm run test:e2e` — 17 pass / 4 documented Firefox WebGL-environment skips across 21 cases; the new portable-save flow passes in Chromium, Firefox, and WebKit.
- Browser evidence:
  - Refreshed exact 1440×900 Chromium screenshot: `docs/screenshots/latest-desktop.png`, SHA-256 `0d7a2c44d57c9b9546484b83a2d6fc7a237dd999b65fb175a6a123f7e1c81216`.
  - Live browser interaction changed the page to `210×297` Portrait and clicked Save with `data-map-ready=true`, zero body overflow, zero gradients, zero computed box shadows, and no console errors or warnings.
  - Screenshot review found no material clipping, overlap, hierarchy, frame, or legibility defect; the Save action remains visible in the flat top bar.
- Independent fail-closed review passed with no security concerns or logic errors. Its non-blocking suggestion is dedicated filename-sanitization edge coverage plus full-document equality; the current cross-browser test already proves canonical schema, identity, page state, and complete ordered layer IDs.
- Scope remains bounded: this slice adds portable JSON download only. Portable project upload/open, schema validation/error UX, IndexedDB autosave, and ZIP support remain unresolved.
- `.env.local` and tokens remain untracked/uncommitted. `docs/COMPLETE.md` does not exist and scheduler job `3a05bbc81515` remains enabled.

### 2026-08-21 — Vertical slice 8: validated portable project open (verified)

- Added an explicit **Open** action for portable `.printmap.json` files. The browser validates the suffix and rejects files above 10 MiB before reading them, then parses untrusted JSON through a normalizing validator rather than casting it into the project store.
- Current schema-3 projects and migrated schema-1/2 documents pass through the same store boundary. Validation covers the root/schema, project identity, canonical standard-page dimensions, page orientation, layer count/IDs/types/state, geometry/type compatibility, coordinate structure/ranges/ring closure, opacity, and aggregate coordinate limits. Imported objects are rebuilt from known fields so unknown input does not become canonical state.
- A successful open replaces the canonical document, clears selection/hover preview, and establishes a fresh history root with Undo and Redo disabled. Invalid JSON, renamed files, unsupported/contradictory documents, and oversized files leave the current project and history untouched.
- The hidden file input is cleared after every attempt, so the same file can be retried. Success uses an accessible status; failures use an accessible alert with corrective text. Both paths restore focus to **Open** after the chooser closes.
- Strict TDD evidence:
  - The store regression first failed with `openDocument is not a function`, then passed after the history-reset action was added.
  - The parser test first failed because `projectFile.ts` did not exist; the invalid-fixture matrix then failed 8/8 against the unsafe cast-only parser before structural validation was implemented.
  - The nominal Playwright flow first timed out waiting for an **Open** file chooser. The invalid/retry flow then failed with an unhandled `ProjectFileError` and no alert before guarded error handling and focus restoration were added.
  - Geometry/type contradiction and noncanonical standard-page regressions each failed before their focused validation rules were added.
- Fresh verification on the reviewed working tree:
  - `npm run typecheck` — pass.
  - `npm run lint` — pass, zero warnings.
  - `npm run doctor` — pass, no issues; telemetry disabled. The first run rejected the enlarged `App`; extracting a dedicated project-open component restored the clean gate.
  - `npm test -- --run` — pass, 7 files / 96 tests.
  - `npm run build` — pass; existing ~1.18 MB pre-gzip bundle warning remains.
  - `npm audit --omit=dev` — 0 vulnerabilities.
  - `npm run test:e2e` — 23 pass / 4 documented Firefox WebGL-environment skips across 27 Chromium, Firefox, and WebKit cases. Save, valid Open, invalid retention/retry, and focus/history behavior pass in all three engines.
- Browser and process evidence:
  - Fresh 1440×900 Chromium screenshot: `docs/screenshots/latest-desktop.png`, SHA-256 `52a5342e40bd762bafa21800a36598a8294f5dd9a723e2bb7f9a74e88fcd10d5`.
  - Exact-viewport inspection reported `data-map-ready=true`, overlay order `route-01,poi-cafe,area-center`, zero body overflow, zero gradients, zero computed box shadows, and no console warnings/errors. Screenshot review found the Open/Save/Share/Export actions, three-pane hierarchy, frame, and toolbar legible with no material clipping or overlap.
  - Seven stale duplicate workspace Vite process groups were stopped; the enabled `print-map-studio.service` preview remained healthy on `127.0.0.1:4178` with HTTP 200 and was the only remaining workspace Vite process.
- Independent fail-closed review passed with no security concerns or logic errors. Non-blocking suggestions were explicit same-file/boundary/legacy/limit coverage, serializing overlapping asynchronous opens, and exposing Open through a future mobile overflow action.
- Scope remains bounded: IndexedDB autosave/recovery and ZIP project packaging are still unresolved. `docs/COMPLETE.md` does not exist.

### 2026-08-22 — Vertical slice 9: IndexedDB autosave and explicit recovery (verification complete, pending final review)

- Added a versioned IndexedDB draft repository that validates every stored document through the portable-project parser before exposing it to application state. Draft writes are debounced and serialized; teardown cancels pending work and prevents queued writes after unmount.
- The editor now shows live autosave state, keeps editing available when storage is unavailable or full, and provides an actionable portable-Save fallback for quota and generic storage errors.
- Startup never replaces the current project silently. A valid local draft opens a focus-trapped recovery decision; a corrupt or unsupported record remains contained until explicitly discarded. Recovering establishes a fresh history root, while successful discard restores focus and permits pending canonical edits to save.
- Interaction coverage exercises recovery/discard, Escape refusal, forward/reverse focus containment, focus restoration, corrupt records, discard failure, quota failure, edits made while storage is loading, queued-save teardown, mobile safe-area geometry, body overflow, reload persistence, and all three browser engines.
- Fresh serial verification on the staged integration tree:
  - `npm test -- --run tests/unit/autosave.test.ts tests/unit/app-selection.test.tsx` — pass, 2 files / 40 tests.
  - `npm run typecheck` — pass.
  - `npm run lint` — pass, zero warnings.
  - `npm run doctor` — pass, no issues; telemetry disabled.
  - `npm test -- --run` — pass, 8 files / 108 tests.
  - `npm run build` — pass; existing ~1.19 MB pre-gzip bundle warning remains.
  - `npm audit --omit=dev` — 0 vulnerabilities.
  - `npm run test:e2e` — 29 pass / 4 documented Firefox WebGL-environment skips across 33 Chromium, Firefox, and WebKit cases.
- Browser and screenshot evidence:
  - Stable 1440×900 editor captured by the fresh Chromium gate: `docs/screenshots/latest-desktop.png`, SHA-256 `d07ce14eb5cfcf9aa4e71cc7c0be7c03f81b4ac26e3a1c23d8049449bd9fa40e`.
  - Recovery dialog: `docs/screenshots/autosave-recovery-desktop.png` (1440×900), SHA-256 `bdb08942bb5915ba08b9afb7da158b74f36e517a9e436ccbb43290e29bb64305`.
  - Mobile recovery dialog: `docs/screenshots/autosave-recovery-mobile.png` (390×844), SHA-256 `850ed42fe68dfaf8a40be57936ca65a60fb089c1a6df3269967b7b5fc8f6c186`.
  - Live preview at `127.0.0.1:4178` returned HTTP 200, changed to Portrait, reported `All changes saved locally`, presented the recovery dialog after reload, and had zero console warnings/errors or page errors.
  - Visual review found the compact footer status and centered recovery dialog readable with no material clipping, overlap, gradient, decorative shadow, or hierarchy defect.
- `docs/COMPLETE.md` does not exist; the mission completion gate remains open.

### 2026-08-22 — Wave 1 audit and bounded GeoJSON UI integration (verified)

- Audited every registered worktree, branch status, live Hermes/test process and preview artifact before acting. No duplicate implementation worker or test server was launched; the enabled preview remained the sole workspace Vite service on `127.0.0.1:4178`.
- Confirmed Wave 1 had already been integrated through verified branch `agent/unicorn-wave1` and merge `4a9ef55`. The three original Wave 1 branches are superseded by that integrated/refactored implementation and are not eligible for a second merge; each is 30 commits behind main and its worktree contains an untracked `node_modules` artifact. Their scoped diffs did not touch integration-owner hotspots.
- Integrated the clean roadmap documentation commit `98aec9d` as `fc229d0` before starting application edits.
- Added a desktop **Import** chooser for `.geojson` files. A valid bounded Feature/FeatureCollection becomes editable route, POI and shape layers, is inserted above the basemap, selects the first imported layer, preserves unique IDs, and commits the entire batch as one Undo step.
- Empty/invalid/oversized or wrongly named files remain contained, report an accessible corrective error, leave history unchanged and reset the chooser for a focused retry.
- Strict TDD evidence:
  - Store batch import first failed because `importLayers` did not exist, then passed after the one-transaction insertion action.
  - The browser flow first timed out because no **Import** control existed, then passed after the chooser and parser wiring.
  - Empty GeoJSON first produced no alert, then passed after explicit no-feature rejection.
  - A colliding imported ID first produced duplicate `route-01` IDs, then passed after deterministic suffixing.
  - Review remediation reproduced a slow import landing in a project opened later, stale success after Open, and an enabled second Import while reading. A document epoch now makes Open/autosave recovery win, remounts stale status, and blocks concurrent import reads. The first pending-state focus attempt then failed the existing browser focus assertion before focus was deferred until the re-enabled button rendered.
- Fresh serial verification: focused Wave 1 tests pass (17 export-preflight, 7 print-scene, 23 GeoJSON parser); typecheck passes; ESLint passes with zero warnings; React Doctor reports no issues; Vitest passes 23 files / 196 tests; production build passes with the known bundle-size warning; audit reports 0 vulnerabilities; Playwright passes 38 with 4 runtime Firefox WebGL skips across 42 Chromium, Firefox and WebKit cases.
- Browser evidence: fresh 1440×900 `docs/screenshots/latest-desktop.png`, SHA-256 `6559e34c73f7e433c72b8b2bb0a13ef7d6007f93e34f44e395f9a008cc7fa056`. The new Import action fits the flat top bar without clipping or overlap; the editor screenshot shows no visible error, gradient or decorative shadow. Live preview inspection reported a ready map, zero body overflow, zero computed gradients/shadows and an empty console/page-error buffer; the preview returned HTTP 200.
- A transient OpenFreeMap glyph-origin fetch failure appeared in an earlier temporary Playwright server output while the suite continued successfully; external tile/font availability remains a tracked third-party risk. The first fail-closed review rejected asynchronous import/open races; remediation was verified and the final independent re-review passed with no security concerns or logic errors. Non-blocking follow-ups are clearing a prior status as soon as a new read starts and adding a direct stale-epoch store regression in addition to the app-level race coverage.

### 2026-08-22 — Wave 2 foundations and bounded GPX/KML UI integration (verified)

- Recovered three interrupted Wave 2 worktrees without resetting their partial artifacts. Each worker stayed within its exclusive leaf-module/test scope, avoided manifests and integration hotspots, committed verified work, removed its temporary `node_modules` symlink, and left a clean worktree.
- Integrated the independently reviewed foundations one at a time:
  - raster compositor `6a2177d` via merge `e443ef3`: sequential tile/strip execution, exact overlap crop/destination mapping, monotonic progress, cancellation checkpoints and deterministic release/error behavior (10 focused tests);
  - Mapbox provider core `f44784c` via merge `8d22bbe`: provider-neutral contracts, strict public-token and HTTPS API-host validation, terms/storage-use boundary, abort-race containment, and actionable offline/401/403/422/429/other failure normalization (26 focused tests);
  - GPX/KML import `8803cd3` plus review fix `27c1427` via merge `1bf44d9`: bounded namespace-aware XML parsing, DTD/entity rejection, deterministic canonical layers, points/lines/polygons with KML holes, and strict decimal lexical validation (39 focused tests).
- The first GPX/KML review correctly rejected JavaScript-only numeric literals such as `0x10`; a RED matrix failed 9 cases before complete decimal lexical validation made 39 tests pass. Final re-review found no remaining security, logic or scope blocker. Independent raster and Mapbox reviews also passed.
- Wired one bounded integration surface: the existing **Import** chooser now accepts `.geojson`, `.gpx`, and `.kml`, dispatches to the strict local parser, inserts each file as one undoable editable layer batch, selects the first imported layer, restores focus, and reports format-correct accessible status/errors. Empty GPX, malformed KML, wrong suffix, unchanged history and retry are covered across Chromium, Firefox and WebKit.
- Strict UI TDD evidence: the GPX flow first failed with no `Café Central` heading; the KML flow first failed with no `Café point` heading; an existing empty-GeoJSON regression then failed on the broadened error wording before the exact corrective message was restored. The first UI review rejected a shared zero-layer fallback and missing invalid-format interaction coverage; isolating GeoJSON's empty check and adding the invalid/retry flow produced a clean final re-review (24/24 project-file browser cases).
- Final serial verification on the completed tree:
  - `npm run typecheck` — pass.
  - `npm run lint` — pass, zero warnings.
  - `npm run doctor` — pass, no issues; telemetry disabled.
  - `npm test -- --run` — pass, 26 files / 271 tests.
  - `npm run build` — pass; the known ~1.21 MB pre-gzip bundle warning remains.
  - `npm audit --omit=dev` — 0 vulnerabilities.
  - `npm run test:e2e` — 47 pass / 4 documented Firefox WebGL-environment skips across 51 Chromium, Firefox and WebKit cases.
- Fresh browser evidence: `docs/screenshots/latest-desktop.png` is a current 1440×900 Chromium capture, SHA-256 `6559e34c73f7e433c72b8b2bb0a13ef7d6007f93e34f44e395f9a008cc7fa056`. Live inspection reported a ready map, overlay order `route-01,poi-cafe,area-center`, GPX/KML accept filters, zero body overflow, zero computed gradients/shadows and an empty console/error buffer. Visual review found no clipping, topbar crowding, overlap or hierarchy defect; the enabled preview remained healthy on `127.0.0.1:4178` with HTTP 200.
- `docs/COMPLETE.md` does not exist. Core authoring, portable ZIP, high-resolution PNG/PDF/layered-SVG UI and the Mapbox renderer/storage decision still keep the mission gate open.

### 2026-08-22 — Export preflight and print-size PNG composition (verified)

- Re-audited the clean main worktree, every registered agent worktree/branch, live Hermes/test processes, artifacts and preview service before editing. Wave 1 and Wave 2 foundations were already integrated; no eligible branch or duplicate worker remained, and the enabled preview stayed healthy on `127.0.0.1:4178`.
- The Export dialog now runs the reviewed preflight planner against the canonical physical page before capture. It reports exact 300-DPI-equivalent placement pixel targets and peak memory, disables download for unsafe jobs before canvas allocation, and gives a corrective page-size action.
- Wired the reviewed raster compositor into PNG generation. It follows the preflight tile/strip plan, calculates tile progress, releases tile/output allocations on failure or cancellation, and preserves exact output dimensions. The A4 300-DPI-equivalent placement target is `3508×2480`; the `100×300 mm` target is `1181×3543`.
- Scope remains explicit and honest: this output resamples the current browser render to those pixel dimensions; it does not invent native map detail, and PNG physical-resolution metadata is not embedded. Native high-resolution map tile rendering, PDF and layered SVG remain unresolved completion-gate work.
- Strict TDD evidence: dialog preflight summary, unsafe allocation guidance, compositor progress, cancellation allocation release and busy-dialog cancellation each failed for the expected missing behavior before their minimal implementation. The focused Chromium export initially exposed the old 10-pixel attribution probe assumption after resampling; the structural check now inspects the scaled attribution band and passes.
- The first fail-closed review rejected cancellation during asynchronous PNG encoding and unsafe-preflight focus remaining outside the modal. A separate fix agent observed RED failures for a delayed `toBlob` callback resolving after abort and for disabled Download receiving no focus; encoding now rechecks cancellation before resolving, releases the output, and unsafe jobs initially focus the enabled Cancel action. Both focused files pass 8/8.
- The second fail-closed review rejected language that called the result a 300-DPI PNG even though fresh files have the exact target pixel dimensions but no embedded physical-resolution metadata. A RED app interaction assertion required both “300 DPI pixel target” and an explicit metadata disclaimer; the dialog now presents the dimensions as targets for 300-DPI placement, states that PNG physical-resolution metadata is not embedded, and retains the resampling/no-new-detail limitation. Matching E2E text assertions cover A4 and custom targets. Focused app-export tests pass 4/4; typecheck and ESLint also pass.
- The final fail-closed review found one remaining blocker: tile render/write/progress callbacks were synchronous, so the microtask chain could finish every tile before the browser painted progress or dispatched a Cancel click. A new interaction regression first failed because `Cancel export` never rendered while the two-tile job was active. Composition now yields to the browser task queue after each non-final tile; the same test observes `1/2 tiles (50%)`, clicks Cancel, resumes the queued task, receives `Export cancelled`, proves only one tile was drawn, and proves encoding/download never started.
- A second RED interaction regression exposed an output-canvas allocation that survived when browser download initiation threw. The composed surface is now released in a `finally` boundary whether download startup succeeds or fails; the regression proves every created tile/output surface and the captured source are reset while the dialog reports the original failure.
- The next fail-closed review rejected four preview-capture failure paths that left an allocated source canvas alive until garbage collection: unavailable drawing context, render exception, null encoding result, and synchronous encoding exception. An independent fix agent added all four assertions first; they failed with the output still at `600×400`, then passed after every rejected capture path explicitly released the surface to `0×0`.
- Fresh serial verification after all corrections: focused export coverage passes 5 files / 50 tests; typecheck passes; ESLint passes with zero warnings; React Doctor reports no issues; Vitest passes 27 files / 281 tests; production build passes with the known ~1.22 MB pre-gzip bundle warning; audit reports 0 vulnerabilities; the final Playwright rerun passes 47 with 4 documented Firefox WebGL-runtime skips across 51 Chromium, Firefox and WebKit cases.
- Browser evidence: refreshed 1440×900 `docs/screenshots/latest-desktop.png`, SHA-256 `0c2057ae314b8bd7a5a60dae7346d5a00467969a4a2d74284d488696249cb8f6`; timestamped preflight dialog evidence remains `docs/screenshots/export-preflight-20260822.png`. The live preview is HTTP 200 with a ready map and empty console/error buffers. Screenshot review found no clipping, overlap, blank/fallback map, gradient, decorative shadow, hierarchy or readability defect.
- One intermediate Playwright run encountered a transient Chromium Import-trigger focus timeout during an OpenFreeMap glyph-origin outage. The exact Chromium case passed immediately in isolation and the complete serial suite then passed cleanly; external glyph availability and this isolated focus flake remain tracked rather than being hidden as application completion.
- Final independent fail-closed re-review passed with no security concerns, logic errors, or blocking suggestions. It independently reran the 50 focused tests plus typecheck and lint. `docs/COMPLETE.md` does not exist because the wider mission gate remains open.

### 2026-08-22 — Layered SVG export integration (verification complete, pending final review)

- Added a second explicit export action for layered SVG. It embeds a clean raster-only capture of the current basemap, keeps route, POI and shape content as ordered named vector groups, preserves exact physical page dimensions/viewBox and adds attribution as its own named vector group.
- The map adapter temporarily hides only Studio overlay layers for the basemap capture, waits for a rendered frame, and restores them even when capture fails. Failed restoration withdraws exporter readiness and reports an actionable renderer recovery state rather than leaving hidden content or a stale capability.
- Geographic coordinates use the live MapLibre screen projection normalized to the intersected print frame, so vector groups align with the captured map under the current camera. The basemap capture omits its raster attribution strip because the SVG scene supplies the required vector attribution group.
- Scope remains explicit in the dialog and SVG metadata: the basemap is raster; user overlays remain vectors. Native high-resolution tile detail and PDF remain unresolved.
- Strict TDD evidence:
  - The app interaction first failed because `Download layered SVG` did not exist, then passed with a mocked embedded PNG and named route/POI/shape groups.
  - The real Chromium flow first timed out waiting for a download because the live capture lacked print-frame projection; it passed after projection and basemap isolation wiring.
  - Focused regressions first failed for normalized frame projection, overlay hide/restore, and duplicate raster attribution before their minimal implementations.
  - The first fail-closed review rejected a partial initial hide failure that could leave a stale exporter, plus unbounded render waits that ignored Cancel and renderer errors. RED regressions reproduced stale readiness after isolation failure, an undefined capture AbortSignal, a pending wait that ignored abort, an unbounded timeout path, and a renderer-error wait; all pass after the bounded remediation.
- Final serial verification after review remediation: typecheck passes; ESLint passes with zero warnings; React Doctor reports no issues; Vitest passes 27 files / 291 tests; production build passes with the known ~1.24 MB pre-gzip bundle warning; audit reports 0 vulnerabilities; Playwright passes 49 with 5 runtime Firefox WebGL skips across 54 Chromium, Firefox and WebKit cases.
- Browser evidence: refreshed exact 1440×900 `docs/screenshots/latest-desktop.png`, SHA-256 `a62a7e0f75592236bdedb92ead643e8d0f14a46176d91c8a935ef7385edd15a2`. The live preview returned HTTP 200 with a ready map, zero body overflow, zero computed gradients/shadows, and no application console/page errors; Chromium emitted only its previously classified headless `ReadPixels` GPU diagnostics. Visual review found the three export actions readable with no clipping, overlap, fallback map, decorative shadow or hierarchy defect. The generated Chromium SVG is 696,974 bytes (SHA-256 `cf20ba9d3a4026bf539cd4a6ac9f89fbbd41f3ed461951e1b46cbbdfcd1c3dc8`); its embedded 687×486 raster contains zero exact route/POI/shape paint-color pixels, and a rendered artifact inspection found the separate vectors aligned without visible duplication or clipping.
- A pre-remediation WebKit gate logged a transient OpenFreeMap Noto Sans Italic glyph-origin fetch failure while all affected browser cases passed; external font/tile availability remains a tracked third-party risk rather than being hidden as application completion.
- The first post-remediation browser gate hit an isolated WebKit Import-trigger focus timeout in the pre-existing invalid-GPX/KML flow. The exact WebKit case passed immediately in isolation and the complete serial suite then passed; this remains tracked with the earlier third-party/focus flakes rather than being attributed to the export change.
- Final independent fail-closed re-review passed with no security concerns, logic errors, or suggestions. It independently reran the 60 focused remediation/export tests and confirmed bounded abort/error/timeout handling, fail-closed capability invalidation, surface cleanup, PNG preservation, safe downloads, and the raster-basemap/vector-overlay structure. `docs/COMPLETE.md` does not exist because the wider mission gate remains open.

### 2026-08-22 — Exact-page layered PDF export (verified)

- Added a fourth explicit Export action for PDF. It captures the same raster-only basemap used by layered SVG, places it on the exact physical page, and draws route, POI and shape geometry as separate named vector optional-content groups with a required vector attribution layer.
- The default A4 landscape PDF has an exact `841.889764 × 595.275591 pt` MediaBox/CropBox. The generated browser artifact is one PDF 1.7 page with a DCT/JPEG raster XObject, named OCGs, per-layer opacity ExtGStates, no JavaScript and no encryption.
- Layer semantics match the editor: vector commands paint bottom-to-top so the first sidebar layer remains visually topmost; the PDF layer panel lists content top-to-bottom; hidden vector content remains embedded but starts OFF; basemap and vector opacity are preserved.
- The dialog states the export contract honestly: PDF and layered SVG retain vector user overlays over a raster basemap; native high-resolution tile detail remains unresolved. PDF export supports the existing busy focus trap, cancellation, renderer-error withdrawal, object-URL cleanup and source-surface release.
- Strict TDD evidence:
  - The first focused app test failed because `Download PDF` did not exist, then passed with exact page-box, raster image, named OCG and attribution assertions.
  - A rendered artifact exposed a UTF-16 BOM as visible attribution garbage. A RED assertion required WinAnsi-safe middle-dot/copyright escapes; the corrected artifact starts cleanly with `OpenFreeMap`.
  - Review remediation tests failed first for hidden layers omitting their vector commands, missing basemap opacity, and route/POI/shape stacking in document order; all pass after embedding hidden commands behind OFF OCG state, adding the basemap ExtGState, and reversing paint order while preserving sidebar OCG order.
- Final serial verification on the reviewed tree:
  - `npm run typecheck` — pass.
  - `npm run lint` — pass, zero warnings.
  - `npm run doctor` — pass, no issues; telemetry disabled.
  - `npm test -- --run` — pass, 28 files / 296 tests.
  - `npm run build` — pass; the known ~1.24 MB pre-gzip bundle warning remains.
  - `npm audit --omit=dev` — 0 vulnerabilities.
  - `npm run test:e2e` — 51 pass / 6 documented Firefox WebGL-runtime skips across 57 Chromium, Firefox and WebKit cases. PDF download passes in Chromium and WebKit and is runtime-skipped with the other renderer-dependent exports in Firefox.
- Structural and browser evidence:
  - `qpdf --check` passes for fresh Chromium and WebKit PDFs. `pdfinfo` reports one A4 landscape page, PDF 1.7, exact page size, no JavaScript and no encryption.
  - Current Chromium PDF: 117,582 bytes, SHA-256 `b769fa13eb761e40a6380322905afe612d9becbcc12f94b87ed0d06f7d0a955b`.
  - Rendered PDF evidence: `docs/screenshots/pdf-export-20260822.png`, SHA-256 `ab901118abc70884be2082d75380cebc5ab19117f8f4a90aabb36fe7cdd604a3`. Visual review confirmed the raster map, polygon, POI, route and clean attribution are aligned, unclipped and not duplicated.
  - Fresh 1440×900 editor: `docs/screenshots/latest-desktop.png`, SHA-256 `0c2057ae314b8bd7a5a60dae7346d5a00467969a4a2d74284d488696249cb8f6`. Live preview remained map-ready with zero body overflow, gradients, computed box shadows, console errors or page errors and returned HTTP 200 on `127.0.0.1:4178`.
- The first two fail-closed reviews rejected hidden-content/opacity semantics and then layer stacking/order. Each blocker received a focused RED regression and minimal fix. A fresh final reviewer passed with no security concerns, logic errors or suggestions after independently rerunning 13 focused tests, typecheck and lint.
- One full-suite run logged a transient OpenFreeMap Noto Sans glyph-origin outage while every case still passed. External glyph/tile availability remains a tracked third-party risk. `docs/COMPLETE.md` does not exist because the wider mission gate remains open.

### 2026-08-22 — Straight-segment route authoring (verified)

- The Route tool now accepts map clicks into a visible noncanonical draft with point markers, a straight line, live point count, disabled-until-valid Finish, and explicit Cancel. Finish and Cancel return focus to Select; changing tools discards the draft.
- Finish validates coordinate count/ranges, creates the lowest available canonical `Route NN` ID/name, inserts the route above the basemap, selects it, and records the complete route as one Undo step. Undo removes it and Redo restores it.
- While Route is active, geographic map clicks bypass ordinary feature hit testing. The callback is removed immediately on finish/cancel/tool change, so normal canvas selection and background clearing resume.
- Draft state is excluded from autosave and print/export. Opening or recovering another project invalidates the draft by document epoch, including the stale-source restoration case when Route is reactivated later.
- The complete browser flow creates a route, verifies draft/canonical map synchronization, Undo/Redo, and downloads a layered SVG containing the new route as a named vector group.
- Strict TDD evidence:
  - Store creation first failed because `createRoute` was absent; canonical naming then failed with `route-02` when `route-01` was available, and invalid one-point/non-finite/out-of-range inputs initially created layers before focused fixes.
  - The app flow first failed with no Finish action, then failed before temporary line/point feedback, Cancel behavior, post-Finish focus, project-open invalidation, tool-switch cleanup, and stale-draft nonresurrection were added.
  - The map lifecycle regression first failed because authoring coordinates never reached the application; the minimal routing path now consumes clicks before hit testing only while the authoring callback exists.
  - A full-suite regression exposed that remounting the canvas workspace on document open broke delayed autosave modal focus restoration. Epoch-keyed draft state replaced the remount; the focused autosave arbitration and route suites both pass.
- The first independent fail-closed review rejected two inconsistencies: a composite PNG could include noncanonical draft geometry, and the imperative MapLibre click handler could observe stale authoring mode before its passive callback-ref update. Export is now disabled for the matching document epoch until Finish/Cancel/tool change, with unit and Chromium assertions. A child-before-parent layout-effect regression failed under the passive update and passes after synchronizing click-routing refs during layout.
- Fresh serial verification on the completed tree:
  - `npm test -- --run` — pass, 29 files / 308 tests.
  - `npm run typecheck` — pass.
  - `npm run lint` — pass, zero warnings.
  - `npm run doctor` — pass, no issues; telemetry disabled.
  - `npm run build` — pass; the known ~1.25 MB pre-gzip bundle warning remains.
  - `npm audit --omit=dev` — 0 vulnerabilities.
  - `npm run test:e2e` — 53 pass / 7 documented Firefox WebGL-runtime skips across 60 Chromium, Firefox and WebKit cases. Route authoring/export passes in Chromium and WebKit and runtime-skips in the Firefox fallback environment.
- Browser evidence: refreshed exact 1440×900 `docs/screenshots/latest-desktop.png`, SHA-256 `b01c49876d0ca7fb3ea041b958e00976538699d472d101839bcd6e5832519912`. The live capture showed both draft endpoints, the straight line, and the Finish/Cancel panel with a ready map, zero body overflow, zero gradients/shadows, and empty console/page-error buffers. Visual review found no material clipping, collision, hierarchy, or legibility defect; the preview remained HTTP 200 on `127.0.0.1:4178`.
- Intermediate full browser gates encountered a transient OpenFreeMap glyph-origin outage, then a Chromium PNG case that timed out only after its final download had started; the exact PNG case passed in 9.3 seconds. A later gate exposed the previously tracked Import-trigger focus flake twice in Chromium. Focus restoration now runs from the committed non-pending state rather than a timer plus animation frame. A final review then rejected unconditional refocusing when a user had intentionally moved elsewhere during a pending read; a RED unit regression reproduced the focus theft, and restoration is now gated to neutral/file-input/Import focus. The exact Chromium case and final complete serial suite pass; the suite reports 53 pass / 7 Firefox WebGL-runtime skips. External font/tile availability remains a tracked third-party risk.
- Independent fail-closed route re-review passed with no security concerns, logic errors, or suggestions after 70 focused tests across seven files. The bounded final focus re-review also passed after inspecting all staged files and rerunning 52 focused tests. `docs/COMPLETE.md` does not exist because the wider mission gate remains open.

### 2026-08-22 — Single-click POI authoring (verified)

- Re-audited main, every registered worktree and branch, live Hermes/test processes, artifacts and the enabled preview before editing. Main was clean at `f150e92`; the roadmap, Wave 1 and Wave 2 foundations were already integrated, no agent branch was newly eligible, no duplicate implementation/test worker was running, and `127.0.0.1:4178` remained the sole workspace Vite preview.
- The Pin tool now enters a focused placement mode with visible instructions, an explicit Cancel action, disabled export and an active-tool state. Cancel returns focus to Select without changing history. One valid map click creates the lowest available canonical `POI NN` immediately above the basemap, selects it, returns focus to Select and records one Undo/Redo transaction.
- Created points participate in the existing live MapLibre content adapter and all print paths. The real-browser flow proves the point appears in the map layer order and the layered SVG contains the new POI as a named vector group with a circle.
- Strict TDD evidence: the nominal app interaction first failed because Pin did not disable Export; Cancel first failed because no action existed; three invalid-coordinate cases first created `poi-01`; canonical collision handling first selected duplicate `poi-01` instead of `poi-02`; and the authoring-safe Export title first remained route-specific. Each focused regression passed after its minimal implementation.
- Fresh serial verification: focused POI/route/store/workspace coverage passes 4 files / 36 tests; typecheck passes; ESLint passes with zero warnings; React Doctor reports no issues; Vitest passes 30 files / 314 tests; production build passes with the known ~1.25 MB pre-gzip bundle warning; audit reports 0 vulnerabilities; Playwright passes 55 with 8 runtime Firefox WebGL skips across 63 Chromium, Firefox and WebKit cases.
- Browser evidence: `docs/screenshots/latest-desktop.png` and `docs/screenshots/poi-authoring-20260822.png` are exact 1440×900 captures, SHA-256 `b4ce5b6dc442c82473b571609e394ab50b1775f7c6818e0f5e176c81f8d813a4`. The active POI panel is readable above the toolbar with no clipping or overlap; live metrics report a ready map, zero body overflow, zero computed gradients/shadows and no application console/page errors. One full-suite run again logged transient third-party OpenFreeMap glyph fetch fallbacks while all affected cases passed.
- Independent fail-closed review passed with no security concerns or logic errors after independently running 64 focused unit tests, two Chromium authoring/export cases, typecheck and lint. Non-blocking follow-ups are a POI-specific document-open regression and a numbering-gap/insertion-position store assertion. `docs/COMPLETE.md` does not exist because the wider mission gate remains open.

### 2026-08-22 — Polygon shape authoring (verified)

- Re-audited the main integration worktree, every registered agent worktree/branch, running Hermes/test processes, existing artifacts and preview service before editing. Main was clean at `a35317f`; the roadmap and Wave 1/2 foundations were already integrated, the original Wave branches had no commit ahead of main, and no duplicate implementation worker or workspace test server was running. The enabled preview remained the sole workspace Vite process on `127.0.0.1:4178`.
- The Shape tool now captures map-click vertices into a visible noncanonical draft: point markers for every vertex, an open outline after two distinct clicks, and a closed translucent polygon after three distinct vertices. Finish remains disabled until the polygon has three distinct vertices; Cancel discards the draft and restores focus to Select without changing history.
- Finishing validates finite in-range coordinates and at least three distinct vertices, closes the canonical polygon ring, creates the lowest available `Shape NN` layer immediately above the basemap, selects it, and records the complete shape as one Undo/Redo transaction.
- Shape authoring disables export until Finish/Cancel/tool change. Opening another project invalidates the draft by document epoch and cannot resurrect its prior vertices when Shape is activated again. Draft content remains outside the canonical document, autosave and print/export paths.
- Strict TDD evidence: the store test first failed because `createShape` did not exist; distinct-vertex validation then failed by creating `shape-01`; the app interaction first failed because Shape did not disable Export; Cancel first failed because no action existed; and the document-epoch regression first restored one abandoned vertex. Review remediation then observed RED for repeated clicks enabling Finish and for an already-closed ring receiving a second terminal closure; both pass after distinct gating and canonical closure.
- Browser coverage cancels a draft, draws three real map vertices, verifies open/closed draft rendering, finishes and selects the canonical shape, exercises Undo/Redo, and downloads a layered SVG containing `Shape 01` as a named vector path.
- Fresh serial verification: typecheck passes; ESLint passes with zero warnings; React Doctor reports no issues; Vitest passes 31 files / 324 tests; production build passes with the known ~1.25 MB pre-gzip bundle warning; audit reports 0 vulnerabilities; Playwright passes 57 with 9 documented Firefox WebGL-runtime skips across 66 Chromium, Firefox and WebKit cases.
- Browser evidence: `docs/screenshots/latest-desktop.png` and `docs/screenshots/shape-authoring-20260822.png` are current exact 1440×900 captures, SHA-256 `6fcc85435fb08580bfd65c7555eb1b5d5b80010952e1d4aa6eff4eeba8862b73`. Live metrics report a ready map, zero body overflow, zero computed gradients/shadows and no application console/page errors. Visual review found the draft polygon, three vertices, authoring controls, toolbar, print frame and sidebars readable with no material clipping, overlap or crowding.
- The first fail-closed review rejected repeated-click draft loss and double-closing an already-closed ring. Both received focused RED regressions and minimal fixes. Fresh independent re-review passed with no security concerns or logic errors after inspecting every tracked/untracked change and independently running 75 focused tests, typecheck, lint and React Doctor. Its only nonblocking suggestion is normalizing multiply-closed external input in addition to the supported open and once-closed forms.
- `docs/COMPLETE.md` does not exist because portable ZIP, geometry editing/styles, camera/style/text-scale controls, native high-resolution map detail and the Mapbox renderer/storage decision remain completion blockers.

### 2026-08-22 — Canonical bearing and pitch camera controls (verified)

- Re-audited the clean main integration worktree, every registered agent worktree/branch, running Hermes/test processes, existing artifacts and the enabled preview. Wave 1/2 branches remain already integrated or superseded; none is eligible for another merge, no duplicate implementation/test worker was launched, and `127.0.0.1:4178` remained the sole workspace Vite preview with HTTP 200.
- Added schema-version 4 canonical camera settings. Versions 1–3 migrate to neutral `0°` bearing and `0°` pitch; current portable project files require finite bearing from `-180°` through `180°` and pitch from `0°` through `60°`.
- Bearing and pitch controls now use transaction-safe drafts: typing does not create history, valid blur commits one Undo/Redo step, invalid drafts expose `aria-invalid`, and invalid blur restores the canonical value. External Undo/Redo, Open and autosave recovery remount stale edit boundaries.
- Camera values apply immediately to MapLibre and remain active through **Fit page**. Portable Save/Open and IndexedDB autosave/recovery preserve the values; the browser flows exercise `35°/40°` and `-20°/35°` cases.
- Strict TDD evidence: version-3 migration first returned schema 3 with no camera; camera actions were initially absent; invalid ranges initially entered history; the Project controls were read-only; pitch `61` initially remained aria-valid; the live map initially received no camera update; and Fit page initially omitted bearing/pitch. Each focused assertion passed after its minimal implementation.
- The first final fail-closed review rejected an effect dependency that made Fit page persist after its one-shot command: later bearing/pitch edits refit center/zoom. A focused RED regression received two `fitBounds` calls instead of one; tracking the handled request now preserves current center/zoom while camera edits still apply immediately.
- Fresh serial verification on the final code:
  - `npm test -- --run` — pass, 32 files / 338 tests.
  - `npm run typecheck` — pass.
  - `npm run lint` — pass, zero warnings.
  - `npm run doctor` — pass, no issues; telemetry disabled.
  - `npm run build` — pass; known ~1.25 MB pre-gzip bundle warning remains.
  - `npm audit --omit=dev` — 0 vulnerabilities.
  - `npm run test:e2e -- --workers=1` — 57 pass / 9 documented Firefox WebGL-runtime skips across 66 Chromium, Firefox and WebKit cases.
- Browser evidence: refreshed exact 1440×900 `docs/screenshots/latest-desktop.png`, SHA-256 `6559e34c73f7e433c72b8b2bb0a13ef7d6007f93e34f44e395f9a008cc7fa056`. Live preview inspection committed bearing `35` and pitch `40`, reported `data-map-ready=true`, zero body overflow, zero gradients/shadows and no JavaScript/page errors. Visual review found no material clipping, overlap, fallback map, decorative shadow, hierarchy or control-legibility regression.
- Fresh independent fail-closed re-review passed with no security concerns, logic errors or suggestions after inspecting the complete staged diff and independently rerunning 338 unit tests, focused camera coverage, typecheck, lint, build and audit. A bounded schema-format correction confirmed the staged diff was unchanged and retained the passing verdict.
- `docs/COMPLETE.md` does not exist because portable ZIP, geometry editing/styles, remaining map design controls, native high-resolution map detail and the Mapbox renderer/storage decision remain completion blockers.

### 2026-08-22 — Canonical open map styles (verified)

- Re-audited the clean main integration worktree, every registered agent worktree/branch, live Hermes/test processes, artifacts and the enabled preview. The old Wave branches remain already integrated or superseded; none is eligible for another merge, no duplicate implementation/test worker was launched, and `127.0.0.1:4178` remained the sole workspace Vite preview with HTTP 200.
- Added schema-version 5 canonical map style settings with explicit version-4 migration. **Liberty** and **Positron** are now real selectable OpenFreeMap presets rather than a disconnected dropdown; choosing either is one Undo/Redo transaction and keeps the basemap layer label synchronized.
- Vendored the Positron style from `https://tiles.openfreemap.org/styles/positron` and coalesced its three missing `ref_length` numeric filters, matching the existing clean Liberty integration. Vendored SHA-256: `94c301710f3faf136e18b649b9f9aa1ef463b54cf4972c9714b1fa35e3cf1e12`.
- Style changes recreate the renderer through the existing MapLibre boundary, invalidate stale export/readiness state during loading, rebuild editable overlays after the new style loads and recover by selecting another preset after a style failure. Portable Save/Open and IndexedDB autosave/recovery preserve the selected preset; current project files reject unsupported style IDs.
- Strict TDD evidence: the first UI interaction failed because `positron` was not a canonical option; version-4 migration first remained schema 4 with no style; unsupported portable styles initially parsed; the renderer initially stayed on Liberty; the vendored URL test initially received the remote URL; the basemap label initially remained Liberty; an opened Positron project initially retained the Liberty label; a delayed style request exposed stale `data-map-ready=true`, which produced a visibly blank screenshot before the readiness regression and fix; current-project parsing initially rewrote a custom basemap layer name; and explicit style changes initially did the same before both data-preservation paths were restored.
- Two pre-final fail-closed reviews independently rejected style recreation because a project already at non-zero bearing/pitch created the replacement map at renderer defaults while the UI retained the canonical values. A focused regression received only two `jumpTo` calls instead of three across the style switch. Camera synchronization now reruns for the new preset, transition-time camera attributes are invalidated, and Chromium switches to Positron after setting `35°/40°` before checking the replacement renderer state.
- Fresh serial verification on the final tree: Vitest passes 34 files / 344 tests; typecheck passes; ESLint passes with zero warnings; React Doctor reports no issues; production build passes with the known ~1.25 MB pre-gzip bundle warning; audit reports 0 vulnerabilities; Playwright passes 59 with 10 documented Firefox WebGL-runtime skips across 69 Chromium, Firefox and WebKit cases.
- Final independent fail-closed re-review passed with no security concerns, logic errors or suggestions after inspecting the current staged diff and independently rerunning all 344 unit tests, typecheck, lint, React Doctor, build, audit, the 69-case serial Playwright gate and the focused five-case Chromium editor suite.
- Browser evidence: refreshed exact 1440×900 `docs/screenshots/latest-desktop.png`, SHA-256 `6684690fa3c53cb8bdf8a25b4e16e4aac532acea3534f2485721fc98cb678866`. It visibly shows the Positron basemap plus route, POI and polygon overlays after the `35°` bearing / `40°` pitch style switch, with matching sidebar/control labels. Live metrics report `data-map-ready=true`, overlay order `route-01,poi-cafe,area-center`, zero body overflow, zero gradients/shadows and no console/page errors. Visual review found no material clipping, overlap, fallback, hierarchy or readability defect.
- `docs/COMPLETE.md` does not exist because portable ZIP, geometry editing/styles, global text scale and visibility controls, native high-resolution map detail and the Mapbox renderer/storage decision remain completion blockers.

### 2026-08-22 — Canonical global map text scale (verified)

- Re-audited main, every registered worktree/branch, live Hermes/test processes, artifacts and the enabled preview before editing. The roadmap and Wave 1/2 foundations were already patch-equivalent or integrated, no agent branch was eligible for another merge, and `127.0.0.1:4178` remained the only workspace Vite preview with HTTP 200.
- Added schema-version 6 canonical global map text scale with a validated `50–200%` range. Version-5 projects migrate to `100%`; portable Save/Open and IndexedDB autosave/recovery preserve current values.
- Text scale is a transaction-safe Project property: drafts do not enter history while typing, valid blur creates one Undo/Redo edit, invalid values expose `aria-invalid` and restore canonical state, and external history/open/recovery changes discard stale drafts.
- MapLibre captures each style's original text-size values once per lifecycle and scales from that immutable baseline, so repeated edits do not compound. Numeric sizes, zoom-safe top-level `interpolate`/`step` expressions, live edits and style recreation are covered; Liberty and Positron both retain ready overlays after scaling.
- Terminal renderer states now share a per-lifecycle failure latch. Renderer errors, live text-resize failures and overlay isolation/restoration failures withdraw readiness/export permanently for that lifecycle even if later content synchronization succeeds; selecting another style creates a fresh recoverable lifecycle.
- Strict TDD evidence included expected RED failures for the missing store action, invalid scale acceptance, version-5 migration, unsupported schema 6 parsing, the read-only Project field, missing invalid-state feedback, the absent renderer-scaling module, invalid nested zoom expressions, live resize readiness resurrection, and overlay-restore readiness resurrection. Each focused regression passed after its minimal implementation.
- Fresh final serial verification: `npm test -- --run` passes 37 files / 356 tests; typecheck passes; ESLint passes with zero warnings; React Doctor reports no issues; production build passes with the known ~1.26 MB pre-gzip bundle warning; audit reports 0 vulnerabilities; Playwright passes 59 with 10 expected Firefox WebGL-runtime skips across 69 Chromium, Firefox and WebKit cases.
- Browser evidence: refreshed exact 1440×900 `docs/screenshots/latest-desktop.png`, SHA-256 `7be3bee15dd7617ace90b5b5f20e1ded75390da5198246dec941bfe9a27d364d`. It shows Positron at `125%` with enlarged labels and aligned route/POI/shape overlays. Live preview inspection reported `data-map-ready=true`, canonical `100%` on a fresh project, zero body overflow, zero gradients/shadows and no application console/page errors; visual review found no material clipping, overlap, fallback, hierarchy or readability defect.
- Fail-closed review first rejected live resize recovery, then found the sibling overlay-restoration path. Both received RED-first lifecycle regressions and a shared failure-latch correction. Fresh final independent review passed with no security concerns, logic errors or suggestions after rerunning 114 focused tests, typecheck, lint, React Doctor and changed-line security scans.
- `docs/COMPLETE.md` does not exist because portable ZIP, geometry editing/styles, major feature/label visibility controls, native high-resolution map detail and the Mapbox renderer/storage decision remain completion blockers.

### 2026-08-22 — Canonical major map-feature visibility (verified)

- Re-audited the clean main integration worktree, all registered worktrees and branch divergence, live Hermes/test processes, existing artifacts and the enabled preview before editing. The roadmap and Wave 1/2 foundations remain integrated or patch-equivalent; no old agent branch is newly eligible, no duplicate implementation/test worker was launched, and `127.0.0.1:4178` remained the sole workspace Vite preview with HTTP 200.
- Added schema-version 7 canonical visibility for Roads, Buildings and Labels. Version-6 and older projects migrate to all categories visible; current portable files require explicit booleans. Each checkbox is one Undo/Redo transaction, and portable Save/Open plus IndexedDB autosave/recovery preserve the state.
- The MapLibre boundary classifies the vendored Liberty and Positron basemap layers by source-layer/text semantics, preserves each style layer's original visibility, applies live category changes, and reapplies canonical state after style recreation. Any visibility update failure withdraws renderer/export readiness for that lifecycle instead of publishing a partially trusted export.
- Strict TDD evidence: the store test first failed because `setMapFeatureVisibility` did not exist; the Project interaction first failed because `Show roads` was absent; the controller test first failed because `MapFeatureVisibility` did not exist; the lifecycle test first received no visibility updates; and current portable-project validation first rejected schema 7. Additional RED regressions now prove that Roads leaves rail/transit infrastructure independent and that a live visibility edit withdraws renderer readiness/export until the next idle frame. Each focused test passed after its minimal implementation.
- Fresh serial verification: focused coverage passes 6 files / 78 tests; Vitest passes 40 files / 364 tests; typecheck passes; ESLint passes with zero warnings; React Doctor reports no issues; production build passes with the known ~1.26 MB pre-gzip bundle warning; audit reports 0 vulnerabilities; Playwright passes 59 with 10 documented Firefox WebGL-runtime skips across 69 Chromium, Firefox and WebKit cases.
- Browser evidence: refreshed exact 1440×900 `docs/screenshots/latest-desktop.png`, SHA-256 `7fb98aaedeb20bfaae99435a411b54dee5c2908a9bd6f8089823ce4f157161ff`, with timestamped `docs/screenshots/map-visibility-20260822.png`. It shows Positron with Roads off and the new controls fully visible. Live preview inspection switched Liberty to Positron while preserving `roads:false`, remained map-ready, reported zero body overflow, gradients and shadows, and had no application console/page errors. Visual review found no material clipping, overlap, crowding, fallback, hierarchy or readability defect.
- Fresh independent fail-closed review passed with no security concerns or logic errors after inspecting the complete diff and both vendored style manifests. Non-blocking follow-ups are direct failure-latch coverage for a visibility write exception and manifest-level classification fixtures to detect future style-layer drift.
- `docs/COMPLETE.md` does not exist because portable ZIP, geometry editing/styles, native high-resolution map detail and the Mapbox renderer/storage decision remain completion blockers.

### 2026-08-22 — Deterministic portable project ZIP round trips (verified)

- Re-audited the clean main integration worktree, every registered worktree/branch, live Hermes/test processes, existing artifacts and the enabled preview before editing. Historical Wave branches remain integrated, superseded or patch-equivalent; no agent branch was newly eligible and `127.0.0.1:4178` remained the sole persistent workspace preview with HTTP 200.
- Added a visible **Save ZIP** action while retaining portable JSON **Save**. The ZIP contains exactly `manifest.json` and `project.printmap.json`, uses a fixed archive timestamp, and round-trips the complete validated canonical project through the same Open/history-reset boundary as JSON.
- Open now accepts `.printmap.json` and `.printmap.zip`. Invalid suffixes, malformed archives, unsupported manifests, extra/traversal/duplicate entries, oversized compressed or expanded content, and any embedded-asset declaration remain contained with actionable errors; the current project and history are unchanged. Embedded assets are explicitly unsupported until the canonical schema owns and validates them.
- Archive input and expanded project data are capped at 10 MiB, manifests at 64 KiB, and generated archives are refused before download when they exceed the same bound. Save failures appear as an accessible alert and a successful retry clears it.
- Strict TDD evidence: the archive unit suite first failed because `projectArchive` did not exist; the Chromium nominal flow first timed out because **Save ZIP** did not exist; and the save-error interaction first failed with an uncaught exception and no accessible alert. Each focused test passed after its minimal implementation.
- The first complete browser run exposed two test-only assumptions after the new adjacent action: the old `Save` locator was no longer exact and a dotted ZIP entry name was interpreted as a nested matcher path. Correcting those assertions produced 6/6 focused cross-browser Save tests and a clean final serial gate.
- The first fail-closed review rejected trusting only a ZIP entry's declared expanded size: a stored entry could declare one byte while carrying a 70 KiB manifest. A RED forged-central-directory regression received the manifest JSON error instead of the 64 KiB guard; compressed and declared sizes are now checked before extraction and actual extracted byte lengths are rechecked before decoding.
- The next re-review correctly found that forged DEFLATE metadata could still force unbounded decompression work before the post-extraction guard. A RED 1 MiB highly-compressible forged-manifest regression received a JSON error instead of a compression-method rejection. Project ZIPs now generate and accept only stored method-0 entries, so archive bytes are the hard pre-extraction bound and no untrusted DEFLATE stream runs. The focused archive/save suite passes 9/9 after remediation.
- Fresh final verification: Vitest passes 42 files / 373 tests; typecheck passes; ESLint passes with zero warnings; React Doctor reports no issues; production build passes with the known ~1.28 MB pre-gzip bundle warning; audit reports 0 vulnerabilities; Playwright passes 62 with 10 documented Firefox WebGL-runtime skips across 72 Chromium, Firefox and WebKit cases.
- One post-remediation full browser gate timed out after the unrelated Chromium shape-export download action despite the button becoming enabled. The exact shape case passed in 11.3 seconds immediately afterward, and the complete serial 72-case gate then passed cleanly; this remains tracked with the existing external renderer/tile timing flakes rather than being hidden.
- Artifact evidence: all six independent first/second downloads across Chromium, Firefox and WebKit are byte-identical 2,368-byte ZIPs with SHA-256 `588fdc85fab2b65e6eebd274bf3141b95b21bae7c027457f9386ca4cf3978602`; archive listing reports exactly two fixed-time, stored method-0 entries. The refreshed exact 1440×900 `docs/screenshots/latest-desktop.png` has SHA-256 `c50b1f4e5bdd9d490944ec5419eef9e1c786cc33d9475ffbd6cc4df87413a244` and visibly includes **Save ZIP** without clipping or top-bar crowding. Live inspection reported a ready map, zero body overflow, zero gradients/shadows and an empty console/page-error buffer.
- Final independent fail-closed re-review passed with no security or logic blockers. It confirmed fflate invokes the filter before extraction, every non-method-0 entry is rejected there, compressed/declared sizes are bounded, and actual stored byte lengths are checked afterward. `docs/COMPLETE.md` does not exist because geometry editing/styles, native high-resolution map detail and the Mapbox renderer/storage decision remain completion blockers.

### 2026-08-23 — Canonical content-layer appearance controls (verified)

- Re-audited the integration worktree, all registered worktrees/branches, live Hermes/test processes, existing artifacts and the enabled preview before editing. Historical Wave branches remained integrated or superseded, no branch was newly eligible, no duplicate worker was launched, and `127.0.0.1:4178` remained the sole workspace preview with HTTP 200.
- Route layers now expose canonical color and width; POIs expose color and marker size; shapes expose independent fill, outline color and outline width. Every control validates known bounds, marks invalid numeric drafts with `aria-invalid`, commits one history transaction on blur/change, and supports Undo/Redo without resurrecting abandoned drafts after external history changes.
- The same canonical appearance drives incremental MapLibre paint, imported GeoJSON/GPX/KML defaults, portable JSON/ZIP and IndexedDB persistence, layered SVG vectors and named PDF vectors. Print conversions preserve the previous default visual scale; PDF POIs now retain the same white outline as the live map and SVG.
- Applied the pre-release schema policy directly: schema version 8 is the only current portable format, the legacy migration chain was removed, and versions 1–7 are rejected with a reset-oriented obsolete-file message. The Alpine fixture and save/archive assertions were updated atomically instead of extending migration logic.
- Strict TDD evidence included expected failures for missing Route/POI/Shape controls, invalid-state feedback, canonical paint propagation, SVG/PDF appearance fidelity, portable round trips, import defaults, desktop Tab being incorrectly trapped by a mobile-only focus loop, stale numeric-draft resurrection, obsolete schema 7 acceptance and the missing PDF POI outline. Each focused regression passed after its minimal fix.
- Fresh final serial verification: `npm run typecheck` passes; ESLint passes with zero warnings; React Doctor reports no issues; Vitest passes 44 files / 376 tests; production build passes with the known ~1.28 MB pre-gzip bundle warning; `npm audit --omit=dev` reports 0 vulnerabilities; Playwright passes 64 with 11 documented Firefox WebGL-runtime skips across 75 Chromium, Firefox and WebKit cases.
- Browser evidence: refreshed exact 1440×900 `docs/screenshots/latest-desktop.png`, SHA-256 `4aad4a77799bd05905e53cb54c50a553a45bbf20c445d5d2247a48c411b1cfe3`; refreshed 390×844 `docs/screenshots/latest-mobile.png`, SHA-256 `837b0c7a7e5c646a1aa32830fa3077653d79f8ded32656b24f086f8897f631b6`. Live metrics reported a ready map, zero body overflow, zero gradients/shadows, a focused mobile Properties dialog and no console/page errors. Visual review found the new controls readable with no material clipping, overlap or hierarchy defect.
- The fail-closed review initially rejected ambiguous schema-7 replacement semantics and a missing PDF POI outline. Both received RED-first corrections; the one bounded independent recheck passed both blockers with no new issue. `docs/COMPLETE.md` does not exist because geometry editing, native high-resolution map detail and the Mapbox renderer/storage decision remain completion blockers.

### 2026-08-23 — Direct POI coordinate editing (verified)

- Added Longitude and Latitude fields for selected point layers. Drafts remain outside history while typing; finite in-range values commit on blur as one canonical edit, while empty or out-of-range values expose `aria-invalid`, restore the saved coordinate and leave history unchanged.
- Tab from Longitude continues directly into Latitude even though the committed field receives a fresh transaction boundary. Undo/Redo restores the fields and canonical geometry without stale drafts.
- Coordinate edits rebuild the live MapLibre GeoJSON source and expose synchronized geometry diagnostics. The canonical edit therefore flows through IndexedDB autosave, portable JSON/ZIP, and the existing print scene without a parallel geometry model.
- Strict TDD evidence: focused tests first failed for the missing Longitude field, missing Latitude field, lost Tab focus (`BODY` received focus), and missing live geometry synchronization attribute. The first combined adapter run then caught repeated geometry serialization during selection-only syncs; caching the geometry diagnostic with the existing immutable content revision restored the performance invariant.
- Fresh tiered verification: 4 focused unit files pass 75/75; typecheck passes; ESLint passes with zero warnings; React Doctor reports no issues; the impacted Chromium appearance/geometry browser file passes 2/2. The independent reviewer additionally reran the focused unit set, typecheck, lint and the targeted all-browser file (Chromium/WebKit pass; renderer-fallback cases skip at runtime) and returned a fail-closed pass with no security or logic errors.
- The review's only non-blocking suggestion was to prove the actual MapLibre source definition rather than relying only on the diagnostic attribute. The focused adapter regression now asserts that the rebuilt GeoJSON source contains the moved `[2, 3]` point and passes.
- Browser evidence: refreshed exact 1440×900 `docs/screenshots/latest-desktop.png`, SHA-256 `b6fdd37897c4c71a8ee9e7bf45960cd8b02f282610c47e9df793344a294c4198`. It shows Coffee stop at `16.4° / 48.25°`; live metrics report a ready map, synchronized geometry, zero body overflow, zero gradients/shadows and no console/page errors. Visual review found the Location section readable with no material clipping, overlap, blank map, crowding or hierarchy defect.
- This is the first feature slice after the last complete serial gate, so the fast tier policy retains the prior full-suite/build/audit evidence until the third slice or a cross-cutting/final gate. `docs/COMPLETE.md` remains absent.

## Next unresolved slice

Build one bounded route-vertex editing flow with selected-vertex movement, live map feedback, undo/redo, validation and print/export fidelity. Native high-resolution map detail and the Mapbox renderer/storage decision remain later blockers.
