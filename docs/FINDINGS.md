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

## Next unresolved slice

Move project-level page dimensions/orientation, camera bearing/pitch, style, text scale and attribution into the canonical document with one transaction-safe property interaction, then prove undo/redo and visible canvas/property synchronization through strict TDD.
