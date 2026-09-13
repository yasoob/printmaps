import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createNewProjectDocument } from '../../../src/domain/project';
import { ExportDialog } from '../../../src/app/components/ExportDialog';
import { runPngExport } from '../../../src/app/components/exportDialogPng';
import { planPdfExport, runPdfExport } from '../../../src/app/components/exportDialogPdf';
import { runPsdExport } from '../../../src/app/components/exportDialogPsd';
import { recordWorkflowAnalytics } from '../workflowAnalyticsTestUtils';

const mocks = vi.hoisted(() => ({
  png: vi.fn(), pdf: vi.fn(), psd: vi.fn(), svg: vi.fn(), download: vi.fn(), pick: vi.fn(), streaming: vi.fn(),
}));
vi.mock('../../../src/export/printSizePng', () => ({ createPrintSizePng: mocks.png }));
vi.mock('../../../src/export/printPdf', () => ({ createNativePrintPdf: mocks.pdf }));
vi.mock('../../../src/export/printPdfDownload', () => ({ startPrintPdfDownload: mocks.download }));
vi.mock('../../../src/export/layeredPsd', () => ({ createLayeredPsd: mocks.psd, startLayeredPsdDownload: mocks.download }));
vi.mock('../../../src/export/layeredSvg', () => ({ createLayeredSvg: mocks.svg, startLayeredSvgDownload: mocks.download }));
vi.mock('../../../src/export/largeRasterPng', () => ({
  canStreamLargeRasterPng: () => true,
  createLargeRasterPng: mocks.streaming,
  createLargeRasterPngRegions: () => [],
  pickLargeRasterPngFile: mocks.pick,
}));
vi.mock('../../../src/export/previewPng', () => ({ startPreviewDownload: mocks.download }));

const { events } = recordWorkflowAnalytics();
beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.png.mockResolvedValue({ width: 1, height: 1, blob: new Blob(['Private map']), surface: document.createElement('canvas') });
  mocks.pdf.mockResolvedValue(new Blob(['Private PDF']));
  mocks.psd.mockResolvedValue(new Blob(['Private PSD']));
  mocks.svg.mockResolvedValue('Private SVG');
});

function options() {
  const project = createNewProjectDocument();
  return {
    abortControllerRef: { current: null as AbortController | null },
    document: project,
    exporter: Object.assign(vi.fn(async () => ({
      blob: new Blob(['Private preview']), width: 1, height: 1, surface: document.createElement('canvas'),
      projectToFrame: () => ({ x: 0, y: 0 }),
    })), { createPrintTileRenderer: vi.fn(() => vi.fn()) }),
    filename: 'Private project filename',
    preflight: planPdfExport(project),
    rasterDelivery: 'single-png' as const,
    setBusy: vi.fn(), setError: vi.fn(), setStatus: vi.fn(), setCancellationAvailable: vi.fn(),
  };
}

const jobs = [
  { format: 'png', run: runPngExport },
  { format: 'pdf', run: runPdfExport },
  { format: 'psd', run: runPsdExport },
] as const;

it.each(jobs)('reports a $format download only after it is handed to the browser', async ({ format, run }) => {
  await run(options());
  expect(mocks.download).toHaveBeenCalledOnce();
  expect(events()).toEqual([{ action: 'exportStarted', format }, { action: 'exportCompleted', format }]);
});

it.each(jobs)('distinguishes $format failures from cancellation without exception details', async ({ format, run }) => {
  mocks[format].mockRejectedValueOnce(new Error('Private exporter failure'));
  await run(options());
  mocks[format].mockRejectedValueOnce(new DOMException('Private canceled operation', 'AbortError'));
  await run(options());
  expect(events()).toEqual([
    { action: 'exportStarted', format }, { action: 'exportFailed', format },
    { action: 'exportStarted', format }, { action: 'exportCancelled', format },
  ]);
  expect(mocks.download).not.toHaveBeenCalled();
});

it('reports file picker cancellation and a completed streaming PNG without recording destinations', async () => {
  const writable = { write: vi.fn(), close: vi.fn(), abort: vi.fn() };
  mocks.pick.mockRejectedValueOnce(new DOMException('Private path', 'AbortError')).mockResolvedValueOnce(writable);
  mocks.streaming.mockResolvedValueOnce({ width: 10, height: 10 });
  await runPngExport({ ...options(), rasterDelivery: 'streaming-png' });
  await runPngExport({ ...options(), rasterDelivery: 'streaming-png' });
  expect(events()).toEqual([
    { action: 'exportStarted', format: 'png' }, { action: 'exportCancelled', format: 'png' },
    { action: 'exportStarted', format: 'png' }, { action: 'exportCompleted', format: 'png' },
  ]);
});

it('tracks SVG format choice and its download once, without events on render', async () => {
  const job = options();
  const view = render(<ExportDialog document={job.document} exporter={job.exporter} filename={job.filename} onClose={vi.fn()} />);
  expect(events()).toEqual([]);
  fireEvent.click(screen.getByRole('radio', { name: /Layered SVG/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Download layered SVG' }));
  await waitFor(() => expect(events().at(-1)?.action).toBe('exportCompleted'));
  view.unmount();
  expect(events()).toEqual([
    { action: 'exportFormatSelected', format: 'svg' },
    { action: 'exportStarted', format: 'svg' },
    { action: 'exportCompleted', format: 'svg' },
  ]);
});

it.each([
  { error: new Error('Private SVG failure'), action: 'exportFailed' },
  { error: new DOMException('Private SVG cancellation', 'AbortError'), action: 'exportCancelled' },
])('reports SVG $action without a successful download', async ({ error, action }) => {
  mocks.svg.mockRejectedValueOnce(error);
  const job = options();
  render(<ExportDialog document={job.document} exporter={job.exporter} filename={job.filename} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('radio', { name: /Layered SVG/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Download layered SVG' }));
  await waitFor(() => expect(events().at(-1)?.action).toBe(action));
  expect(events().slice(1)).toEqual([{ action: 'exportStarted', format: 'svg' }, { action, format: 'svg' }]);
  expect(mocks.download).not.toHaveBeenCalled();
});

it.each([runPdfExport, runPsdExport])('reports unavailable native exporters as failures', async (run) => {
  await run({ ...options(), exporter: null });
  expect(events().map(({ action }) => action)).toEqual(['exportStarted', 'exportFailed']);
  expect(mocks.download).not.toHaveBeenCalled();
});
