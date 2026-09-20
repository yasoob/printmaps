# Map video export

**Export > Video** records a genuine, silent MP4 from a detached
map snapshot. It offers orbit or sway motion, 5/10/15 seconds, 30/60 fps targets,
poster/16:9/9:16/1:1/4:5 aspects, and Standard/High quality.

Export opens directly on **Print**, with PNG, layered SVG, PDF, and layered PSD.
The same modal has **Video** and **3D model** destinations; switching them does not
edit the project or add undo entries. Print's format and basemap-rendering choices
remain selected when returning from another destination. **Preview framed** is a
secondary Print action with **Back to export**, not another stacked dialog.
Every entry captures a fresh composed poster. Frame, wall, and mat preferences
use `studio.wall`; changing them does not recapture the poster. Preview canvases
and object URLs are released on back, close, replacement, and failed capture.

The whole poster is fitted inside the selected aspect, including photos,
decorations, and attribution. A different aspect can introduce white borders;
it never silently crops the composition. Standard output is bounded by a
1280-pixel edge and 921,600 pixels; High is bounded by a 1920-pixel edge and
2,073,600 pixels. Actual even-numbered dimensions are displayed before recording.

Static recording caveats, including unmeasurable encoder drops, are available from **Video recording help**, and
composition fitting details from **Video aspect help**. Both support hover,
keyboard focus, and click/tap pinning. Escape dismisses help before the dialog.
Current output dimensions, export failures, cancellation, and progress remain
visible; active recording also reminds the user to keep the tab visible.

## Browser behavior

Recording requires `canvas.captureStream` and a supported `video/mp4`
MediaRecorder encoder. H.264 is preferred. Unsupported browsers receive an
explicit error: WebM is never substituted or renamed. The completed blob's MIME
and ISO BMFF `ftyp`, `moov`, and `mdat` boxes are checked before downloading.

The browser records in real time, not through an offline fixed-frame-rate
encoder. The requested duration is a wall-clock recording target. Tile loading,
composition, rendering, encoding, or device load can cause repeated or dropped
frames. Progress reports **presented composed frames**, measured presentation
fps, and missed target presentation slots. Those metrics are not an encoded
frame count: MediaRecorder does not report its internal dropped frames.

Keep the tab visible. Hiding it stops the export with an explanatory error.
Preparation, tile loading, output bytes, and finalization are bounded. Encoder,
map, photo, and unsupported-composition errors fail explicitly instead of
omitting content. For example, a decoration that requires a flat map remains
unsupported on a pitched map; video does not secretly hide that decoration.

## Integration

The reusable `VideoExportPanel` owns the existing recording controller and
non-modal settings/progress/actions. `VideoExportDialog` remains its standalone
wrapper. The parent supplies `document`, `settings: document.studio.video`,
`onSettingsChange`, `exporter`, `filename`, and `onClose`. Route preference changes
through `setStudioSection('video', settings)`, handling mutation failures through
the normal application feedback. Pass `blockedReason` while drawing or another
workflow makes the document unavailable. The component owns only transient
recording state, never a second document store or localStorage settings.

`exporter.captureRenderSnapshot({ content: 'composite' })` is called synchronously
before lazy-loading the video engine. The document and render snapshot are
cloned at the recording boundary. `exportVideoDocument` then:

1. Plans a bounded output and an isolated MapLibre renderer with the original
   CSS viewport and camera. Higher pixel density preserves the original
   perspective, including pitched maps, before cropping the print frame.
2. Reuses the canonical applied style, custom images, and content layers,
   retaining terrain/contour protocol resources for the renderer's lifetime.
3. Animates only the temporary camera, draws the reusable studio composition
   with the temporary projector, and adds attribution.
4. Records, verifies, and returns the MP4 and presentation metrics.

The live renderer, canonical camera, layers, and undo history are not animated.
Changing projects or unmounting the dialog cancels the job. Cancel preserves
the panel and restores keyboard focus to Download. In the unified workspace,
destination changes, Escape, outside-click and close are blocked while an export
is running; cancel explicitly and wait for cleanup first. When idle, Escape closes
the workspace and returns focus to Export. The standalone video dialog retains
its cancel-on-Escape behavior. Tracks, event handlers, temporary canvases,
composition images, protocol references, and temporary map containers are
released. Download object URLs use the shared bounded-lifetime download helper.

The workspace keeps the original `ExportDialog` props (`document`, `exporter`,
`filename`, `onClose`), plus `documentEpoch` for same-ID replacement cancellation
and `blockedReason` for authoring/recovery guards. Connected mode panels use the
canonical project-store provider, `setStudioSection`, and current renderer
capabilities from `mapExporterContext`; no export settings store is created.
Video progress rerenders the dialog, not the editor or map. The 3D model panel
similarly reuses the STL controller with `studio.relief` settings.

The full offscreen viewport, not only the final crop, is limited to a 4096-pixel
edge and 8,294,400 pixels. When preserving perspective would exceed that budget,
enlarge the print frame in the editor or choose Standard quality. The exporter
does not change the field of view or silently lower the requested resolution.

## Focused verification

```sh
npm run typecheck
npx vitest run tests/unit/video-plan.test.ts tests/unit/video-record.test.ts \
  tests/unit/video-map-capture.test.ts tests/unit/video-dialog.test.tsx
npx vitest run tests/unit/export-workspace.test.tsx
PLAYWRIGHT_EDITOR_PORT=4196 npx playwright test \
  tests/e2e/video-export.spec.ts tests/e2e/video-composition.spec.ts \
  tests/e2e/video-dialog.spec.ts tests/e2e/video-projection.spec.ts \
  --project=chromium --workers=1
```

`tests/e2e/export-workspace.spec.ts` checks one persistent modal, all three
destinations, framed preview/back, desktop/phone/320px fit, and genuine PNG,
true-vector SVG, and STL downloads. Its separately labeled simulated-controller
cases check video busy/cancel UI only; they are not MP4 encoding evidence.

The browser tests inspect a real downloaded MP4 and decoded dimensions/duration,
verify shared composition pixels and unchanged canonical state/live camera,
and exercise mobile cancellation and focus restoration. Browsers without MP4
recording annotate the capability error instead of pretending to test encoding.
The projection regression uses real public MapLibre maps at 0/30/60-degree pitch,
checks all four frame corners and the center for centered and offset crops, and
checks the initial frame before motion without moving the live renderer.
