# Map video export

The controlled `VideoExportDialog` records a genuine, silent MP4 from a detached
map snapshot. It offers orbit or sway motion, 5/10/15 seconds, 30/60 fps targets,
poster/16:9/9:16/1:1/4:5 aspects, and Standard/High quality.

The whole poster is fitted inside the selected aspect, including photos,
decorations, and attribution. A different aspect can introduce white borders;
it never silently crops the composition. Standard output is bounded by a
1280-pixel edge and 921,600 pixels; High is bounded by a 1920-pixel edge and
2,073,600 pixels. Actual even-numbered dimensions are displayed before recording.

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

The parent supplies `document`, `settings: document.studio.video`,
`onSettingsChange`, `exporter`, `filename`, and `onClose`. Route preference changes
through `setStudioSection('video', settings)`, handling mutation failures through
the normal application feedback. Pass `blockedReason` while drawing or another
workflow makes the document unavailable. The component owns only transient
recording state, never a second document store or localStorage settings.

`exporter.captureRenderSnapshot({ content: 'composite' })` is called synchronously
before lazy-loading the video engine. The document and render snapshot are
cloned at the recording boundary. `exportVideoDocument` then:

1. Plans a bounded output and a poster-sized isolated MapLibre renderer.
2. Reuses the canonical applied style, custom images, and content layers,
   retaining terrain/contour protocol resources for the renderer's lifetime.
3. Animates only the temporary camera, draws the reusable studio composition
   with the temporary projector, and adds attribution.
4. Records, verifies, and returns the MP4 and presentation metrics.

The live renderer, canonical camera, layers, and undo history are not animated.
Changing projects or unmounting the dialog cancels the job. Cancel preserves
the dialog and restores keyboard focus to Download; Escape closes it and
returns focus to its opener. Tracks, event handlers, temporary canvases,
composition images, protocol references, and temporary map containers are
released. Download object URLs use the shared bounded-lifetime download helper.

## Focused verification

```sh
npm run typecheck
npx vitest run tests/unit/video-plan.test.ts tests/unit/video-record.test.ts \
  tests/unit/video-map-capture.test.ts tests/unit/video-dialog.test.tsx
PLAYWRIGHT_EDITOR_PORT=4196 npx playwright test \
  tests/e2e/video-export.spec.ts tests/e2e/video-composition.spec.ts \
  tests/e2e/video-dialog.spec.ts --project=chromium --workers=1
```

The browser tests inspect a real downloaded MP4 and decoded dimensions/duration,
verify shared composition pixels and unchanged canonical state/live camera,
and exercise mobile cancellation and focus restoration. Browsers without MP4
recording annotate the capability error instead of pretending to test encoding.
