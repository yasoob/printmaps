---
name: react-scan-audit
description: >
  Exhaustive React re-render auditing for the Print Map Studio editor using
  React Scan, per-fiber commit attribution, DOM mutation tracking, and MapLibre
  method tracing. Use when asked to run React Scan, find unnecessary renders,
  investigate editor flicker, audit render boundaries, debug route/marker/layer
  redraws, or verify that an interaction only updates its semantic owners.
user-invokable: true
argument-hint: "[interaction or editor surface]"
metadata:
  author: printmaps
  version: "1.0.0"
  category: performance
---

# Exhaustive React Scan Audit

Use the repository's render-audit harness to measure and fix editor updates.
Treat this as an evidence-gathering workflow, not a request to scatter `memo()`
through the component tree.

## Non-negotiable rules

1. **Probe the complete component tree.** Never limit capture to the named major
   boundaries or to components already listed in `RERENDER_TRACKER.md`.
   `REACT_SCAN_TARGETS` is metadata only; the global React Scan callback is the
   source of runtime coverage.
2. **Refresh the inventory on every audit.** The tracker is historical evidence,
   not a current manifest. New components, lazy components, renamed components,
   anonymous instances, portals, and conditional branches may have appeared
   since the last run.
3. **Do not accept a render as necessary at face value.** Being inside the
   properties panel, map, header, or route inspector does not make a render
   valid. Identify the exact datum that changed and the exact UI or imperative
   output that must change because of it.
4. **Do not trust visual outlines alone.** React Scan can outline an ancestor
   because a descendant committed. Use per-instance events, owner paths,
   changed props, `didCommit`, DOM mutations, and MapLibre mutations before
   deciding what actually changed.
5. **Do not equate `didCommit: true` with justified work.** It proves that the
   fiber participated in a host commit, not that every sibling section or
   calculation beneath it was necessary. Add explicit negative assertions for
   siblings whose semantic inputs did not change.
6. **Audit imperative renderers separately.** React Scan cannot see MapLibre
   source/layer operations, Terra Draw layer recreation, marker DOM remounts,
   canvas/WebGL painting, image registration, or z-index flicker.
7. **Split transient interactions into phases.** Measure live preview, canonical
   commit, and asynchronous settle in separate probe windows. A combined window
   hides duplicate final writes and transient remounts.
8. **Fix causes, not outlines.** Prefer narrow subscriptions, stable semantic
   inputs, persistent imperative sessions, and ownership splits. Do not use a
   custom comparator to conceal stale data or suppress a required update.
9. **Preserve behavior.** Render fixes must retain history, autosave,
   provenance invalidation, accessibility, focus, locking, selection, export,
   and document semantics.
10. **Make the audit repeatable.** Every confirmed invariant belongs in an
    automated positive or negative assertion, and every decision belongs in
    `RERENDER_TRACKER.md`.

## Repository harness

Read these before changing instrumentation:

- `RERENDER_TRACKER.md`: historical inventory, interaction matrix, blind spots,
  accepted decisions, and before/after evidence.
- `docs/DEVELOPMENT.md`: local React Scan usage.
- `tests/e2e/react-scan-render-probe.spec.ts`: permanent browser interactions
  and pass/fail assertions.
- `src/dev/reactScanProbe.ts`: aggregate capture, events, DOM mutations, and
  controller exposed as `window.__PRINT_MAP_REACT_SCAN__`.
- `src/dev/reactScanProbeFiber.ts`: stable fiber IDs, owner paths, source paths,
  phases, shallow prop changes, and `didCommit`.
- `src/dev/reactScanProbeMapLibre.ts`: development-only MapLibre method tracing.

Run the complete browser harness with:

```bash
npm run audit:renders
```

React Scan must remain development-only. Never make production behavior depend
on the scanner or probe controller.

## Step 1: Build a fresh inventory

Do not copy the old inventory and call it complete.

1. Start from a cleanly loaded editor and wait for map readiness and a quiescent
   interval.
2. Exercise every reachable editor branch: project properties, each layer type,
   advanced accordions, menus, dialogs, import/export, authoring tools, search,
   route editing, map matching, elevation, and error/loading states that can be
   produced deterministically.
3. Capture the global runtime inventory after those branches have mounted.
4. Reconcile it with first-party component creation sites under `src/`. Runtime
   discovery only includes mounted branches, so source components with reachable
   but unexercised states must be added to the test plan.
5. Track multiple instances using stable fiber IDs and owner paths. A shared
   component name such as `Button`, `PropertyRow`, or an anonymous wrapper does
   not identify which instance rendered.
6. Append newly discovered identities to `RERENDER_TRACKER.md`. Never assume the
   previous count is still correct.
7. Assign every discovered first-party component to at least one interaction
   that can prove whether its render boundary holds. Passive leaves and
   third-party primitives may be covered through their nearest first-party
   owner, but they must not silently disappear from coverage.

## Step 2: Define semantic expectations first

Before interacting, write down:

- the state that should change;
- the React owners allowed to render;
- first-party sibling components that must not render;
- permitted marker DOM mutations;
- permitted MapLibre operations and source/layer IDs;
- whether node/session identity must survive;
- expected live-preview, commit, and async-settle behavior.

Use both positive and negative assertions. A probe that only checks that
`MapCanvas` rendered will pass even if the entire editor rendered too.

Examples of strict expectations:

- Layer hover may update the preview provider and map preview boundary, but not
  search, properties, autosave, layer-tree siblings, or the root shell.
- Wheel zoom may update camera/map/scale/history or autosave status owners as
  required, but not search, properties, canvas chrome, dialogs, imports, or the
  complete layer tree.
