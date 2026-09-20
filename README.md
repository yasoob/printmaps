# Print Map Studio

A free, local-first map design studio for creating print-ready maps, photo posters, terrain models, and short map videos in the browser. Design the base map, add routes, places and areas, import geographic data, then export PNG, PDF, SVG, layered PSD, STL, or MP4 without creating an account.

## Live site

- Marketing site: [https://printmaps.yasoob.me/](https://printmaps.yasoob.me/)
- Map editor: [https://printmaps.yasoob.me/editor/](https://printmaps.yasoob.me/editor/)

## Product capabilities

- Standard and custom print dimensions in millimetres, with landscape and portrait orientation.
- Multiple map styles, label languages, text scaling and map-detail visibility.
- Editable routes, places, custom markers, shapes, administrative boundaries and travel-time areas.
- GPX, KML and GeoJSON import, plus spreadsheet-based place creation.
- Browser-local autosave and portable project downloads.
- No-account read-only share links, deliberate remix, and responsive iframe embeds.
- Print-sized PNG, exact-page PDF, layered SVG and layered PSD export.

Provider-backed place search, road routing, map matching, address lookup and isochrones require a browser-safe Mapbox public token. Core editing and OpenFreeMap rendering remain available without one.

### Map and layout settings

The Project inspector opens on **Map**: Style, Labels & details, Terrain, and
View. **Layout** contains Page, Map frame, Text, Photos, and Map elements. Page
owns paper size, orientation, background and margins; Text owns the title,
subtitle, caption and coordinates. Tabs, disclosures and contextual layer
navigation keep field state without creating undo or autosave edits.

**Layout → Change layout** applies a finished design to the current map while
keeping text, routes, points, shapes, photos and camera position. **Project → New
from template** offers designs and starter places as new documents, using the
same backup, cancel and replacement confirmation as New project. Confirmed
starters supply their own title, location and design.

**Map frame → Country / region** fits an administrative outline without
restyling the page or replacing its text. Rectangle hides the active outline
without deleting its geometry; Undo restores it. Camera and layer locks retain
their normal editing protections.

Photo attachments reference existing point layers rather than storing a second
set of coordinates. They can appear as anchored images or a numbered caption
strip. Moving, hiding, or deleting the point affects its attachment consistently.
Local PNG/JPEG images are embedded in the portable project; they are not uploaded.

**Export → Preview framed** uses the same composed artwork as print exports, with frame,
wall, and mat preferences. Opening or closing the preview does not change the
project or undo history. Poster text, photos, decorations, and attribution are
included in PNG, SVG, PDF, and PSD; PSD keeps a named composition Smart Object.
PDF poster typography supports Latin text; unsupported characters are rejected
with SVG/PNG guidance rather than substituted. Scale bars require a flat,
non-terrain map, and coordinate grids do not support pitched maps.

Durable settings live in the versioned central project document, including
`document.studio`. Validated store actions update them atomically with undo/redo;
previews, sharing, and export adapters consume those same settings. Dialog state,
render projections, and recording progress are transient, not additional project
stores. See [the state contracts](docs/DEVELOPMENT.md).

### Share, remix and embed

**Share** captures the completed design at the button click, including embedded images,
styles and annotations. The versioned, compressed snapshot lives entirely in the URL
fragment; there is no upload, short-link service or account. URLs are capped at 64 KiB
(some messaging apps impose smaller limits), and expanded projects at the existing
10 MiB portable limit. Oversized designs fail explicitly without dropping content;
use a project download instead. Links are public to anyone who receives them, not
encrypted or revocable, and later edits never update an existing link.

Shared links and embeds open a separate read-only viewer without reading or writing
local autosave. Invalid links also leave the local project untouched. Pan/zoom is
ephemeral and downloads retain the original snapshot. **Remix this map** restores
the local editor first and uses the normal replacement confirmation and backup-download
workflow before replacing existing work. Embed HTML supports responsive width,
240–2000 px height and optional preview navigation; attribution is always retained.
The viewer uses the shared poster/photo/decoration renderer and the same terrain
settings as the editor, with explicit errors for unsupported combinations. Downloads
preserve the original project, not the ephemeral preview camera. Wall, video and
relief settings round-trip unchanged and remain available after remixing.
Production shared-page startup does not load analytics or send the fragment to it.
The isolated production privacy/mobile check runs with
`npx playwright test --config=playwright.sharing.config.ts --project=chromium`.

## Architecture and routes

Astro statically renders the marketing site, while the React 19 and MapLibre editor is isolated as a client application at `/editor/`. Marketing pages do not download the editor bundle. The homepage uses Tailwind CSS and a small progressive-enhancement script for its accessible feature tour.

| Route | Purpose |
|---|---|
| `/` | Homepage with product hero, capabilities, interactive feature tour, use cases and FAQ |
| `/#features` | Interactive design, content and export tour |
| `/#use-cases` | Publishing, tourism, property, event, personal and planning workflows |
| `/#faq` | Product, storage, provider and export answers |
| `/editor/` | Client-side map editor |

## Local development

```bash
npm ci
npm run dev
```

Astro serves the site at `http://127.0.0.1:4321/`; open `/editor/` for the application.

To enable provider-backed tools, add a browser-safe token to `.env.local`:

```bash
VITE_MAPBOX_PUBLIC_ACCESS=pk.example
```

Never use or commit a secret Mapbox token.

## Editor analytics

The production Astro shell loads the existing Google Analytics tag (`G-T6SVFKL7C4`).
The editor reuses its `gtag` queue; it does not load a second tag or add an analytics
dependency. Development and tests send nothing unless a `window.gtag` stub is
explicitly supplied. An unavailable or blocked tag does not affect editing.

Custom interactions use one GA4 event, **`editor_action`**, with an **`action`**
parameter identifying the semantic action. Tracking shared store actions covers
buttons, keyboard shortcuts, map edits and drag-and-drop without duplicate click
listeners. Only successful state changes are counted; initialization, restoration,
no-op/invalid edits and programmatic camera amendments are excluded. UI and
asynchronous workflows are tracked separately at their user-action boundaries.
An import workflow event and the resulting `importLayers` mutation describe
different stages, not two clicks.

| Coverage | Action examples |
|---|---|
| Editor entry and export dialog | `editorOpened`, `exportDialogOpened` |
| Project and history | `setProjectTitle`, `undo`, `redo` |
| Page, camera and map settings | `setPagePreset`, `setCameraViewport`, `setMapStyle`, `setMapFeatureVisibility` |
| Layer creation and management | `createRoute`, `createPoi`, `createShape`, `selectLayer`, `duplicateLayer`, `moveLayer`, `deleteLayer` |
| Geometry and appearance | `setRouteVertex`, `transformRoute`, `setShapeGeometry`, `setLayerAppearance`, `setPoiCustomMarker` |
| Map matching, place lists and boundary selection | `mapMatchingStarted`, `mapMatchingCompleted`, `poiListCommitCompleted`, `boundaryCountrySelected` |
| Imports, exports, search and provider workflows | Catalog: [`workflowActions.ts`](src/analytics/workflowActions.ts) |
| Drawing tools, panels, previews and navigation | Catalog: [`uiActions.ts`](src/analytics/uiActions.ts) |

The complete mutation catalog is in [`projectActions.ts`](src/analytics/projectActions.ts);
entry, map-matching, list and boundary actions are in `CORE_ACTIONS` in
[`editorAnalytics.ts`](src/analytics/editorAnalytics.ts).
Metadata is runtime-allowlisted: `format`, `source`, `enabled`, `layer_type`,
`map_style`, `page_preset`, `orientation`, `feature`, `language`, `route_kind`,
`operation` and `setting`. Names, text, coordinates, IDs, URLs, file contents and
raw exceptions are never copied into custom events. A setting's **name**, such as
`label` or `color`, can be recorded, but not its user-entered value.

Rapid text, numeric, color and geometry edits are grouped by action, layer type
and setting after 500 ms of inactivity. Pending edits flush before another
discrete action, when the page becomes hidden, or on page exit. This measures
editing activity, not literal keystrokes or every slider step. Export completion
means the browser initiated the download, not that the user saved it to disk.
Delivery remains subject to browser privacy settings, consent configuration and
network availability; this change does not add a consent-management system.
File-reading workflows start after a file is selected; dismissing the browser's
native chooser without selecting a file does not produce a workflow event.

**GA4 setup:** after deployment, check Realtime for `editor_action`. In
**Admin > Data display > Custom definitions**, create an event-scoped custom
dimension named "Editor action" for parameter `action`. Register additional
parameters above only when needed for reporting (for example `format` and
`layer_type`). New dimensions can take 24-48 hours to appear in reports and do not
backfill historical data. Use Explore to break event counts down by Editor action.
To treat a specific action as a conversion/key event, create a derived GA4 event
filtered by `event_name = editor_action` and the desired `action`, rather than
marking every editor interaction as a key event.

For local verification, stub `window.gtag` in the browser console to log calls;
the unit tests use the same approach and never contact Google. Add new static
actions to the appropriate catalog and call `trackEditorAction` at the shared
handler, not in render effects or generic DOM click listeners. GA4 Enhanced
Measurement/GTM click rules alone cannot reliably identify completed editor
operations, so semantic instrumentation is preferable here.

## Verification

```bash
npm run typecheck
npm run lint
npm run doctor
npm test -- --run
npm run build
npm run test:e2e:marketing
npm run test:e2e:release
```

Chromium is the acceptance browser. `test:e2e:release` runs the editor suite in three serialized shards and then the Astro marketing suite. `npm run test:e2e` is the Linux/Xvfb release wrapper.

## Export model

PNG, PDF and layered PSD basemaps render from bounded native MapLibre regions rather than enlarging the browser preview. PNG includes 300 DPI physical-resolution metadata. PDF preserves the exact page and named vector overlays. Layered SVG keeps supported routes, places and shapes as named vector groups. Layered PSD keeps the basemap raster while embedding each content layer and attribution as a separately named SVG Smart Object with a compatibility preview, using 300 DPI when the browser memory-safe document limits allow it.

SVG/PDF also offer opt-in **True vector artwork (reflowed labels)**. This exports
editable basemap geometry and text, not a screenshot wrapped in a vector file.
Text placement and generic symbol artwork are intentionally regenerated; use
the default Hybrid mode to retain the renderer's appearance. Unsupported styles,
glyphs, terrain, and camera configurations fail explicitly with Hybrid guidance.

### Map videos

Open **Map video → Export map video** in the Project inspector for an orbit or
sway MP4, with duration, target frame rate, aspect, and quality controls. The
complete poster is fitted into the video, including photos, decorations, and
attribution. Recording uses an isolated renderer and does not animate the
project camera or populate undo history. Native MP4 recording support is
required; unsupported browsers receive an explanation, not a renamed WebM file.
See [video behavior and limits](docs/map-video-export.md).

### Terrain, contours and printable relief

Project settings include optional 3D terrain, real elevation contours, and building extrusion where the basemap has height data. All are off by default. Terrain uses the public AWS/Mapzen Terrarium elevation tiles; contours use `maplibre-contour` in a dedicated, reference-counted worker. Contours appear from zoom 5, with intervals coarsened on small-scale maps for readability and bounded processing. Enabled terrain and contours are retained in native raster exports. Multi-region raster exports reject 3D terrain rather than producing mismatched seams; reduce the output size or disable terrain in that case.

**Export 3D terrain STL** downloads a solid model of the current print frame, not the entire viewport. Set camera Pitch to 0 (bearing is supported), then use **Fit dimensions to print frame** to preserve geographic proportions. Choose millimeter dimensions, positive base thickness, exaggeration and low/medium/high detail (64/128/256 samples along the longest edge). An optional visible route becomes a tapered ridge fused into the terrain surface, including at crossings; narrow ridges that cannot be resolved at the selected detail block export with a suggested minimum width. The solid has an outward-wound top, closed walls and a bottom, with no overlapping route tubes. Buildings, labels, photos and decorative overlays are not included.

Elevation downloads are cancelable and timeout-bound, with four concurrent tile loads, a 32-tile decoded LRU cache, and a 64-tile per-relief budget. Missing data or excessive geometry blocks the export instead of fabricating heights. Negative elevations are shifted so the lowest sample sits on the base; a flat region produces a flat solid. All four elevation-aware print corners are interpolated across the model, with the same inverse projection used for its route ridge. Physical scale uses average footprint edge lengths at the frame-center Mercator scale, not survey-grade measurements. STL does not declare units: import it as **millimeters** in your slicer. Elevation credits appear in the UI, map exports and STL header; full regional credits are available in the [Terrain Tiles attribution list](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). Printing, manufacturing and shipping are not provided.

## Deployment

Pushes to `main` build and deploy the Astro `dist/` directory through `.github/workflows/deploy-pages.yml`. Configure `VITE_MAPBOX_PUBLIC_ACCESS` as an Actions secret to enable provider-backed tools in the deployed editor.
