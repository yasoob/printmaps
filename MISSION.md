# Autonomous Mission: Print Map Studio

## Goal

Implement the plan in `.hermes/plans/2026-08-21_074735-printmaps-client-side-clone.md` as a working static client-side map editor. The UI follows `docs/UI_BRIEF.md`.

## Completion gate

The mission is complete only when all of the following are true:

1. `npm run build`, `npm run typecheck`, `npm run lint`, `npm run doctor`, `npm test -- --run`, and `npm run test:e2e` all exit 0.
2. The app loads with a live map when a valid public Mapbox token is available and presents an actionable token/origin error otherwise.
3. Desktop UI has a Figma-like left Layers sidebar, center canvas, right contextual Project/Layer properties sidebar, and bottom floating tool palette; there are no gradients and no decorative shadows.
4. Selection is bidirectional: layer-list and canvas selection both switch the right panel from Project to Layer properties; clicking empty canvas clears selection.
5. Project properties change page size/orientation, map style, bearing/pitch, text scale, and attribution state.
6. Core content supports route, POI and shape layers with create/select/edit/hide/lock/reorder/delete/duplicate and undo/redo.
7. GPX, KML and GeoJSON fixtures import locally and appear as editable content layers.
8. Project save/open/autosave works locally through IndexedDB and portable JSON/ZIP download/upload.
9. PNG, PDF and layered SVG exports are generated client-side. Large raster export uses tiled/strip rendering with preflight guards and cancellation.
10. Every implemented UI interaction has automated behavioral coverage at the appropriate level: Testing Library for deterministic component/store behavior and Playwright for real map, browser, focus, pointer, keyboard, responsive, download, and persistence flows. E2E tests exercise the complete nominal flow in Chromium, Firefox and WebKit.
11. Export tests assert dimensions and named SVG groups.
12. A 390px smoke test has no body horizontal overflow, and the browser console is clean in nominal desktop/mobile flows.
13. `docs/FINDINGS.md` records evidence, open limitations and exact verification output. `docs/COMPLETE.md` is created only after every gate passes and includes commands, output summaries and the final commit SHA.

## Current scope order

1. Vertical shell: editor layout, map, project/layer selection, tests.
2. Project document, layers, undo/redo and persistence.
3. Route/POI/shape tools and Mapbox provider adapter.
4. GPX/KML/GeoJSON import.
5. SVG/PNG/PDF export and tiled large export.
6. Accessibility, responsive behavior, visual QA, performance and final review.
7. Phase-2 capabilities from the plan only after the core gate is solid.

## Per-run protocol

1. Read this file, `docs/FINDINGS.md`, `docs/UI_BRIEF.md`, the implementation plan, `git status`, recent commits and test output.
2. Inspect live processes and `.hermes/mission.lock`; do not launch duplicate dev servers or workers.
3. Select one highest-value unresolved vertical slice.
4. Follow strict RED → GREEN → REFACTOR: write one falsifiable test first and run it to observe the expected failure.
5. Implement the smallest complete slice. Add or update tests for **every UI interaction introduced or changed** in that slice, including pointer, keyboard, selection/focus, disabled/error, and responsive behavior where applicable.
6. Run focused tests, the full relevant test suite, and `npm run doctor`; React Doctor findings are blocking unless documented as a verified false positive.
7. Capture the current UI after every run—even for primarily nonvisual slices—at 1440×900, and at 390×844 when responsive behavior changed. Save the stable latest desktop image to `docs/screenshots/latest-desktop.png`, preserve timestamped evidence when materially changed, and include `MEDIA:/root/workspace/docs/screenshots/latest-desktop.png` in every progress report.
8. Update `docs/FINDINGS.md` with evidence, screenshot path, and unresolved risks.
9. Run independent code review for multi-file changes, fix blockers, and commit verified progress.
10. Report concise progress and the next unresolved slice with the latest screenshot.

## Rules

- Never commit `.env.local` or the supplied public token.
- Never ship a secret Mapbox token; only browser-safe public tokens are supported.
- Keep the provider and map renderer behind interfaces because Mapbox display terms remain a tracked product risk.
- No gradients and no decorative drop shadows.
- Do not claim fully vector basemaps: layered SVG/PDF keeps user overlays vector while the basemap may be raster.
- Do not claim CMYK/PDF-X or editable PSD type.
- Do not lower or rewrite the completion gate to declare success early.
- Bound subprocesses and clean them up.
- Every implemented UI interaction must be covered while it is implemented; do not defer interaction tests to a later cleanup phase.
- Every run must capture and deliver the latest 1440×900 UI screenshot, even when the slice is mostly nonvisual.
- React Doctor is a mandatory per-slice gate. Run `npm run doctor` after implementation and before review/commit, and fix React-specific issues rather than suppressing them without evidence.
