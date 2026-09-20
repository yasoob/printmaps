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

The suite probes layer preview and selection, title/autosave commits, and
wheel zoom plus route/POI/shape marker drags. Marker drags are split into
live-preview and commit windows: live previews must cause zero React renders.
Each probe writes a JSON attachment with aggregate component totals,
per-instance events (stable fiber ID, owner path, phase, source, changed props),
editor-marker DOM additions/removals, and MapLibre source/layer/paint/layout
method calls.
React Scan 0.5.7 does not currently emit change reasons or unnecessary-render
classifications through its runtime callback, so the probe adds a shallow
comparison of current and previous props.

Reload the page after changing probe instrumentation. The controller is
installed before React DOM, so an already-open page can otherwise retain an
older probe instance through hot module replacement.

To extend the audit, define one user interaction and its expected render set in
the Playwright probe, run `npm run audit:renders`, then fix one unexpected
dependency and rerun the same probe before moving to the next interaction. Add
an entry to `REACT_SCAN_TARGETS` only when a discovered component needs a more
descriptive area in the inventory.
