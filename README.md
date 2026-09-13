# Print Map Studio

A free, local-first map design studio for creating static, print-ready maps in the browser. Design the base map, add routes, places and areas, import geographic data, then export PNG, PDF, layered SVG or layered PSD without creating an account.

## Live site

- Marketing site: [https://printmaps.yasoob.me/](https://printmaps.yasoob.me/)
- Map editor: [https://printmaps.yasoob.me/editor/](https://printmaps.yasoob.me/editor/)

## Product capabilities

- Standard and custom print dimensions in millimetres, with landscape and portrait orientation.
- Multiple map styles, label languages, text scaling and map-detail visibility.
- Editable routes, places, custom markers, shapes, administrative boundaries and travel-time areas.
- GPX, KML and GeoJSON import, plus spreadsheet-based place creation.
- Browser-local autosave and portable project downloads.
- Print-sized PNG, exact-page PDF, layered SVG and layered PSD export.

Provider-backed place search, road routing, map matching, address lookup and isochrones require a browser-safe Mapbox public token. Core editing and OpenFreeMap rendering remain available without one.

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

## Deployment

Pushes to `main` build and deploy the Astro `dist/` directory through `.github/workflows/deploy-pages.yml`. Configure `VITE_MAPBOX_PUBLIC_ACCESS` as an Actions secret to enable provider-backed tools in the deployed editor.
