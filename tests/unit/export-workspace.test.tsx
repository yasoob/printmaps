import { useState } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportDialog } from '../../src/app/components/ExportDialog';
import { ProjectStoreContext, useProject } from '../../src/app/projectStoreContext';
import { createMapExporterChannel, MapExporterContext, useAvailableMapExporter } from '../../src/app/mapExporterContext';
import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';
import type { PreviewPng, PreviewPngExporter } from '../../src/export/previewPng';
import type { MapRenderSnapshot } from '../../src/map/MapRenderSnapshot';
import { exportVideoDocument } from '../../src/video/exportVideoDocument';
import { getVideoCapability } from '../../src/video/capability';
import { exportTerrainRelief } from '../../src/terrain/reliefExport';
import { downloadBlob } from '../../src/lib/downloadBlob';

vi.mock('../../src/video/exportVideoDocument', () => ({ exportVideoDocument: vi.fn() }));
vi.mock('../../src/video/capability', () => ({ getVideoCapability: vi.fn() }));
vi.mock('../../src/terrain/reliefExport', () => ({ exportTerrainRelief: vi.fn(), reliefAttributionNotice: () => 'Elevation credits' }));
vi.mock('../../src/lib/downloadBlob', () => ({ downloadBlob: vi.fn() }));
vi.mock('../../src/export/studioComposition', () => ({ drawStudioComposition: vi.fn() }));

function snapshot(): MapRenderSnapshot {
  return {
    style: { version: 8, sources: {}, layers: [] }, layers: [], assets: {},
    camera: { center: [0, 0], zoom: 12, bearing: 0, pitch: 0, roll: 0 },
    printCamera: { center: [0, 0], zoom: 12, bearing: 0, pitch: 0 },
    viewport: { width: 800, height: 600 }, frame: { x: 0, y: 0, width: 400, height: 300 },
    footprint: { corners: [[0, 1], [1, 1], [1, 0], [0, 0]], widthPx: 400, heightPx: 300, bearing: 0, pitch: 0 },
    referenceLongitude: 0,
  };
}

function Harness() {
  const [open, setOpen] = useState(false);
  const document = useProject((state) => state.document);
  const documentEpoch = useProject((state) => state.documentEpoch);
  const available = useAvailableMapExporter();
  return <><button onClick={() => setOpen(true)}>Export</button>
    {open && <ExportDialog exporter={available} document={document} documentEpoch={documentEpoch} filename="map" onClose={() => setOpen(false)} />}</>;
}

function setup() {
  const store = createProjectStore(createInitialProjectDocument());
  const channel = createMapExporterChannel();
  const captures: HTMLCanvasElement[] = [];
  const exporter: PreviewPngExporter = Object.assign(vi.fn(async () => {
    const surface = document.createElement('canvas');
    surface.width = 200; surface.height = 100;
    captures.push(surface);
    return { surface, blob: new Blob(), width: 200, height: 100, projectToFrame: () => ({ x: 0.5, y: 0.5 }) };
  }), { captureRenderSnapshot: vi.fn(snapshot) });
  channel.publish(exporter);
  const view = render(<ProjectStoreContext value={store}><MapExporterContext value={channel}><Harness /></MapExporterContext></ProjectStoreContext>);
  return { ...view, store, exporter, channel, captures, user: userEvent.setup() };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVideoCapability).mockReturnValue({ supported: true, mimeType: 'video/mp4' });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })));
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:poster'), revokeObjectURL: vi.fn() }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('opens Print directly and preserves one dialog, format choice, and history across keyboard mode navigation', async () => {
  const { user, store } = setup();
  const original = store.getState();
  await user.click(screen.getByRole('button', { name: 'Export' }));
  const dialog = screen.getByRole('dialog', { name: 'Export map' });
  expect(screen.getByRole('tab', { name: 'Print' })).toHaveAttribute('aria-selected', 'true');
  await user.click(screen.getByRole('radio', { name: /Layered SVG/ }));
  await user.click(screen.getByRole('tab', { name: 'Print' }));
  await user.keyboard('{ArrowRight}');
  expect(await screen.findByLabelText('Duration')).toBeVisible();
  expect(screen.getByRole('tab', { name: 'Video' })).toHaveFocus();
  await user.keyboard('{End}');
  expect(await screen.findByRole('button', { name: 'Download STL' })).toBeVisible();
  expect(screen.getAllByRole('dialog')).toEqual([dialog]);
  expect(document.querySelectorAll('[data-slot="dialog-overlay"]')).toHaveLength(1);
  await user.keyboard('{Home}');
  expect(screen.getByRole('radio', { name: /Layered SVG/ })).toHaveAttribute('aria-checked', 'true');
  expect(store.getState()).toBe(original);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export' })).toHaveFocus());
});

