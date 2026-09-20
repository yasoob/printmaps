import { runPngExport } from '../../src/app/components/exportDialogPng';
import { createInitialProjectDocument } from '../../src/domain/project';
import { projectAttributions } from '../../src/domain/projectAttributions';
import { planExportPreflight } from '../../src/export/preflight';
import { createPrintSizePng } from '../../src/export/printSizePng';
import { startPreviewDownload, type PreviewPngExporter } from '../../src/export/previewPng';
import { prepareStudioPrintRenderer } from '../../src/export/studioPrintRenderer';

vi.mock('../../src/export/printSizePng', () => ({ createPrintSizePng: vi.fn() }));
vi.mock('../../src/export/studioPrintRenderer', () => ({ prepareStudioPrintRenderer: vi.fn() }));
vi.mock('../../src/export/previewPng', () => ({ startPreviewDownload: vi.fn() }));

it('releases a late PNG result without downloading after the workspace aborts', async () => {
  const document = createInitialProjectDocument();
  const abortControllerRef = { current: null as AbortController | null };
  const dispose = vi.fn();
  vi.mocked(prepareStudioPrintRenderer).mockResolvedValue({
    dispose, isAttributionIncluded: true, renderTile: vi.fn(),
  });
  const surface = window.document.createElement('canvas');
  vi.mocked(createPrintSizePng).mockImplementation(async () => {
    abortControllerRef.current?.abort();
    return { surface, blob: new Blob(['late PNG']), width: 100, height: 100 };
  });
  const preflight = planExportPreflight({
    format: 'png', page: document.page, dpi: 300, attributions: projectAttributions(document), basemap: 'raster',
    vectorOverlays: true, missing: {}, rasterLayers: [], cancellationSupported: true, rasterDelivery: 'single-png',
  });
  expect(preflight.errors).toEqual([]);
  const setStatus = vi.fn();
  await runPngExport({
    document, exporter: vi.fn<PreviewPngExporter>(), filename: 'map', preflight, rasterDelivery: 'single-png', abortControllerRef,
    setBusy: vi.fn(), setError: vi.fn(), setStatus,
  });
  expect(startPreviewDownload).not.toHaveBeenCalled();
  expect(setStatus).toHaveBeenLastCalledWith('Export cancelled.');
  expect(surface.width).toBe(0);
  expect(surface.height).toBe(0);
  expect(dispose).toHaveBeenCalledOnce();
});
