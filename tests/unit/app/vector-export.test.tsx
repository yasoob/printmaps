import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ExportDialog } from '../../../src/app/components/ExportDialog';
import { createInitialProjectDocument } from '../../../src/domain/project';
import type { PreviewPngExporter } from '../../../src/export/previewPng';
import type { VectorBasemapCapture } from '../../../src/export/vector/scene';

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
  render(<ExportDialog exporter={exporter} filename="map" document={document} onClose={vi.fn()} />);
  return { exporter, document };
}

beforeEach(() => vi.clearAllMocks());

it.each(['svg', 'pdf'] as const)('opts into %s vectors without raster capture and retains compatibility mode by default', async (format) => {
  const { exporter } = setup();
  fireEvent.click(screen.getByRole('radio', { name: format === 'svg' ? /Layered SVG/ : /^PDF/ }));
  expect(screen.getByLabelText('Basemap rendering')).toHaveValue('hybrid');
  fireEvent.change(screen.getByLabelText('Basemap rendering'), { target: { value: 'vector' } });
  expect(screen.queryByText(/Sprites become generic named/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Basemap rendering help' }));
  expect(screen.getByRole('tooltip')).toHaveTextContent('Sprites become generic named markers');
  fireEvent.click(screen.getByRole('button', { name: format === 'svg' ? 'Download layered SVG' : 'Download PDF' }));
  await waitFor(() => expect(serializers.download).toHaveBeenCalledOnce());
  expect(exporter).not.toHaveBeenCalled();
  expect(exporter.captureVectorBasemap).toHaveBeenCalledOnce();
  expect(format === 'svg' ? serializers.svg : serializers.pdf).toHaveBeenCalledOnce();
});

it('serializes an immutable document revision even when canonical state changes during capture', async () => {
  const { exporter, document } = setup();
  let finish!: (value: VectorBasemapCapture) => void;
  vi.mocked(exporter.captureVectorBasemap!).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const title = document.title;
  fireEvent.click(screen.getByRole('radio', { name: /Layered SVG/ }));
  fireEvent.change(screen.getByLabelText('Basemap rendering'), { target: { value: 'vector' } });
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
  fireEvent.change(screen.getByLabelText('Basemap rendering'), { target: { value: 'vector' } });
  fireEvent.click(screen.getByRole('button', { name: 'Download layered SVG' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose Hybrid mode');
  expect(serializers.download).not.toHaveBeenCalled();
  expect(exporter).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Download layered SVG' })).toBeEnabled();
});

it('cancels vector capture without serializing or downloading output', async () => {
  const { exporter } = setup();
  vi.mocked(exporter.captureVectorBasemap!).mockImplementation((options) => new Promise((_, reject) => {
    options!.signal!.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
  }));
  fireEvent.click(screen.getByRole('radio', { name: /Layered SVG/ }));
  fireEvent.change(screen.getByLabelText('Basemap rendering'), { target: { value: 'vector' } });
  fireEvent.click(screen.getByRole('button', { name: 'Download layered SVG' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel export' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Export cancelled.'));
  expect(serializers.svg).not.toHaveBeenCalled();
  expect(serializers.download).not.toHaveBeenCalled();
});
