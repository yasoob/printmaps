import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createDefaultStudioSettings } from '../../src/domain/studio';
import type { MapRenderSnapshot } from '../../src/map/MapRenderSnapshot';
import type { PreviewPngExporter } from '../../src/export/previewPng';
import { TerrainProperties } from '../../src/app/components/TerrainProperties';
import { ReliefExportDialog } from '../../src/app/components/ReliefExportDialog';

const mocks = vi.hoisted(() => ({ exportRelief: vi.fn(), download: vi.fn() }));
vi.mock('../../src/terrain/reliefExport', () => ({
  exportTerrainRelief: mocks.exportRelief,
  reliefAttributionNotice: () => 'Elevation data attribution. Import in millimeters. No buildings.',
}));
vi.mock('../../src/lib/downloadBlob', () => ({ downloadBlob: mocks.download }));

const snapshot: MapRenderSnapshot = {
  style: { version: 8, layers: [], sources: {} }, layers: [], assets: {},
  camera: { center: [0, 0], zoom: 10, bearing: 30, pitch: 0, roll: 0 },
  printCamera: { center: [0, 0], zoom: 10, bearing: 30, pitch: 0 },
  referenceLongitude: 0, viewport: { width: 800, height: 600 }, frame: { x: 100, y: 100, width: 400, height: 200 },
  footprint: { corners: [[0, 0.01], [0.02, 0.01], [0.02, 0], [0, 0]], widthPx: 400, heightPx: 200, bearing: 0, pitch: 0 },
};
function exporterFor(value = snapshot): PreviewPngExporter {
  return Object.assign(vi.fn(), { captureRenderSnapshot: vi.fn(() => value) });
}
const studio = createDefaultStudioSettings();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

it('renders default-off controls and sends complete canonical terrain values without a private settings store', () => {
  const onTerrainChange = vi.fn(() => ({ ok: true as const }));
  const props = { documentEpoch: 1, terrain: studio.terrain, relief: studio.relief, layers: [], exporter: null, onTerrainChange, onReliefChange: vi.fn(() => ({ ok: true as const })) };
  const view = render(<TerrainProperties {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Terrain' }));
  const terrainToggle = screen.getByRole('checkbox', { name: 'Show 3D terrain' });
  expect(terrainToggle).not.toBeChecked();
  fireEvent.click(terrainToggle);
  expect(onTerrainChange).toHaveBeenLastCalledWith({ ...studio.terrain, enabled: true });
  expect(terrainToggle).not.toBeChecked();
  view.rerender(<TerrainProperties {...props} terrain={{ ...studio.terrain, enabled: true }} />);
  expect(screen.getByRole('checkbox', { name: 'Show 3D terrain' })).toBeChecked();
  const exaggeration = screen.getByLabelText('Terrain exaggeration');
  fireEvent.change(exaggeration, { target: { value: '3' } });
  fireEvent.blur(exaggeration);
  expect(onTerrainChange).toHaveBeenLastCalledWith({ ...studio.terrain, enabled: true, exaggeration: 3 });
});

it('fits physical model dimensions to the actual snapshot footprint', () => {
  const onChange = vi.fn(() => ({ ok: true as const }));
  render(<ReliefExportDialog documentEpoch={1} settings={studio.relief} layers={[]} exporter={exporterFor()} onChange={onChange} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Fit dimensions to print frame' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ widthMm: 150, heightMm: expect.closeTo(75, 3) }));
});

it('blocks fit on perspective terrain instead of silently flattening or distorting the print footprint', () => {
  const onChange = vi.fn(() => ({ ok: true as const }));
  const pitched = { ...snapshot, footprint: { ...snapshot.footprint, pitch: 30 } };
  render(<ReliefExportDialog documentEpoch={1} settings={studio.relief} layers={[]} exporter={exporterFor(pitched)} onChange={onChange} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Fit dimensions to print frame' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Pitch');
  expect(onChange).not.toHaveBeenCalled();
});

it('shows progress then downloads only a fully successful STL', async () => {
  mocks.exportRelief.mockImplementation(async (_snapshot, _settings, options) => {
    options.onProgress(0.5, 'Loading elevation');
    return new Blob(['mesh']);
  });
  render(<ReliefExportDialog documentEpoch={1} settings={studio.relief} layers={[]} exporter={exporterFor()} onChange={() => ({ ok: true })} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Download STL' }));
  await waitFor(() => expect(mocks.download).toHaveBeenCalledWith(expect.any(Blob), 'terrain-relief-mm.stl'));
  expect(screen.getByRole('status')).toHaveTextContent('Import as millimeters');
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1');
});

it('cancels in-flight work visibly with no partial download and aborts when unmounted', async () => {
  let signal: AbortSignal | undefined;
  mocks.exportRelief.mockImplementation((_snapshot, _settings, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError'))));
  });
  const view = render(<ReliefExportDialog documentEpoch={1} settings={studio.relief} layers={[]} exporter={exporterFor()} onChange={() => ({ ok: true })} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Download STL' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel export' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('cancelled'));
  expect(mocks.download).not.toHaveBeenCalled();
  expect(signal?.aborted).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Download STL' }));
  await act(async () => view.unmount());
  expect(signal?.aborted).toBe(true);
});

it('displays export errors and unavailable snapshot capability rather than claiming success', async () => {
  mocks.exportRelief.mockRejectedValue(new Error('Elevation data is missing'));
  const props = { documentEpoch: 1, settings: studio.relief, layers: [], onChange: () => ({ ok: true as const }), onClose: vi.fn() };
  const view = render(<ReliefExportDialog {...props} exporter={null} />);
  expect(screen.getByRole('button', { name: 'Download STL' })).toBeDisabled();
  view.rerender(<ReliefExportDialog {...props} exporter={exporterFor()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Download STL' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Elevation data is missing'));
  expect(mocks.download).not.toHaveBeenCalled();
});

it('blocks unfinished work and aborts an old project export when its epoch changes', async () => {
  let signal: AbortSignal | undefined;
  mocks.exportRelief.mockImplementation((_snapshot, _settings, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError'))));
  });
  const props = { documentEpoch: 1, settings: studio.relief, layers: [], exporter: exporterFor(), onChange: () => ({ ok: true as const }), onClose: vi.fn() };
  const view = render(<ReliefExportDialog {...props} blockedReason="Finish or discard the current route first." />);
  expect(screen.getByRole('button', { name: 'Download STL' })).toBeDisabled();
  expect(screen.getByText('Finish or discard the current route first.')).toBeVisible();
  view.rerender(<ReliefExportDialog {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Download STL' }));
  view.rerender(<ReliefExportDialog {...props} documentEpoch={2} />);
  await waitFor(() => expect(signal?.aborted).toBe(true));
  expect(mocks.download).not.toHaveBeenCalled();
});
