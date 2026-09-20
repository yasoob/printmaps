/* eslint-disable react-refresh/only-export-components -- Browser fixture mounts the controlled dialog outside the app root. */
import { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { VideoExportDialog } from '../../src/app/components/VideoExportDialog';
import type { PreviewPngExporter } from '../../src/export/previewPng';
import { createVideoBrowserFixture } from './video-browser-fixture';
import '../../src/styles.css';

function VideoHarness({ fixture }: { fixture: Awaited<ReturnType<typeof createVideoBrowserFixture>> }) {
  const [open, setOpen] = useState(false);
  const state = useSyncExternalStore(fixture.store.subscribe, fixture.store.getState);
  const exporter: PreviewPngExporter = Object.assign(async () => {
    throw new Error('This test harness only supplies detached render snapshots.');
  }, { captureRenderSnapshot: fixture.capture });
  return <>
    <button onClick={() => setOpen(true)}>Open video export</button>
    {open ? <VideoExportDialog
      document={state.document} settings={state.document.studio.video}
      onSettingsChange={(settings) => fixture.store.getState().setStudioSection('video', { ...settings })}
      exporter={exporter} filename="Composed-map" onClose={() => setOpen(false)}
    /> : null}
  </>;
}

export async function mountVideoDialogHarness() {
  const fixture = await createVideoBrowserFixture();
  const host = document.createElement('div');
  document.body.prepend(host);
  const root = createRoot(host);
  root.render(<VideoHarness fixture={fixture} />);
  window.addEventListener('pagehide', () => {
    root.unmount();
    fixture.dispose();
    host.remove();
  }, { once: true });
}
