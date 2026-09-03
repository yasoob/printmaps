# Re-render audit tracker

Updated: 2026-09-02

## Scope and method

- React Scan is enabled only in development and observes the entire React tree.
- The inventory below contains the 84 initial component identities plus 15
  layer-inspector identities discovered after selecting a route.
- Each component gets one read-only probe agent. Interactive components are
  probed directly; passive and third-party leaf components are probed through
  their nearest owning interaction.
- A render is not automatically a defect. Agents must distinguish required
  visual/state updates from referential churn and unchanged-subtree renders.
- No dependency changes are made until the interaction map is complete enough
  to choose between local stabilization and a broader data-flow change.

## Audit gaps corrected

1. **React Scan cannot see imperative rendering.** MapLibre source/layer
   mutations, marker DOM movement, canvas painting, image registration, and
   layout/paint property writes need dedicated spies or observable diagnostics.
2. **A mounted-component inventory is not complete coverage.** Route selection
   added 15 lazy inspector identities after the initial 84-component capture.
3. **One interaction hides transient phases.** Marker drag preview and drag-end
   commit now use separate probe windows; asynchronous autosave settling is also
   measured separately.
4. **Component names can aggregate instances.** Shared `Button`, icon, and
   primitive results now include per-instance fiber IDs and owner paths.
5. **Unsettled pages create false positives.** Probes wait for map readiness and
   a quiescent interval before starting.
6. **Imperative marker remounts are invisible to React callbacks.** The probe
   now records editor-marker DOM additions/removals in the same interaction
   result.
7. **A component outline is not a leaf-level dependency map.** React Scan can
   outline an ancestor whose descendants committed, and the initial audit
   incorrectly treated every route-inspector descendant as required. Probe
   events now record `didCommit`, and each interaction has a semantic owner
   allowlist plus explicit exclusions for stable sibling sections.

## Render-system test mix

| Surface | Instrumentation | Covered interactions | Invariant |
|---|---|---|---|
| React component tree | React Scan app callback | Layer hover/selection, title commit, route/POI/shape marker drag | Only semantic owners render; live marker previews cause no React work. |
| MapLibre content sources/layers | Map method spies | Route, POI, and shape geometry commits; selection/preview; unchanged sync | Only changed sources and old/new highlight paint update; no unrelated rebuild. |
| Non-React marker DOM | Marker harnesses + browser drag | Route vertices, POIs, shape vertices/transforms, route draft points | Drag previews update the owned source directly and commit once at drag end. |
| Camera synchronization | Render counters + lifecycle tests | Amend stream, history settle, fit/location requests | Pointer-rate camera updates stay inside the map boundary. |
| Style/language/visibility | Map method spies + lifecycle tests | Style preset/customization, language, feature visibility, text scale | Update only matching existing MapLibre properties; style reload rehydrates once. |
| Map image registry | Image lifecycle spies | Custom POI assets and route pictograms | Register/prune only referenced images and close decoded resources. |
| Async persistence | Fake repository/timers + React Scan title probe | Debounce, in-flight save, failure, corruption recovery | Status surfaces may render; expensive canvas/properties children stay isolated. |
| Portals/focus | Browser interaction + React Scan | Project/layer menus, import/export/autosave dialogs | Popup lifecycle stays inside its owner and restores focus. |
| Lazy inspector trees | React Scan selection probe | Project-to-route inspector swap and advanced sections | Lazy mounts are expected; stable callbacks do not wake unrelated siblings. |
| Export/capture | Existing export capture and format tests | Raster/vector/PSD/PDF capture | Export visibility/style transitions restore the live map after capture. |

## Interaction matrix

