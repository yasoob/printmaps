# Development tools

## Central studio state

Schema 26 adds one persisted `ProjectDocument.studio` namespace. Schema 24
migrates through neutral style customization; schema 25 adds disabled studio
defaults. Existing studio settings, if present in either legacy version, are
validated and retained, never replaced. Camera, page, style, project title and
layer geometry remain canonical; studio contains only distinct composition and
output preferences. New visual effects are off by default.

`src/domain/studio.ts` defines the seven typed sections: poster, photos,
decorations, wall, terrain, video and relief. Panels select their section with
`useProject` and call `useProjectActions`, not a separate context or persistence
store. `setStudioSection(section, value)` replaces one complete typed section;
`applyStudioTemplate({ poster, page?, style?, camera?, silhouette?,
expectedDocumentEpoch? })` applies a composition and optional new shape in one
admitted history entry without replacing unrelated layers. Inserting a new
silhouette hides the previous referenced silhouette in that same entry, retaining
its layer and geometry. A visible locked previous silhouette rejects insertion
until it is unlocked or hidden; unrelated shapes are never changed. A template cannot
change or unlock a locked camera; omit `camera` to apply composition alone.
`addPhotoStop({ stop, asset, poi?, presentation?, expectedDocumentEpoch? })`
atomically attaches an image to an existing Point POI or inserts a new POI.
Optional `presentation: 'map' | 'strip'` enables the requested photo mode only
when both modes were disabled, in the same history entry. Omit it to preserve
visibility. `removePhotoStop(id)` removes the
attachment and any newly unreferenced photo asset, retaining the POI. All four
actions return `ProjectMutationResult`; callers must surface rejection errors.

Photos reference canonical POI layer IDs, silhouettes reference polygon shape
layers, location QR targets use the camera center or a Point POI, and relief
ridges reference routes. Layer deletion clears dependent references and prunes
photo assets in the same transaction; hidden layers remain valid references and
renderers must honor their visibility. `validatePhotoFile` accepts embedded PNG
and JPEG only, verifies dimensions and content hashes, and bounds each file to
1 MiB / 2048 pixels per edge. Projects allow 24 photo assets/stops, 6 MiB encoded
photo data, 16,777,216 decoded photo pixels, and the existing aggregate 10 MiB
portable limit across every section, marker asset and layer.

Studio admission detaches and deep-freezes settings before caching. Unchanged
sections retain identity through camera changes and history, while caller-owned
mutable values never enter the studio validation cache. JSON/ZIP, IndexedDB,
clone/open, undo/redo and pristine checks all operate on the complete document.

## Vector artwork export

SVG and PDF offer an opt-in **True vector artwork (reflowed labels)** mode.
Hybrid remains the default and retains the original renderer appearance.
Vector artwork decodes source vector tiles using public libraries and the
applied style snapshot; it never reads private MapLibre renderer fields or
traces a screenshot. The same clipped geometry and computed glyph placements
feed SVG paths/text and PDF path/text operators. Basemap PDF resources are
transparency-group Form XObjects, not Image XObjects.

This is a distinct placement mode, not a pixel-identical MapLibre export.
Labels are reflowed with deterministic collisions, line placement, embedded
Noto Sans Latin, sharp halos, and generic named markers/reference shields
instead of sprite artwork. Original label fonts, wrapping, repeated labels,
and icon artwork are intentionally not reproduced. Unsupported glyphs fail
explicitly rather than turning into question marks. Noto Sans is supplied by
`@fontsource/noto-sans` under SIL OFL 1.1; its notice is served at
`/licenses/noto-sans-OFL.txt` and embedded in vector SVG metadata.

Supported basemap layers are background, fill (including holes), line
(including caps, joins, dashes and sort order), circle,
and reflowed symbol text/markers from HTTP(S) vector tile sources. Official
MapLibre style-spec evaluation handles constants, legacy functions, filters,
and camera/data expressions. Raster/satellite, patterns, extrusions, hillshade,
terrain, non-Mercator/pitched/rolled maps, feature/global state, nonzero line
gap/offset/blur, translated geometry, custom tile protocols, MLT encoding, and other unimplemented properties
fail with Hybrid guidance. No fallback file is silently downloaded.

`PreviewPngExporter.captureRenderSnapshot()` is the common synchronous,
ready-only immutable style/content/camera/frame/footprint contract.
`captureVectorBasemap({ signal })` adds revision guards and bounded data
capture. `VectorBasemapCapture` contains a detached scene and mathematical
coordinate projector; it has no canvas, raster blob, or live map reference.
The dialog clones the canonical document at job start and keeps delivery mode
local, without adding a second durable project store.

