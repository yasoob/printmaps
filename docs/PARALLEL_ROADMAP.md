# Print Map Studio — Missing Features and Parallel Delivery Roadmap

This document compares the current verified baseline (`9f11983`) with `MISSION.md` and the implementation plan. It distinguishes the core completion gate from later feature breadth and defines a conflict-safe multi-agent workflow.

## Current verified baseline

Implemented and verified:

- Figma-like responsive editor shell and live MapLibre canvas
- Canonical versioned project document and migrations
- Layer selection, visibility, locking, ordering, duplication, deletion, and undo/redo
- Rendering of existing route, POI, and polygon geometries
- Standard/custom page sizes and orientation
- Portable project JSON Save and validated Open
- Low-resolution cropped browser PNG preview
- Mobile drawers, attribution behavior, accessibility, and browser coverage for the above

An isolated worker is currently completing IndexedDB autosave/recovery. Treat that working tree as owned until it produces a reviewed commit.

## Major missing core features

### P0 — blocks `MISSION.md` completion

1. **Finish persistence**
   - Complete and merge IndexedDB autosave/recovery with corruption/quota handling.
   - Add portable project ZIP download/upload, embedded asset handling, and deterministic round trips.
   - Add project sharing for small asset-free projects or explicitly constrain Share to portable files.

2. **Map design controls**
   - Camera/bounds persistence, bearing, pitch, frame lock, scale, and geolocation.
   - Multiple open style presets.
   - Major feature/label visibility categories and global text scale.
   - Explicit Mapbox token/origin failure guidance and the renderer/storage decision record.

3. **Route creation and editing**
   - Searchable start/stops and provider-neutral route interfaces.
   - Mapbox Directions and Map Matching adapters with abort, rate-limit, offline, 401/403/422/429 handling.
   - Easy snapped road routes and expert straight/great-circle/arc segments.
   - Point insertion/dragging, mode icons, color/width controls, and undo/redo.

4. **POI and shape creation/editing**
   - Create POIs from map, coordinate, or approved search result.
   - Marker shape, fill/stroke, icon/label, size, and validated custom image assets.
   - Create/edit polygon shapes with fill/stroke/opacity and geometry limits.
   - Existing sample geometry rendering is not a substitute for authoring tools.

5. **Local import pipeline**
   - Strict GeoJSON import.
   - GPX and KML parsing with malformed/oversized fixture coverage.
   - Drag/drop and file chooser UI, multi-file behavior, fit-to-bounds choice, styling, replace, and error/focus states.

6. **Real print/export pipeline**
   - Deterministic print scene with named SVG groups and raster-basemap/vector-overlay honesty.
   - Export preflight: physical size, DPI, pixels, effective PPI, memory, assets/tiles/fonts, attribution, and color-space warnings.
   - High-resolution tiled/strip PNG with progress, cancellation, overlap, and hard allocation guards.
   - Layered SVG and exact-page-size PDF generation.
   - Structural tests for dimensions, group names/order, clips, credits, and embedded assets.
   - The current cropped PNG is a preview, not the required print export.

7. **End-to-end completion flow**
   - One nominal user flow across Chromium, Firefox, and WebKit: design map → create/edit content → import → save/reopen → export PNG/PDF/SVG.
   - Offline, token/origin, partial tile, import limit, storage quota, export limit, and cancellation cases.
   - Final performance, responsive, console-clean, accessibility, and fail-closed review gates.

### P1 — important after the core gate

- Same-origin PMTiles basemap/data path and source provenance
- URL-hash sharing and project templates
- Bulk POI spreadsheet with a 300-row cap and queued geocoding
- Static POI database with category filters
- Administrative boundary selection/merge/inversion
- Mapbox isochrones capped honestly at 60 minutes
- Layered RGB PSD with explicit limitations
- Expanded styles, languages, and high-detail mode

### P2 — later breadth

- Elevation profile maker
- Komoot integration after OAuth/terms review
- Licensed aerial imagery
- Optional approved non-Mapbox providers
- Specialized templates and embedding workflows

## Conflict-safe parallel execution model

### Invariants

- Use **one git worktree and branch per agent**.
- Cap implementation concurrency at **three agents** on this host (3 CPU cores, limited available RAM, active autonomous worker).
- Parallel agents own new leaf modules and focused unit tests only.
- A single integration owner controls `App.tsx`, `store.ts`, `project.ts`, `MapCanvas.tsx`, `editor.spec.ts`, `package.json`, and the lockfile.
- Never run multiple Playwright/full-suite jobs concurrently. Agents run focused unit tests with one worker; the integrator runs all gates serially after each merge.
- Every agent must use RED → GREEN, commit a passing scoped change, and return a SHA plus exact verification.
- Rebase each branch onto the latest clean main before integration. Use a neutral merge reconciler for nontrivial conflicts.

### Wave 1 — running now

| Branch | Worktree | Exclusive ownership | Deliverable |
|---|---|---|---|
| `agent/import-geojson` | `/root/printmap-agents/import-geojson` | `src/import/**`, one new unit test/fixture subtree | Strict bounded GeoJSON-to-layer import core |
| `agent/export-preflight` | `/root/printmap-agents/export-preflight` | `src/export/preflight.ts`, its new unit test | Memory/dimension/preflight and tile/strip planning |
| `agent/print-scene` | `/root/printmap-agents/print-scene` | `src/print/scene.ts`, its new unit test | Deterministic named-group layered SVG scene core |

The current main-worktree agent remains the sole owner of IndexedDB autosave/recovery. Wave 1 agents must not touch main or shared hotspot files.

### Integration sequence

1. Wait for the autosave worker to produce a reviewed clean commit.
2. Inspect every agent SHA and diff; reject scope violations.
3. Rebase Wave 1 branches onto the new main.
4. Merge in dependency order: export preflight → print scene → GeoJSON import.
5. After each merge run focused tests, typecheck, lint, and React Doctor.
6. After the wave run the full unit suite, build, audit, and Playwright serially.
7. Use one integration slice to wire the three foundations into UI without parallel edits to hotspots.
8. Update findings, capture screenshots, independently review, and commit.

### Wave 2 — after Wave 1 integration

Run three isolated foundation agents:

1. **Mapbox provider core:** token validation, provider interfaces, abort/debounce/error normalization, deterministic mocked tests.
2. **GPX/KML import:** XML parsing and limits behind the Wave 1 import contract; one agent owns any dependency/lockfile change.
3. **High-resolution raster compositor:** tile execution/cancellation built on preflight; no UI wiring.

Then integrate provider/search UI, import UI, and export UI serially.

### Wave 3 — authoring tools

Parallelize lower-level engines only:

1. Route geometry/segment engine.
2. POI marker and custom-asset validation engine.
3. Polygon draw/edit validation engine.

One integration owner subsequently connects Terra Draw/MapLibre, store history, properties UI, and browser tests.

## Agent completion contract

Every worker returns:

- branch and exact commit SHA;
- files changed;
- observed RED test and final GREEN commands;
- formulas, limits, validation decisions, and known gaps;
- confirmation that no shared hotspot or secret was touched.

A branch is not merged merely because its author reports success. The integration owner verifies the diff and reruns the required gates.