| Interaction | Expected renders | Unexpected renders | Changed references / evidence | Decision |
|---|---|---|---|---|
| Hover `Route 01` in layer list | Map preview boundary | Root shell, canvas chrome/search/authoring, properties, autosave surfaces, static icons | Fresh root `model`; fresh canvas bundles; route callbacks; autosave object | Move preview ownership below `StudioApp`; stabilize canvas/route models. |
| Select one layer | Selected and previously selected rows, properties, map selection | Canvas chrome/search props and unrelated route callbacks | `selectedId` plus fresh route/authoring bundles | Keep row comparator; fix upstream callback/model identity. |
| Toggle layer visibility/lock | Target row, layer list delivery, map content, selected properties | `StudioProperties`, autosave surfaces, unrelated canvas controls | `layers` is required; `m`, route callbacks, chrome bundles are not | Preserve immutable layer update; split sibling ownership. |
| Activate/cancel authoring tool | Tool chrome, active authoring panel, map interaction mode, export disabled state | Inactive panel objects, all shared Buttons/icons, search callback | `activeTool` required; all panel bundles rebuilt | Stabilize each authoring domain model; do not memoize icons individually. |
| Type/submit location search | Search, results, search icons | Parent hover can independently replace `onSelect`; result `onChoose` recreated on every local render | Query/results required; callback references unstable | Stabilize search action at canvas boundary, then optionally memoize results. |
| Open/close project menu | Project file actions and Base UI menu/focus/portal subtree | None outside menu owner | Required `open`, focus, positioning lifecycle | Keep local state and third-party primitives. |
| Edit project title | Project title editor and pencil mount/unmount | None outside local editor | Required local `editing`/draft state | Keep header/title boundary. |
| Camera amend stream | Camera wrapper and map | None in deterministic render-cost tests | Camera only | Preserve narrow camera selector and document semantics. |
| Bearing, page, style, text scale, or geolocation commit | Matching inspector field plus map/project/history/autosave consumers | Aggregate model also rebuilds unrelated canvas/search/authoring references | Semantic project change is required; broad prop churn is not | Split root consumer models; do not split camera from document. |
| Autosave status transition | Autosave status/notices/dialogs | Aggregate `StudioAppModel` currently wakes canvas/properties siblings | Fresh `autosave` and root model objects | Give autosave surfaces their own memoized model/boundary. |
| Drag an existing route point | Selected route source during drag; selected route source/paint on commit | Before fix, drag-end geometry changed the global content structure and removed/re-added every visible MapLibre layer/source | Geometry coordinates were embedded in `contentStructure`; incremental sync repainted every layer | Separate layer topology from mutable data; call `setData`/paint only for the changed route and changed highlights. |
| Wheel zoom | History control, autosave status, camera wrapper, map, scale | Before fix, root app, complete header/menu/import tree, complete layer/dnd tree, properties wrappers, search, authoring controls, and icons | Root-owned autosave status plus scale nested inside canvas chrome | Split autosave contexts, history subscription, autosave footer, tool/search callbacks, and scale/chrome boundaries. |
| Route handle geometry commit | Route line plus route handles | Handles briefly relied on DOM insertion timing and passive-effect reinstallation | No explicit marker z-index; route editing installed in `useEffect` | Install route markers in a layout effect and assign the editor marker overlay `z-index: 3`. |
| Route point properties commit | Route structure, matching, vertex coordinates, and elevation | Identity, appearance, extension, marker style, segment style, provenance, directions status, autosave surfaces, and sidebar shell | Whole-layer objects and inline action props crossed a mixed-dependency inspector | Preserve appearance/provenance identities, stabilize action delivery, and memoize geometry-independent sections. |

## Component probe matrix

Status values: `queued`, `running`, `mapped`, `blocked`, `fixed`, `not-actionable`.