Limits are 64 source tiles, 4 MiB per response, 32 MiB total input, 100,000
feature evaluations, one million decoded/generated points, 10,000 candidate
labels (256 characters each), and a 30-second capture deadline. Capture yields
between batches and releases stream readers, timers, and map/abort listeners.
Cancellation never creates an automatic hybrid download.

Focused checks:

```bash
npm run typecheck
npx vitest run tests/unit/vector-export.test.ts tests/unit/map-render-snapshot.test.ts
PLAYWRIGHT_EDITOR_PORT=4194 npx playwright test tests/e2e/vector-export.spec.ts --project=chromium --workers=1
```

## React Scan

React Scan is available as development-only render instrumentation.

```bash
npm run dev
```

Its toolbar appears in the browser and **Outline Re-renders** is active. Set
`VITE_REACT_SCAN=false` to disable it for a development process. Automated
browser tests disable it by default.

The bootstrap loads React Scan before React DOM, then mounts the application.
Its global render callback automatically discovers every named component that
mounts, including nested, private, and lazily loaded components. Entries in
`REACT_SCAN_TARGETS` only add human-readable areas for major boundaries; they do
not limit tracking. Production builds eliminate the scanner branch and do not
contain React Scan code.

Run the repeatable layer-preview probe with:

```bash
npm run audit:renders
```

The default audit port is 4176. Override it for an isolated worktree, and put
raw results outside the repository:

```bash
PLAYWRIGHT_EDITOR_PORT=4292 npm run audit:renders -- --output=/absolute/path/audit-results
node scripts/react_scan_inventory.mjs /absolute/path/audit-results /absolute/path/inventory.json
```

The inventory command resolves first-party JSX targets with TypeScript symbols
and reconciles them against every test's global runtime inventory. It fails if
a source target was never observed. The report records creation sites, owning
interactions, source aliases, passive icon/provider deliveries and runtime
owner paths. A green reconciliation proves source-target coverage, not that
every render is necessary; the browser probes separately assert semantic owners
and stable siblings.

The suite includes layer navigation, project/camera/style settings, search and
authoring, import/replacement, advanced routes and async providers, autosave and
renderer recovery, composition/photos/decorations, terrain, real MP4 recording,
wall preferences, sharing and desktop/touch modal help. Route, POI, shape-point
and shape-transform drags have separate live, commit and settle windows. Live
previews must cause zero React renders, and acknowledged commits retain marker
nodes without replaying native source writes.

Each probe writes raw JSON and a Playwright attachment with aggregate component totals,
per-instance events (stable fiber ID, owner path, phase, source, changed props),
editor-marker DOM additions/removals, and MapLibre source/layer/paint/layout
method calls. Native calls include a map instance ID and surface
(`editor`, `shared`, `video`, `offscreen`, or `unknown`), terrain/image changes
and camera methods. Camera snapshots inspect native preview state without
altering the canonical project. A video's isolated map may legitimately use
the same source IDs as the live editor; compare the map ID and surface too.
React Scan 0.5.7 does not currently emit change reasons or unnecessary-render
classifications through its runtime callback, so the probe adds a shallow
comparison of current and previous props.

Field-level probes also record the static `controlLabel` and assert both the
allowed labels and distinct fiber instance counts. A panel updating correctly
does not justify rerendering its unchanged fields. Studio controls deliver
stable per-key actions through `useSettingActions`, backed by the existing
latest-committed-value event helper; text groups receive scalar props so
validation may continue safely detaching nested objects without waking sibling
groups. Dynamic choice arrays follow their actual choice data, not the complete
settings object.

Normal shared-map bootstrap still skips React Scan. Only the explicit
development fixture `tests/e2e/react-scan-viewer.html` installs the probe before
mounting the real shared viewer. Its tests prohibit IndexedDB access; no
production or normal shared-view privacy guard is weakened.

Renderer availability is an ephemeral capability channel in
`src/app/mapExporterContext.ts`, not persisted project state. Wall/silhouette
actions read the current capability at invocation; only open output dialogs
subscribe to readiness. Poster inputs are consumed below the native workspace
in `EditorStudioMapCanvas`; project identity is not a poster renderer input.
Settings remain exclusively in the canonical `ProjectDocument.studio`.

Reload the page after changing probe instrumentation. The controller is
installed before React DOM, so an already-open page can otherwise retain an
older probe instance through hot module replacement.

To extend the audit, define one user interaction and its expected render set in
the Playwright probe, run `npm run audit:renders`, then fix one unexpected
dependency and rerun the same probe before moving to the next interaction. Add
an entry to `REACT_SCAN_TARGETS` only when a discovered component needs a more
descriptive area in the inventory.