- Live route, POI, and shape dragging should perform no React work and mutate
  only the owned MapLibre source.
- A route commit after the accepted live preview should not replay identical
  source data, recreate marker DOM, recreate Terra Draw layers, or reorder
  unchanged layers.
- Moving one route vertex may update coordinate-, structure-, matching-, and
  elevation-dependent controls. It must not automatically update identity,
  appearance, extension, marker style, segment style, provenance, directions
  status, autosave surfaces, or the properties sidebar shell. If product
  semantics invalidate provenance, that specific provenance update is required
  and must be tested as such.

## Step 3: Capture all rendering surfaces

For each interaction, collect all of the following:

### React fibers

- aggregate callbacks and render counts;
- stable fiber instance ID;
- component and owner path;
- mount, update, or unmount phase;
- source path when available;
- shallow changed props;
- `didCommit`.

Treat `didCommit: false` as directly suspicious. For `didCommit: true`, continue
to inspect semantic ownership and stable siblings.

### Marker DOM

Track additions and removals of editor marker nodes. Also tag a marker before an
interaction when node identity must survive and assert that the same element is
present afterward. Coordinate movement is not permission to remount a marker.

### MapLibre and Terra Draw

Record at least:

- `setData`;
- `addSource` and `removeSource`;
- `addLayer`, `removeLayer`, and `moveLayer`;
- paint and layout property changes.

Attribute every operation to a source/layer. A valid selected-layer update does
not justify touching unrelated layers.

Remember that the editor has separate route visual systems:

- blue route anchors are imperative DOM markers;
- the red route, red vertices, and in-between joint are Terra Draw MapLibre
  layers.

Test both systems. Fixing one does not prove the other is stable.

### Visual/transient behavior

When investigating flicker or stacking, inspect the first frame as well as the
settled frame. Stable final pixels do not prove that nodes or layers were not
recreated in the wrong order.

## Step 4: Classify without rationalizing

For every captured component or imperative operation, answer:

1. Which input changed?
2. Was that input semantically relevant to this owner?
3. Did this owner produce a necessary host or renderer change?
4. Could a narrower subscriber or child own the update?
5. Is the changed reference merely a fresh object, array, callback, aggregate
   model, or context value?
6. Does an imperative preview already contain the canonical final state?
7. Did a session key depend on a whole object when identity or topology would
   have been sufficient?

Do not classify an entire subtree as required because one descendant displays
changed data. This was the original properties-panel audit mistake.

## Step 5: Choose the smallest correct fix

Prefer, in order:

1. move state consumption to the narrowest semantic owner;
2. split value and action contexts when consumers need different updates;
3. subscribe to primitives or stable domain objects rather than aggregate
   models;
4. stabilize callback delivery while reading current values safely;
5. preserve unchanged nested object identity during immutable updates;
6. split mixed-dependency components into independently memoized sections;
7. key imperative sessions by stable identity/topology and synchronize mutable
   geometry in place;
8. acknowledge already-applied imperative previews so canonical commits can
   skip duplicate writes;
9. memoize only after inputs and ownership are correct.

Never capture stale layer/document objects merely to make callbacks stable.
Never skip required provenance invalidation or history commits to improve a
render count.

## Step 6: Close the loop

After each fix:

1. rerun the exact same focused interaction;
2. compare component instances, changed props, DOM mutations, and MapLibre
   operations;
3. add explicit regression assertions for the removed work;
4. rerun `npm run audit:renders`;
5. run the smallest related unit tests and the production build;
6. update the tracker with fresh inventory counts, evidence, decision, status,
   and before/after component or mutation sets.

Do not stop after the first green-looking result. Check the live, commit, and
settle phases and exercise nearby variants that share the same data flow.

## Minimum interaction matrix

An exhaustive editor pass must cover, where available:

- layer hover, selection, visibility, lock, and reorder;
- project title and autosave transitions;
- project menus, dialogs, import, export, and focus restoration;
- tool activation/cancellation and inactive authoring siblings;
- location search typing, results, and selection;
- map pan, wheel zoom, bearing, fit, geolocation, style, language, visibility,
  text scale, and page changes;
- route, POI, and shape live marker drags plus commits;
- route DOM anchors and Terra Draw route/vertex/midpoint layers;
- route insertion, removal, curvature, extension, directions retry/cancel, map
  matching, provenance, and elevation;
- asynchronous success, failure, cancellation, and settle states;
- lazy or conditional components added since the previous tracker update.

Add interactions when source reconciliation reveals newly reachable components.
This list is a floor, not a completeness claim.

## If sub-agents are used

The parent agent owns the ground truth.

- Give each agent a complete interaction, exact probe commands, and read-only
  boundaries unless edits are explicitly assigned.
- Do not use one speculative recommendation as evidence.
- Require raw component/event/mutation output and reproduce important findings
  in the permanent harness.
- Reject reports that conflict with captured results.
- Do not retain disposable specs, screenshots, generated configs, or unrelated
  commits from probe agents.
- Prefer grouping passive components by owning interaction over launching one
  editing agent per leaf.

## Completion criteria

The audit is complete only when:

- the runtime inventory has been refreshed after mounting lazy branches;
- source reconciliation found no reachable component without an assigned probe;
- each interaction has positive owners and negative exclusions;
- no unexplained `didCommit: false` events remain;
- React, marker DOM, MapLibre, and transient visual behavior have all been
  checked where applicable;
- confirmed fixes have permanent regression assertions;
- `RERENDER_TRACKER.md` records new components and decisions;
- development-only instrumentation remains absent from production behavior.