| Component | React creation site | Baseline: layer hover | Agent | Probe result | Decision | Status |
|---|---|---:|---|---|---|---|
| `App` | `src/mountApp.tsx` | No | `probe-app` | Static provider root held | Keep | not-actionable |
| `StudioAppView` | `src/app/App.tsx` | Yes | `probe-studio-view` | Aggregate `model` wakes broad siblings | Split consumer models | mapped |
| `StudioHeader` | `src/app/components/StudioAppView.tsx` | No | `probe-studio-header` | Title state stayed child-local | Keep selectors/memo | not-actionable |
| `LayersSidebar` | Unknown | No | `probe-layers-sidebar` | Sidebar stayed silent on hover; setter wakes root | Move preview ownership | mapped |
| `PropertiesSidebar` | `src/app/components/StudioAppView.tsx` | Yes | `probe-properties-sidebar` | Three route callbacks changed on hover | Stabilize upstream actions | mapped |
| `ProjectProperties` | `src/app/components/PropertiesSidebar.tsx` | No | `probe-project-properties` | Narrow camera/style/page subscriptions are correct | Keep boundary | not-actionable |
| `CanvasWorkspace` | `src/app/components/StudioAppView.tsx` | Yes | `probe-canvas-workspace` | Required preview plus fresh route/view models | Split preview and stabilize models | mapped |
| `CanvasWorkspaceView` | `src/app/components/CanvasWorkspace.tsx` | Yes | `probe-canvas-view` | Five bundles/callbacks replaced | Stabilize composition | mapped |
| `CanvasWorkspaceChrome` | `src/app/components/CanvasWorkspaceView.tsx` | Yes | `probe-canvas-chrome` | All panel/tool props rebuilt | Split authoring models | mapped |
| `MapCanvas` | `src/app/components/CanvasWorkspaceView.tsx` | Yes | `probe-map-canvas`, `recheck-map-canvas` | Visual changes required; unrelated route props churn | Preserve camera path; stabilize inputs | mapped |
| `LocationSearch` | `src/app/components/CanvasWorkspaceView.tsx` | Yes | `probe-location-search` | Query state required; parent `onSelect` unstable | Stabilize search action | mapped |
| `StudioApp` | `src/app/App.tsx` | Yes | `probe-studio-app` | Root preview/autosave state rebuilds model | Split ownership | mapped |
| `StudioBrand` | `src/app/components/StudioHeader.tsx` | No | `probe-studio-brand` | Memo boundary held | Keep | not-actionable |
| `ProjectTitleEditor` | `src/app/components/StudioHeader.tsx` | No | `probe-title-editor` | Local edit renders required | Keep | not-actionable |
| `Pencil` | `src/app/components/ProjectTitleEditor.tsx` | No | `probe-pencil-icon` | Required edit-mode mount/unmount | Keep icon | not-actionable |
| `AnonymousComponent#1` | Unknown | Yes (9) | `probe-anonymous-one`, `retry-anonymous-one` | Source unavailable; rerender did not reproduce after quiescence | No speculative fix | blocked |
| `Undo2` | `src/app/components/StudioHeader.tsx` | No | `probe-undo-icon` | Primitive history selector owner | Keep icon | not-actionable |
| `Redo2` | `src/app/components/StudioHeader.tsx` | No | `probe-redo-icon` | Retry failed to exercise redo; same owner contract as Undo | Keep icon; test owner | not-actionable |
| `ProjectFileActions` | `src/app/components/StudioHeader.tsx` | No | `probe-file-actions` | Menu state isolated | Keep | not-actionable |
| `DropdownMenu` | `src/app/components/ProjectFileActions.tsx` | No | `probe-dropdown-menu` | Required local menu lifecycle | Keep | not-actionable |
| `MenuRoot` | `src/components/ui/dropdown-menu.tsx` | No | `probe-menu-root` | Third-party state primitive | Keep dependency | not-actionable |
| `FloatingTree` | Unknown | No | `probe-floating-tree` | Required positioning/focus work | Keep dependency | not-actionable |
| `DropdownMenuTrigger` | `src/app/components/ProjectFileActions.tsx` | No | `probe-dropdown-trigger` | Required popup trigger work | Keep | not-actionable |
| `MenuTrigger` | `src/components/ui/dropdown-menu.tsx` | No | `probe-menu-trigger` | Required Base UI trigger work | Keep | not-actionable |
| `FolderKanban` | `src/app/components/ProjectFileActions.tsx` | No | `retry-folder-icon` | One required menu-owner render | Keep icon | not-actionable |
| `ChevronDown` | `src/app/components/ProjectFileActions.tsx` | No | `probe-chevron-down` | Required menu-state leaf render | Keep icon | not-actionable |
| `DropdownMenuContent` | `src/app/components/ProjectFileActions.tsx` | No | `probe-dropdown-content` | Required portal/content mount | Keep | not-actionable |
| `MenuPortal` | `src/components/ui/dropdown-menu.tsx` | No | `probe-menu-portal` | Passive portal | Keep dependency | not-actionable |
| `GeoJsonImportButton` | `src/app/components/StudioHeader.tsx` | No | `probe-geojson-import` | Required import-local state | Keep controller boundary | not-actionable |
| `ImportTrigger` | `src/app/components/GeoJsonImportButton.tsx` | No | `probe-import-trigger` | Pure trigger; import work belongs to owner | Keep | not-actionable |
| `MapDataImportPortals` | `src/app/components/GeoJsonImportButton.tsx` | No | `probe-import-portals` | Unrelated input produced zero renders | Keep | not-actionable |
| `Dialog` | `src/app/components/MapDataImportPortals.tsx` | No | `probe-dialog` | Required modal lifecycle | Keep | not-actionable |
| `DialogRoot` | `src/components/ui/dialog.tsx` | No | `probe-dialog-root-1` | Required third-party lifecycle | Keep dependency | not-actionable |
| `DialogContent` | `src/app/components/MapDataImportPortals.tsx` | No | `probe-dialog-content-1` | Required focus/busy-state work | Keep | not-actionable |
| `DialogPortal` | `src/components/ui/dialog.tsx` | No | `probe-dialog-portal-2` | Passive portal wrapper | Keep dependency | not-actionable |
| `Download` | `src/app/components/StudioHeader.tsx` | No | `retry-download-icon` | Passive header icon; owner stays stable | Keep icon | not-actionable |
| `PanelLeftClose` | `src/app/components/LayersSidebar.tsx` | No | `probe-panel-close-icon-1` | Required panel-state icon | Keep icon | not-actionable |
| `DragDropProvider` | `src/app/components/LayersSidebar.tsx` | No | `probe-drag-provider` | Required dnd context work | Keep dependency | not-actionable |
| `AnonymousComponent#2` | Unknown | No | `probe-anonymous-two` | Best match is drag overlay renderer | Keep with drag lifecycle | not-actionable |
| `LayerRow` | Unknown | No | `retry-layer-row` | Only changed/selected rows render; siblings skip | Keep comparator | not-actionable |
| `Eye` | `src/app/components/LayersSidebar.tsx` | No | `probe-eye-icon` | Required target-row icon swap | Keep icon | not-actionable |
| `Route` | `src/app/components/LayersSidebar.tsx` | Yes | `probe-route-icon` | Required owner render | Keep icon | not-actionable |
| `LockOpen` | `src/app/components/LayersSidebar.tsx` | No | `probe-lock-open-icon-1` | Required target-row icon swap | Keep icon | not-actionable |
| `GripVertical` | `src/app/components/LayersSidebar.tsx` | No | `probe-grip-icon` | Required reorder leaf | Keep icon | not-actionable |
| `MapPin` | `src/app/components/LayersSidebar.tsx` | Yes | `probe-map-pin-icon` | Row stays silent; root preview churn confirmed | Fix preview owner, not icon | mapped |
| `Shapes` | `src/app/components/LayersSidebar.tsx` | Yes | `retry-shapes-icon` | Static lucide leaf | Keep icon | not-actionable |
| `Layers` | `src/app/components/LayersSidebar.tsx` | Yes | `retry-layers-icon` | Required selection/lock owner work | Keep icon | not-actionable |
| `Lock` | `src/app/components/LayersSidebar.tsx` | No | `probe-lock-icon` | Required target-row icon swap | Keep icon | not-actionable |
| `DragOverlay` | `src/app/components/LayersSidebar.tsx` | No | `probe-drag-overlay` | Required pointer-drag lifecycle | Keep dependency | not-actionable |
| `ProjectAutosaveStatus` | `src/app/components/LayersSidebar.tsx` | No | `probe-autosave-status` | Status changes required; root ownership broad | Split autosave model boundary | mapped |
| `StudioCanvas` | `src/app/components/StudioAppView.tsx` | Yes | `retry-studio-canvas` | `m` wakes canvas for sibling changes | Split canvas model | mapped |
| `CanvasWorkspaceWithCamera` | `src/app/components/StudioAppView.tsx` | Yes | `retry-camera-wrapper` | Narrow camera selector is correct; other props broad | Keep wrapper; stabilize other inputs | mapped |
| `RouteEditorError` | `src/map/MapCanvas.tsx` | Yes | `retry-route-error` | Re-executes with unchanged null message | Memoize locally | mapped |
| `MobilePanelActions` | `src/app/components/CanvasWorkspaceView.tsx` | Yes | `probe-mobile-panel-actions` | Hover changes only recreated `children` | Stabilize top-dock/search composition | mapped |
| `Search` | `src/app/components/LocationSearch.tsx` | Yes | `probe-search-icon` | Required search-state leaf | Keep icon | not-actionable |
| `LocateFixed` | `src/app/components/LocationSearch.tsx` | Yes | `probe-locate-fixed-icon` | Required search-state leaf | Keep icon | not-actionable |
| `LocationSearchResults` | `src/app/components/LocationSearch.tsx` | Yes | `probe-location-search`, `retry-search-results` | Results/index required; `onChoose` recreated | Stabilize callback after parent fix | mapped |
| `SlidersHorizontal` | `src/app/components/CanvasWorkspaceChrome.tsx` | Yes | `probe-sliders-icon` | Static panel icon follows owner | Keep icon | not-actionable |
| `SelectedShapeEditControls` | `src/app/components/CanvasWorkspaceChrome.tsx` | Yes | `retry-shape-controls` | Executes null branch for unrelated chrome changes | Fix chrome model, not leaf | mapped |
| `PoiAuthoringControls` | `src/app/components/CanvasWorkspaceChrome.tsx` | Yes | `probe-poi-authoring` | Tool lifecycle required; panel callbacks rebuilt | Stabilize POI model | mapped |
| `Button` | `src/app/components/CanvasWorkspaceChrome.tsx` | Yes (8) | `retry-button` | Aggregates instances; owner callbacks/children change | Fix owners, not shared primitive | mapped |
| `MousePointer2` | `src/app/components/CanvasWorkspaceChrome.tsx` | Yes | `probe-pointer-icon` | Static tool icon | Keep icon | not-actionable |
| `MapScale` | `src/app/components/CanvasWorkspaceChrome.tsx` | Yes | `probe-map-scale` | Camera renders required; preview render is owner churn | Isolate scale/chrome from preview | mapped |
| `StudioProperties` | `src/app/components/StudioAppView.tsx` | Yes | `probe-studio-properties` | `m` changes for unrelated canvas state | Split properties model | mapped |
| `X` | `src/app/components/PropertiesSidebar.tsx` | Yes | `probe-x-icon` | Static icon follows sidebar churn | Fix sidebar inputs, not icon | not-actionable |
| `ProjectPropertiesPanel` | `src/app/components/PropertiesSidebar.tsx` | No | `probe-project-panel` | Narrow subscriptions hold | Keep | not-actionable |
| `InspectorAccordion` | `src/app/components/ProjectProperties.tsx` | No | `probe-inspector-accordion` | Disclosure state is local | Keep | not-actionable |
| `ChevronRight` | `src/app/components/PropertyControls.tsx` | No | `probe-chevron-right` | Required disclosure leaf | Keep icon | not-actionable |
| `PropertyRow` | `src/app/components/ProjectProperties.tsx` | No | `probe-property-row` | Pure layout wrapper | Keep | not-actionable |
| `PageDimensionField` | `src/app/components/ProjectProperties.tsx` | No | `retry-page-dimension` | Field and canvas frame update required | Keep field; split unrelated root work | mapped |
| `InputGroup` | `src/app/components/ProjectProperties.tsx` | No | `retry-input-group` | Compound input owner; no independent issue | Keep | not-actionable |
| `InputGroupAddon` | `src/app/components/ProjectProperties.tsx` | No | `probe-input-addon` | Ref-only compound input behavior | Keep | not-actionable |
| `InputNumber` | `src/app/components/ProjectProperties.tsx` | No | `probe-input-number` | Pure forwarded input | Keep | not-actionable |
| `MapStyleGallery` | `src/app/components/ProjectProperties.tsx` | No | `retry-style-gallery` | Selection behavior required; scan capture inconclusive | Keep pending owner refactor | mapped |
| `Check` | `src/app/components/MapStyleGallery.tsx` | No | `probe-check-icon` | Required selected-style leaf | Keep icon | not-actionable |
| `MapStyleCustomizeTrigger` | `src/app/components/ProjectProperties.tsx` | No | `retry-style-trigger` | Open/close/focus behavior correct | Keep | not-actionable |
| `RotateCcw` | `src/app/components/ProjectProperties.tsx` | No | `probe-reset-icon` | Required reset leaf | Keep icon | not-actionable |
| `TextScaleField` | `src/app/components/ProjectProperties.tsx` | No | `retry-text-scale` | Text scale and map update required | Keep field; split unrelated root work | mapped |
| `CameraField` | `src/app/components/ProjectProperties.tsx` | No | `probe-camera-field` | Camera input/map update required | Keep field and narrow selectors | mapped |
| `Switch` | `src/app/components/ProjectProperties.tsx` | No | `probe-switch` | Required controlled boolean | Keep primitive | not-actionable |
| `GeolocationControl` | `src/app/components/ProjectProperties.tsx` | No | `retry-geolocation` | Local status and map/location changes required; route/chrome refs also churn | Stabilize root/canvas models | mapped |
| `Checkbox` | `src/app/components/ProjectProperties.tsx` | No | `probe-checkbox` | Required controlled boolean | Keep primitive | not-actionable |
| `AnonymousComponent#3` | Unknown | Selection only | `probe-anonymous-three` | Runtime source remained unavailable | No speculative fix | blocked |
| `LayerProperties` | `src/app/components/PropertiesSidebar.tsx` | Selection only | `probe-layer-properties` | Required mount when route becomes selected | Keep mount boundary | not-actionable |
| `LayerIdentityProperties` | `src/app/components/LayerProperties.tsx` | Selection only | `probe-layer-identity` | Existing comparator protects identity controls | Keep memo boundary | not-actionable |
| `LayerMenu` | `src/app/components/LayerIdentityProperties.tsx` | Selection only | `probe-layer-menu` | Required local menu/focus state | Keep local owner | not-actionable |
| `Ellipsis` | `src/app/components/LayerMenu.tsx` | Selection only | `probe-ellipsis-icon` | Static lucide menu icon | Keep icon | not-actionable |
| `PropertySection` | `src/app/components/LayerProperties.tsx` | Selection only | `probe-property-section` | Pure selected-property layout | Keep | not-actionable |
| `LayerTypeProperties` | `src/app/components/LayerProperties.tsx` | Selection only | `probe-layer-type` | Required layer-type dispatch | Keep | not-actionable |
| `RouteTypeProperties` | `src/app/components/LayerProperties.tsx` | Selection only | `probe-route-type` | Required route-type dispatch | Keep | not-actionable |
| `RouteLayerProperties` | `src/app/components/LayerProperties.tsx` | Selection only | `probe-route-layer-properties` | Required route inspector composition | Keep | not-actionable |
| `RouteAppearanceControls` | `src/app/components/RouteLayerProperties.tsx` | Selection only | `probe-route-appearance` | Direct route-style mutation path | Keep | not-actionable |
| `RouteExtensionControls` | `src/app/components/RouteLayerProperties.tsx` | Selection only | `probe-route-extension` | Required guarded extension controls | Keep | not-actionable |
| `RouteAdvancedProperties` | `src/app/components/RouteLayerProperties.tsx` | Selection only | `probe-route-advanced` | Mixed geometry and static sections were initially classified together | Isolate and assert static route sections | fixed |
| `LineRouteAdvanced` | `src/app/components/RouteAdvancedProperties.tsx` | Selection only | `probe-line-route` | Required line-route controls | Keep | not-actionable |
| `DirectionsProvenanceSummary` | `src/app/components/RouteAdvancedProperties.tsx` | Selection only | `probe-directions-summary` | Geometry changes left provenance unchanged | Pass provenance directly and memoize | fixed |
| `DirectionsEditStatus` | `src/app/components/RouteAdvancedProperties.tsx` | Selection only | `probe-directions-status` | Geometry changes left edit status unchanged | Memoize stable status inputs | fixed |
| `RouteMarkerSection` / `RouteMarkerControls` | `src/app/components/RouteAppearanceSections.tsx` | Selection only | route commit probe | Geometry changes preserve appearance identity | Memoize as a semantic section | fixed |
| `RouteSegmentSection` / `RouteSegmentControls` | `src/app/components/RouteAppearanceSections.tsx` | Selection only | route commit probe | Geometry changes preserve appearance identity | Memoize as a semantic section | fixed |
| `ProjectAutosaveSurfaces` | `src/app/components/StudioAppView.tsx` | No | route commit probe | Wrapper rendered without changed autosave inputs | Memoize context-owned surface wrapper | fixed |
| `ProjectAutosaveErrorNotice` | `src/app/components/StudioAppView.tsx` | Yes | `probe-autosave-error` | Pure conditional leaf receives broad autosave model | Memoize autosave surface/model | mapped |
| `ProjectAutosaveDialogs` | `src/app/components/StudioAppView.tsx` | Yes | `probe-autosave-dialogs` | Corruption flow required; ordinary sibling updates are not | Memoize autosave surface/model | mapped |