it('edits only canonical video and relief preferences and retains them when switching destinations', async () => {
  const { user, store } = setup();
  const original = store.getState().document;
  await user.click(screen.getByRole('button', { name: 'Export' }));
  await user.click(screen.getByRole('tab', { name: 'Video' }));
  await user.selectOptions(await screen.findByLabelText('Duration'), '15');
  expect(store.getState().document.studio.video.durationSeconds).toBe(15);
  await user.click(screen.getByRole('tab', { name: '3D model' }));
  await user.selectOptions(await screen.findByLabelText('Relief detail'), 'low');
  expect(store.getState().document.studio.relief.detail).toBe('low');
  await user.click(screen.getByRole('tab', { name: 'Video' }));
  expect(await screen.findByLabelText('Duration')).toHaveValue('15');
  await user.click(screen.getByRole('tab', { name: '3D model' }));
  expect(await screen.findByLabelText('Relief detail')).toHaveValue('low');
  expect(store.getState().past).toHaveLength(2);
  expect(store.getState().document.camera).toBe(original.camera);
  expect(store.getState().document.layers).toBe(original.layers);
  expect(store.getState().document.studio.poster).toBe(original.studio.poster);
});

it('keeps capability and recovery errors visible without fabricating a video download', async () => {
  vi.mocked(getVideoCapability).mockReturnValue({ supported: false, reason: 'MP4 is unavailable in this browser. Try Chrome or Edge.' });
  const { user, channel, exporter } = setup();
  await user.click(screen.getByRole('button', { name: 'Export' }));
  await user.click(screen.getByRole('tab', { name: 'Video' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('MP4 is unavailable');
  expect(screen.getByRole('button', { name: 'Download MP4' })).toBeDisabled();
  await user.click(screen.getByRole('tab', { name: '3D model' }));
  expect(await screen.findByRole('button', { name: 'Download STL' })).toBeEnabled();
  act(() => channel.publish(null));
  expect(screen.getByRole('button', { name: 'Download STL' })).toBeDisabled();
  expect(screen.getByText(/Waiting for the map preview/)).toBeVisible();
  act(() => channel.publish(exporter));
  expect(screen.getByRole('button', { name: 'Download STL' })).toBeEnabled();
  expect(downloadBlob).not.toHaveBeenCalled();
});

it('blocks mode switching, Escape, and close during video work until explicit cancellation settles', async () => {
  vi.mocked(exportVideoDocument).mockImplementation(({ signal, onProgress }) => {
    onProgress?.({ phase: 'recording', fraction: 0.25, presentedFrames: 5, missedFrameSlots: 1 });
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  });
  const { user, store } = setup();
  const original = store.getState();
  await user.click(screen.getByRole('button', { name: 'Export' }));
  await user.click(screen.getByRole('tab', { name: 'Video' }));
  await user.click(await screen.findByRole('button', { name: 'Download MP4' }));
  await waitFor(() => expect(exportVideoDocument).toHaveBeenCalledOnce());
  for (const tab of screen.getAllByRole('tab')) expect(tab).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Close export' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel recording' })).toHaveFocus();
  expect(screen.getByRole('status')).toHaveTextContent('Recording 25%');
  await user.keyboard('{Escape}');
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(vi.mocked(exportVideoDocument).mock.calls[0][0].signal.aborted).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Cancel recording' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('cancelled'));
  expect(screen.getByRole('button', { name: 'Download MP4' })).toHaveFocus();
  expect(screen.getByRole('tab', { name: 'Print' })).toBeEnabled();
  expect(store.getState()).toBe(original);
  expect(downloadBlob).not.toHaveBeenCalled();
});

it('aborts same-ID project replacement and ignores a late video result', async () => {
  let finish!: (result: Awaited<ReturnType<typeof exportVideoDocument>>) => void;
  vi.mocked(exportVideoDocument).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const { user, store } = setup();
  await user.click(screen.getByRole('button', { name: 'Export' }));
  await user.click(screen.getByRole('tab', { name: 'Video' }));
  await user.click(await screen.findByRole('button', { name: 'Download MP4' }));
  await waitFor(() => expect(exportVideoDocument).toHaveBeenCalledOnce());
  const signal = vi.mocked(exportVideoDocument).mock.calls[0][0].signal;
  act(() => store.setState({ documentEpoch: store.getState().documentEpoch + 1 }));
  expect(signal.aborted).toBe(true);
  expect(screen.getByRole('tab', { name: 'Print' })).toHaveAttribute('aria-selected', 'true');
  await act(async () => finish({
    blob: new Blob(['unit stub']), width: 100, height: 100, requestedDurationSeconds: 5, recordingSeconds: 5,
    targetFps: 30, presentedFrames: 150, measuredPresentationFps: 30, missedFrameSlots: 0,
  }));
  expect(downloadBlob).not.toHaveBeenCalled();
});

