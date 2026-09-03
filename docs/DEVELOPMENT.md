# Development tools

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