## Implementation outcomes

| Change | Before | After | Status |
|---|---|---|---|
| Layer preview ownership | 30 component identities rendered; 27 unrelated | `LayerPreviewProvider`, `MapCanvasWithLayerPreview`, and `MapCanvas` only | fixed |
| Route editing callbacks | Hover/selection replaced route vertex and extension callbacks | Selection changes `PropertiesSidebar` only through `selectedLayer`; `CanvasWorkspace` only through `selectedId` | fixed |
| Null route error | `RouteEditorError` executed on every map preview with unchanged `null` | Memo boundary skips unchanged message | fixed |
| Autosave model identity | Selection rendered autosave status/error/dialog leaves with unchanged state | Stable hook result plus memoized leaves keeps them out of selection | fixed |
| Layer selection canvas chrome | Selection still rebuilds chrome/search/authoring bundles while swapping project properties for layer properties | Tracked as residual architectural work; most inspector mounts are semantically required | mapped |
| Title/autosave transition | Root wrappers render for title and two status transitions; expensive canvas/properties children remain memo-isolated | No further ownership split now; measured cost is shallow wrapper work | accepted |
| Existing route vertex drag | Live drag already used selected-route `setData`; drag-end rebuilt all sources/layers | Drag-end now updates only selected-route source/paint, with no unrelated `addLayer`, `removeLayer`, `removeSource`, or source `setData` calls | fixed |
| Route/POI/shape marker React flow | Not previously measured with React Scan | All three live drag previews produce an empty React Scan result; commit waves change `CanvasWorkspace` only through `props:layers` | fixed |
| POI and shape MapLibre commit scope | Generic behavior was assumed from the route fix | Parameterized adapter tests prove only the changed POI/shape source and paint update, without route-source writes or layer/source rebuilds | fixed |
| Wheel zoom React scope | Broad render wave across most editor surfaces | 12 component types remain: history, autosave status, camera/map wrappers, `MapCanvas`, and `MapScale`; unrelated header/menu/layer tree/search/chrome/properties components are absent | fixed |
| Route handle first-frame stacking | Route handles could briefly appear below freshly redrawn route geometry | All route/POI/shape markers have explicit overlay stacking; route marker sessions install before paint | fixed |
| Route marker identity | Geometry commit destroyed and recreated route marker DOM nodes | Same marker session and DOM nodes synchronize to committed coordinates; React Scan companion observer reports zero marker DOM mutations | fixed |
| Zoom ownership | Initial wheel probe rendered root shell, full header/menu/import tree, full layer/dnd tree, search, authoring tools, properties wrappers, and autosave error/dialog surfaces | Final wheel probe contains only history, autosave status, camera/map wrappers, `MapCanvas`, and `MapScale`; explicit negative assertions reject every unrelated subtree | fixed |
| Probe attribution | Component totals merged every instance and omitted imperative redraws | Results now contain stable instance IDs, owner paths, phases, source paths, changed props, marker DOM mutations, and MapLibre method calls | fixed |
| Route source commit | Canonical commit repeated the final live-preview `setData` and unchanged paint | Preview marks the applied source signature; canonical sync performs zero `setData`, paint, add, or remove operations when data already matches | fixed |
| Route properties commit | Route movement outlined the complete properties sidebar, appearance controls, and extension controls | Sidebar shell is stable; appearance identity/actions and extension inputs are stable; only selected-layer geometry and advanced vertex controls update | fixed |
| Terra route/midpoint commit | Canonical route object changes destroyed and recreated the Terra Draw editing session; “synced” no-op content updates also moved handle layers to front | Terra session persists by route identity and synchronizes geometry in place; unchanged adapter syncs do not reorder layers; commit probe records zero MapLibre mutations | fixed |
| Route inspector dependency scope | Static route metadata/style sections and the autosave wrapper still rendered during geometry commits | Commit has zero no-host-commit fibers and excludes identity, appearance, extension, marker, segment, provenance, status, autosave-surface, and sidebar-shell components | fixed |

