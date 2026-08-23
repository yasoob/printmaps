# Printmaps.net feature parity

Evidence refreshed: **2026-08-23 (UTC)**.

This comparison treats the current official Printmaps.net product pages as the external source of truth and the current Print Map Studio source/tests as local evidence. It excludes pricing, checkout, licensing, email delivery, and WordPress presentation.

## Official live-source evidence

1. **Map design and print detail** — [Printmaps features](https://www.printmaps.net/features/) says users can set standard/custom millimetre sizes, choose map styles, selectively show map items, change map language and text scale, rotate freely, and tilt to 60°. It describes worldwide cartography at all zoom levels. [Printmaps home](https://www.printmaps.net/) describes 300-DPI or vector output.
2. **Route authoring** — [Printmaps features](https://www.printmaps.net/features/) describes Easy Mode with searched destinations and Expert Mode with map clicks; routes can be straight, arced, or magnetically road-snapped, with adjustable color/width and optional plane, train, car, walking, cycling, and ship icons.
3. **Recorded-route import** — [Printmaps features](https://www.printmaps.net/features/) explicitly supports GPX, KML, and GeoJSON uploads and says multiple recorded routes can be displayed.
4. **POIs and bulk entry** — [Printmaps features](https://www.printmaps.net/features/) describes single POIs placed by dragging or exact spreadsheet location, configurable size/color/icon, custom pins (minimum 100×100 px), and address lists pasted from Excel into a spreadsheet.
5. **Administrative areas** — [Printmaps features](https://www.printmaps.net/features/) describes selecting countries, municipalities, and regions from its database, with fill color/transparency, invert, and a documented two-shape recipe for highlighted borders.
6. **Layered output** — [Printmaps features](https://www.printmaps.net/features/) says SVG/PSD downloads retain user-content layers and map-feature layers such as hillshading, roads, and buildings. [Printmaps home](https://www.printmaps.net/) advertises PNG, layered PSD, and vector SVG and says every map feature is a separate layer.

## Current local parity matrix

| Capability | Status | Concrete local evidence | Strict gap / caveat |
|---|---|---|---|
| Physical page, orientation, bearing/pitch, text scale | Implemented | `src/domain/project.ts`; `src/app/components/ProjectProperties.tsx`; unit coverage under `tests/unit/app/` | Map-area lock and geolocation remain absent. |
| Open map styles and major visibility | Partial | `src/map/mapStyles.ts`; `src/map/MapFeatureVisibility.ts`; `tests/unit/map-styles.test.ts`; `tests/unit/map-feature-visibility.test.ts` | Liberty/Positron only; no language selector or Printmaps-style expanded detail catalogue. |
| Native-detail print PNG | Implemented with explicit multi-region guards | `src/map/NativeMapExport.ts` renders each preflight region through a fresh target-pixel MapLibre map at increased zoom, scales basemap and canonical overlay styling into print pixels, and fails closed for pitched or independently placed symbol seams; `src/export/printSizePng.ts` composes safe overlap regions 1:1; unit and browser export tests prove exact 3508×2480 and guarded two-region 7087×591 output. | This is native target-resolution raster rendering, not a browser-canvas enlargement. Multi-region jobs require 0° pitch and Labels off; single-region jobs retain labels and pitch. PNG still has no embedded physical-resolution metadata. |
| Expert route drawing and vertex editing | Partial | `src/app/components/CanvasWorkspace.tsx`; `src/domain/routeProfiles.ts`; `src/domain/routeGeometry.ts`; `tests/unit/route-profiles.test.ts`; `tests/e2e/route-authoring.spec.ts` | Straight and great-circle arc drawing, six travel-mode choices, optional live/vector-print mode markers, vertex editing and Undo/Redo are implemented. Address/search-driven routes and road snapping remain gated by `docs/decisions/0001-mapbox-renderer-and-storage.md`; the compact mode markers are not yet a full pictographic icon catalogue. |
| POI placement, coordinates, appearance | Partial | Point authoring and coordinate/appearance controls in `src/app/`; canonical appearance in `src/domain/layerAppearance.ts`; browser coverage in `tests/e2e/editor.spec.ts` | No labels/icons/marker shapes, custom image upload, searchable placement, or spreadsheet/batch entry. |
| Polygon drawing/editing | Implemented for freeform geometry | `src/domain/shapeGeometry.ts`; `src/app/storeShapeActions.ts`; shape browser flows in `tests/e2e/editor.spec.ts` | No administrative-area catalogue, automatic merge, or invert operation. |
| GPX/KML/GeoJSON import | Implemented | `src/import/geojson.ts`; `src/import/gpxKml.ts`; parser/unit fixtures and `tests/e2e/project-files.spec.ts` | No drag/drop, multi-file fit choice, or replace workflow yet. |
| Local save/open/autosave | Exceeds official core workflow | IndexedDB autosave under `src/storage/`; deterministic portable JSON/ZIP under `src/domain/projectArchive.ts`; project-file/autosave browser suites | Intentionally local/client-side; no account or email workflow. |
| PNG, layered SVG, PDF | Partial / exceeds in format breadth | `src/export/printSizePng.ts`, `src/export/layeredSvg.ts`, `src/export/printPdf.ts`; structural/browser export tests | SVG/PDF keep user overlays as named vectors but embed a **raster basemap**. They do not provide individually editable roads, buildings, labels, water, or hillshade layers. PDF is an extra format; PSD is absent. |
| Layer editing and history | Implemented / exceeds | Canonical store actions support select, hover preview, hide, lock, reorder, duplicate, delete, and Undo/Redo; covered across store/app/E2E suites | Replace-in-place import remains absent. |

## Priority after this refresh

1. Rich POI labels/icons/custom markers and bounded spreadsheet entry.
2. Broader styles, language, and detail controls.
3. Administrative area selection, merge, fill, outline, and invert.
4. Secondary tools such as elevation profiles.

Address/search-driven and road-snapped routes remain a high-value gap, but stay fail-closed until the accepted Mapbox renderer/storage boundary permits a compliant implementation.

## Claims we must not make

- A prior browser-preview resample was not native 300-DPI detail. The current PNG path qualifies only because MapLibre rerenders each preflight region at target pixel dimensions and increased source zoom before 1:1 composition.
- Layered SVG/PDF are not fully vector basemaps and do not match Printmaps' claim of separately editable basemap feature layers.
- PNG physical-resolution metadata, layered PSD, CMYK/PDF-X, account sharing, and provider-backed snapped routes are not implemented.
