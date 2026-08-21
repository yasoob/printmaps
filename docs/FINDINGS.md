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

## Next unresolved slice

Add validated portable `.printmap.json` upload/open as one history-resetting, focus-safe flow, then implement IndexedDB autosave/recovery in a separate slice.
