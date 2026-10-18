import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ExportDialog } from '../../../src/app/components/ExportDialog';
import { ProjectStoreContext } from '../../../src/app/projectStoreContext';
import { createProjectStore } from '../../../src/app/store';
import { createInitialProjectDocument } from '../../../src/domain/project';
import type { PreviewPngExporter } from '../../../src/export/previewPng';
import type { VectorBasemapCapture } from '../../../src/export/vector/scene';
import { chooseOption, selectedValue } from '../select-support';
import userEvent from '@testing-library/user-event';

const serializers = vi.hoisted(() => ({
  svg: vi.fn(() => new Blob(['vector'])), pdf: vi.fn(async () => new Blob(['pdf'])), download: vi.fn(),
}));
vi.mock('../../../src/export/layeredSvg', () => ({
  createVectorSvg: serializers.svg, startLayeredSvgDownload: serializers.download,
}));
vi.mock('../../../src/export/printPdf', () => ({ createVectorPrintPdf: serializers.pdf }));
vi.mock('../../../src/export/printPdfDownload', () => ({ startPrintPdfDownload: serializers.download }));

const capture: VectorBasemapCapture = {
  scene: { kind: 'vector', width: 100, height: 100, groups: [] },
  referenceLongitude: 0, projectToFrame: () => ({ x: 0.5, y: 0.5 }),
};

function setup() {
  const exporter: PreviewPngExporter = Object.assign(vi.fn(), { captureVectorBasemap: vi.fn(async () => capture) });
  const document = createInitialProjectDocument();
  const store = createProjectStore(document);
  render(<ProjectStoreContext value={store}><ExportDialog exporter={exporter} filename="map" document={document} onClose={vi.fn()} /></ProjectStoreContext>);
  return { exporter, document };
}

beforeEach(() => vi.clearAllMocks());

it.each(['svg', 'pdf'] as const)('opts into %s vectors without raster capture and retains compatibility mode by default', async (format) => {
  const { exporter } = setup();
  fireEvent.click(screen.getByRole('radio', { name: format === 'svg' ? /Layered SVG/ : /^PDF/ }));
  expect(selectedValue(screen.getByRole('combobox', { name: 'Basemap rendering' }))).toBe('hybrid');
  await chooseOption(userEvent.setup(), 'Basemap rendering', 'True vector artwork (reflowed labels)');
  expect(screen.queryByText(/Sprites become generic named/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Basemap rendering help' }));
  expect(screen.getByRole('tooltip')).toHaveTextContent('Sprites become generic named markers');
  fireEvent.click(screen.getByRole('button', { name: format === 'svg' ? 'Download layered SVG' : 'Download PDF' }));
  await waitFor(() => expect(serializers.download).toHaveBeenCalledOnce());
  // Only the dialog's poster preview may capture; no raster export fallback.
  expect(vi.mocked(exporter).mock.calls.filter(([options]) => options?.content !== 'composite')).toEqual([]);
  expect(exporter.captureVectorBasemap).toHaveBeenCalledOnce();
  expect(format === 'svg' ? serializers.svg : serializers.pdf).toHaveBeenCalledOnce();
});

it('serializes an immutable document revision even when canonical state changes during capture', async () => {
  const { exporter, document } = setup();
  let finish!: (value: VectorBasemapCapture) => void;
  vi.mocked(exporter.captureVectorBasemap!).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const title = document.title;
  fireEvent.click(screen.getByRole('radio', { name: /Layered SVG/ }));
  await chooseOption(userEvent.setup(), 'Basemap rendering', 'True vector artwork (reflowed labels)');
  fireEvent.click(screen.getByRole('button', { name: 'Download layered SVG' }));
  document.title = 'Changed during capture';
  finish(capture);
  await waitFor(() => expect(serializers.svg).toHaveBeenCalledOnce());
  expect(serializers.svg).toHaveBeenCalledWith(expect.objectContaining({ title }), capture);
});

it('reports unsupported styles and never downloads an automatic hybrid fallback', async () => {
  const { exporter } = setup();
  vi.mocked(exporter.captureVectorBasemap!).mockRejectedValue(new Error('Unsupported raster. Choose Hybrid mode.'));
  fireEvent.click(screen.getByRole('radio', { name: /Layered SVG/ }));
  await chooseOption(userEvent.setup(), 'Basemap rendering', 'True vector artwork (reflowed labels)');
  fireEvent.click(screen.getByRole('button', { name: 'Download layered SVG' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose Hybrid mode');
  expect(serializers.download).not.toHaveBeenCalled();
  // Only the dialog's poster preview may capture; no raster export fallback.
  expect(vi.mocked(exporter).mock.calls.filter(([options]) => options?.content !== 'composite')).toEqual([]);
  expect(screen.getByRole('button', { name: 'Download layered SVG' })).toBeEnabled();
});

it('cancels vector capture without serializing or downloading output', async () => {
  const { exporter } = setup();
  vi.mocked(exporter.captureVectorBasemap!).mockImplementation((options) => new Promise((_, reject) => {
    options!.signal!.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
  }));
  fireEvent.click(screen.getByRole('radio', { name: /Layered SVG/ }));
  await chooseOption(userEvent.setup(), 'Basemap rendering', 'True vector artwork (reflowed labels)');
  fireEvent.click(screen.getByRole('button', { name: 'Download layered SVG' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel export' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Export cancelled.'));
  expect(serializers.svg).not.toHaveBeenCalled();
  expect(serializers.download).not.toHaveBeenCalled();
});