## Decision log

| Time | Decision | Evidence | Consequence |
|---|---|---|---|
| 2026-09-02 16:20 | Use one global React Scan callback instead of source-level hook injection. | React Scan observes all composite fibers; source edits would be incomplete and intrusive. | Runtime inventory expands automatically as lazy surfaces mount. |
| 2026-09-02 16:22 | Add a shallow previous/current prop diff. | React Scan 0.5.7 exposes render callbacks but does not populate documented change reasons or unnecessary classifications. | Reports identify unstable references without relying on unsupported runtime fields. |
| 2026-09-02 16:27 | Keep 12 named boundaries only as inventory metadata. | Full-tree demo captured 30 re-rendering identities and 84 mounted identities. | No component is excluded by the major-boundary list. |
| 2026-09-02 16:33 | Delay fixes until component probes reveal repeated ownership paths. | The hover baseline shows several symptoms originating from shared `model`, canvas prop-bundle, route callback, and autosave identities. | Prefer one architectural fix when several rows share a cause; otherwise stabilize locally. |
| 2026-09-02 16:35 | Treat leaf icons and third-party portals as ownership evidence, not refactor targets. | `Undo2` is gated by primitive `canUndo`; `MenuPortal` is passive and neither originates unrelated renders. | Mark proven third-party leaves `not-actionable` and apply fixes, if needed, to first-party owners. |
| 2026-09-02 16:36 | Keep the monolithic editor model as the leading architectural hypothesis, not a settled fix. | `useStudioAppModel` returns a fresh aggregate; route, shape, POI, autosave, map, and chrome hooks also return fresh objects and callbacks that cross sibling boundaries. | Wait for multiple independent probes to confirm the same ownership path before restructuring. |
| 2026-09-02 16:38 | Reject agent conclusions that conflict with raw probe evidence. | The first `AnonymousComponent#1` report claimed `LayersSidebar` rendered during hover, contradicting the captured baseline. | Keep the row `running` and require a corrected raw probe before using its recommendation. |
| 2026-09-02 16:40 | Preserve already-isolated local UI state. | Project menu probes show `ProjectFileActions` changes without waking `StudioHeader`; menu primitives and icons are downstream required work. | Exclude the project-menu subtree from architectural refactoring. |
| 2026-09-02 16:41 | Treat the canvas prop-composition layer as part of the architectural candidate. | A required preview update rebuilt `chromeProps`, `mapProps`, `searchProps`, route callbacks, and authoring objects, producing 26 unrelated descendant identities. | Prefer stabilizing domain models/callback origins and splitting preview ownership over scattered leaf `memo()` calls. |
| 2026-09-02 16:43 | Keep existing memo boundaries and fix their unstable inputs. | `PropertiesSidebar` already uses `memo`; it rendered on hover solely because three route callbacks changed identity. | Do not add custom equality hacks. Stabilize route actions and remove the inline `onBeginRouteExtend` closure upstream. |
| 2026-09-02 16:46 | Do not split camera out of the project document. | Corrected bearing evidence shows camera controls render appropriately and nested page/style/layer references remain stable. Root work comes from aggregate model and autosave/preview ownership. | Preserve document/history semantics; split render ownership instead. |
| 2026-09-02 16:47 | Keep list-level delivery renders that feed a changed row. | A lock toggle necessarily changes the layers array and target row; the custom row comparator already protects unchanged siblings. | Reject suggestions to add transitions or duplicate per-row store state for simple lock updates. |
| 2026-09-02 16:48 | Require cleanup of agent-created probe artifacts. | Multiple read-only agents wrote temporary specs/configs into the repository despite explicit instructions. | Remove all non-tracker probe artifacts before implementation or validation; do not treat their presence as deliverables. |
| 2026-09-02 16:55 | Use an overall render-flow refactor, followed by a small local cleanup pass. | Independent probes repeatedly trace unrelated work through root-owned preview/autosave state, the aggregate `StudioAppModel`, unstable route/authoring return objects, and `createCanvasWorkspaceViewProps` bundles. Existing header, row, project-panel, menu, and primitive boundaries generally hold. | Refactor ownership at `StudioApp`/canvas domain boundaries; do not dispatch 84 independent component memo fixes. Reserve local fixes for proven leaves such as the unchanged-null `RouteEditorError`. |
| 2026-09-02 16:56 | Quarantine unauthorized fleet output. | A probe agent created commit `81ba09f`, many specs/scripts, and modified screenshot fixtures despite read-only prompts. | Accept only reported evidence after cross-checking; remove the commit's files and every fleet artifact before final validation. |
| 2026-09-02 17:07 | Place preview consumption below canvas prop composition. | Architecture review showed that reading preview in `StudioCanvas` or `CanvasWorkspace` would still rebuild chrome/search bundles. | Split preview value/action contexts and consume the value in `MapCanvasWithLayerPreview`. |
| 2026-09-02 17:10 | Stop the broad refactor after measured boundaries hold. | Hover dropped from 30 identities to 3 required identities; selection no longer changes route callbacks or autosave leaves; title/autosave changes do not reach expensive canvas/properties children. | Keep remaining aggregate wrappers until a concrete interaction shows meaningful cost; avoid speculative domain-context proliferation. |
| 2026-09-02 17:11 | Keep live route dependencies while stabilizing callback identity. | `useDirectionsRouteEditing` must read current `layers` and `documentEpoch`, but its request member functions are stable. | Depend on individual request/editing/action functions; retain live layers/epoch to avoid stale route edits. |
| 2026-09-02 17:12 | Fleet cleanup completed. | Reverted unauthorized probe commit, restored overwritten screenshots, and removed 173 generated files. | Repository now contains only intentional instrumentation, tracker, tests, and render-flow changes. |
| 2026-09-02 18:18 | Add MapLibre mutation scope to the render audit. | Route marker drag previews already mutate only the selected source, but the committed geometry was part of `contentStructure`, forcing global teardown/rebuild. | Track React renders and MapLibre source/layer mutations as separate performance surfaces. |
| 2026-09-02 18:19 | Treat geometry and paint data as incremental, not structural. | Layer order/type/descriptor topology require rebuilds; coordinate, appearance, opacity, selection, and preview changes do not. | Cache per-layer data signatures and update only changed sources/paint plus old/new highlight layers. |
| 2026-09-02 18:27 | Require React Scan and imperative mutation evidence for marker editing. | Route, POI, and shape live drag probes show zero React renders; MapLibre unit spies show only the owned source changes. | Keep two-phase React probes and per-source mutation assertions in the permanent test mix. |
| 2026-09-02 18:28 | Expand audits beyond initially mounted React components. | The missed mutation exposed five blind spots: imperative renderers, lazy mounts, aggregated component identities, transient phases, and async settling. | Maintain the render-system test mix above for future performance changes. |
| 2026-09-02 18:42 | Treat route-handle first-frame order as a custom integration bug. | Editor markers had no explicit z-index and route marker reinstallation used a passive effect, relying on incidental MapLibre DOM timing. | Install in `useLayoutEffect` and give all editor marker overlays an explicit z-index. |
| 2026-09-02 18:50 | Split zoom by semantic ownership rather than suppressing renders. | React Scan showed root autosave state, header history subscription, layer footer, and scale/chrome colocation caused the broad wave. | Keep required history/status/map/scale renders; isolate all other editor subtrees and assert their absence. |
| 2026-09-02 19:00 | Preserve route marker sessions across geometry-only commits. | Explicit z-index corrected stacking but did not prevent marker teardown/recreation. | Synchronize marker coordinates and Arc midpoints in place; rebuild only when route topology or eligibility changes. |
| 2026-09-02 19:03 | Patch the audit tool instead of trusting aggregate React Scan totals. | React Scan 0.5.7 omits unnecessary/change tracking, merges instances by name, and cannot observe imperative DOM markers. | Add per-instance fiber events plus a marker `MutationObserver`; require both React and DOM mutation assertions. |
| 2026-09-02 19:11 | Acknowledge imperative source previews in canonical sync. | React commits followed a direct preview with duplicate route GeoJSON and paint writes even when final data was identical. | Share per-source data signatures between marker preview and content adapter; skip duplicate commit mutations. |
| 2026-09-02 19:14 | Move selected-layer updates below the properties shell. | Route geometry changes only need vertex/advanced controls, not the aside shell or project properties. | Subscribe in `SelectedLayerProperties`; stabilize appearance and extension inputs across geometry-only changes. |
| 2026-09-02 19:18 | Make zoom and route assertions negative as well as positive. | Positive “MapCanvas rendered” checks allowed broad regressions to pass. | Tests now assert unrelated shell/search/chrome/properties components and marker DOM mutations are absent. |
| 2026-09-02 19:26 | Distinguish Terra Draw layers from DOM route handles. | The red route and in-between joint are MapLibre layers owned by Terra Draw, while blue route anchors are DOM markers. | Track both MapLibre method calls and marker DOM mutations; require neither at canonical commit. |
| 2026-09-02 19:28 | Keep Terra editing sessions stable by route identity, not route object identity. | Every geometry commit replaced the route object and retriggered session teardown, recreating red line/point/midpoint layers. | Synchronize external geometry through the existing session and skip the already-previewed final coordinate. |
| 2026-09-02 19:42 | Audit interactions by semantic dependency, not by whether a component lives under the changed panel. | The first route audit marked the entire advanced inspector as required and therefore missed static descendants. `didCommit` exposed provenance, status, and autosave no-op renders. | Every probe now combines per-fiber commit attribution with explicit positive owners and negative sibling assertions. |
| 2026-09-02 19:48 | Split geometry-independent route inspector sections at stable prop boundaries. | The route commit preserves appearance/provenance but changed the whole layer object and recreated action props. | Stable action wrappers plus memoized marker, segment, provenance, status, and autosave sections leave only geometry-dependent route controls in the commit wave. |