it('uses the existing STL job and keeps navigation locked through cancellation', async () => {
  vi.mocked(exportTerrainRelief).mockImplementation((_snapshot, _settings, { signal } = {}) => new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  const { user, exporter } = setup();
  await user.click(screen.getByRole('button', { name: 'Export' }));
  await user.click(screen.getByRole('tab', { name: '3D model' }));
  await user.click(await screen.findByRole('button', { name: 'Download STL' }));
  expect(exporter.captureRenderSnapshot).toHaveBeenCalledOnce();
  expect(screen.getByRole('tab', { name: 'Video' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel export' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.getByRole('dialog')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Cancel export' }));
  await waitFor(() => expect(screen.getByText(/Terrain export cancelled/)).toBeVisible());
  expect(screen.getByRole('button', { name: 'Download STL' })).toHaveFocus();
  expect(downloadBlob).not.toHaveBeenCalled();
});

it('keeps Print navigation locked until an aborted capture settles without a late download', async () => {
  const { user, exporter } = setup();
  let complete!: (capture: PreviewPng) => void;
  let signal: AbortSignal | undefined;
  vi.mocked(exporter).mockImplementation((options) => {
    signal = options?.signal;
    return new Promise((resolve) => { complete = resolve; });
  });
  await user.click(screen.getByRole('button', { name: 'Export' }));
  await user.click(screen.getByRole('radio', { name: /Layered SVG/ }));
  await user.click(screen.getByRole('button', { name: 'Download layered SVG' }));
  expect(screen.getByRole('tab', { name: 'Video' })).toBeDisabled();
  await user.keyboard('{Escape}');
  expect(screen.getByRole('dialog')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Cancel export' }));
  expect(signal?.aborted).toBe(true);
  expect(screen.getByRole('tab', { name: 'Video' })).toBeDisabled();
  const surface = document.createElement('canvas');
  await act(async () => complete({ surface, blob: new Blob(), width: 200, height: 100 }));
  expect(screen.getByRole('status')).toHaveTextContent('cancelled');
  expect(screen.getByRole('tab', { name: 'Video' })).toBeEnabled();
  expect(surface.width).toBe(0);
  expect(surface.height).toBe(0);
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it('discards late wall capture after Back and surfaces a fresh capture failure without changing history', async () => {
  const { user, exporter, store } = setup();
  const original = store.getState();
  let complete!: (capture: PreviewPng) => void;
  let signal: AbortSignal | undefined;
  vi.mocked(exporter).mockImplementation((options) => {
    signal = options?.signal;
    return new Promise((resolve) => { complete = resolve; });
  });
  await user.click(screen.getByRole('button', { name: 'Export' }));
  await user.click(screen.getByRole('button', { name: 'Preview framed' }));
  await screen.findByText('Preparing poster preview...');
  await user.click(screen.getByRole('button', { name: 'Back to export' }));
  expect(signal?.aborted).toBe(true);
  const surface = document.createElement('canvas');
  await act(async () => complete({ surface, blob: new Blob(), width: 200, height: 100 }));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(surface.width).toBe(0);
  expect(surface.height).toBe(0);
  vi.mocked(exporter).mockRejectedValue(new Error('The map is recovering. Retry the preview.'));
  await user.click(screen.getByRole('button', { name: 'Preview framed' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('map is recovering');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(store.getState()).toBe(original);
});

it('previews inside the same shell, preserves print choice, cleans resources, and only saves frame preferences', async () => {
  const { user, store, exporter, captures } = setup();
  const original = store.getState();
  await user.click(screen.getByRole('button', { name: 'Export' }));
  const dialog = screen.getByRole('dialog');
  await user.click(screen.getByRole('radio', { name: /Layered SVG/ }));
  await user.click(screen.getByRole('button', { name: 'Preview framed' }));
  expect(await screen.findByRole('img', { name: /finished map poster/ })).toHaveAttribute('src', 'blob:poster');
  expect(screen.getAllByRole('dialog')).toEqual([dialog]);
  expect(store.getState()).toBe(original);
  expect(captures[0].width).toBe(0);
  expect(captures[0].height).toBe(0);
  await user.selectOptions(screen.getByLabelText('Frame finish'), 'oak');
  expect(store.getState().document.studio.wall.frame).toBe('oak');
  expect(store.getState().past).toHaveLength(1);
  expect(exporter).toHaveBeenCalledOnce();
  await user.click(screen.getByRole('button', { name: 'Back to export' }));
  expect(screen.getByRole('radio', { name: /Layered SVG/ })).toHaveAttribute('aria-checked', 'true');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:poster');
  await user.click(screen.getByRole('button', { name: 'Preview framed' }));
  await screen.findByRole('img', { name: /finished map poster/ });
  expect(exporter).toHaveBeenCalledTimes(2);
  expect(store.getState().past).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Wall preview help' }));
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBe(dialog);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
