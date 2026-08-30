import type React from 'react';
import type { ProjectDocument } from '../../domain/project';
import { projectAttributions } from '../../domain/projectAttributions';
import { planExportPreflight, type ExportPreflightResult } from '../../export/preflight';
import type { PreviewPngExporter } from '../../export/previewPng';
import { createPrintRegionExportPlan, NATIVE_SYMBOL_BUFFER_PX } from './exportDialogRaster';

type Options = Readonly<{
  abortControllerRef: React.RefObject<AbortController | null>;
  document: ProjectDocument;
  exporter: PreviewPngExporter | null;
  filename: string;
  setBusy: (isBusy: boolean) => void;
  setError: (error: string | null) => void;
  setStatus: (status: string) => void;
}>;

type ReadyPreflight = ExportPreflightResult & {
  dimensions: NonNullable<ExportPreflightResult['dimensions']>;
  plan: NonNullable<ExportPreflightResult['plan']>;
};

function pdfPreflight(document: ProjectDocument) {
  return planExportPreflight({
    format: 'pdf',
    page: { widthMm: document.page.widthMm, heightMm: document.page.heightMm },
    dpi: 300,
    attributions: projectAttributions(document),
    basemap: 'raster',
    vectorOverlays: true,
    missing: {},
    rasterLayers: [],
    cancellationSupported: true,
  }, document.style.visibility.labels ? { tileOverlapPx: NATIVE_SYMBOL_BUFFER_PX } : {});
}

function isAbort(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof DOMException && error.name === 'AbortError');
}

function stageStatus(stage: 'rendering' | 'encoding'): string {
  return stage === 'rendering'
    ? 'Rendering native-detail PDF basemap regions…'
    : 'Losslessly encoding PDF basemap regions…';
}

function preparePdfJob(options: Options): Readonly<{
  createPrintTileRenderer: NonNullable<PreviewPngExporter['createPrintTileRenderer']>;
  exporter: PreviewPngExporter;
  preflight: ReadyPreflight;
}> | null {
  const { document, exporter, setError } = options;
  const createPrintTileRenderer = exporter?.createPrintTileRenderer;
  if (!exporter || !createPrintTileRenderer) {
    setError('The live map preview is not ready yet. Wait for the map to load and try again.');
    return null;
  }
  const preflight = pdfPreflight(document);
  if (!preflight.safe || !preflight.dimensions || !preflight.plan) {
    setError(preflight.errors[0]?.message ?? 'This PDF cannot be rendered safely at 300 DPI.');
    return null;
  }
  return {
    createPrintTileRenderer,
    exporter,
    preflight: { ...preflight, dimensions: preflight.dimensions, plan: preflight.plan },
  };
}

function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('PDF export was cancelled.', 'AbortError');
}

function reportPdfFailure(error: unknown, signal: AbortSignal, options: Options): void {
  if (isAbort(error, signal)) options.setStatus('Export cancelled.');
  else {
    options.setError(error instanceof Error ? error.message : 'PDF export failed.');
    options.setStatus('Export failed.');
  }
}

function finishPdfJob(
  sourceSurface: HTMLCanvasElement | null,
  controller: AbortController,
  options: Options,
): void {
  if (sourceSurface) {
    sourceSurface.width = 0;
    sourceSurface.height = 0;
  }
  if (options.abortControllerRef.current === controller) options.abortControllerRef.current = null;
  options.setBusy(false);
}

export async function runPdfExport(options: Options): Promise<void> {
  const job = preparePdfJob(options);
  if (!job) return;
  const { abortControllerRef, document, filename, setBusy, setError, setStatus } = options;
  const { createPrintTileRenderer, exporter, preflight } = job;
  const controller = new AbortController();
  abortControllerRef.current = controller;
  setBusy(true);
  setError(null);
  setStatus('Preparing native-detail PDF basemap…');
  let sourceSurface: HTMLCanvasElement | null = null;
  try {
    const pdfModules = Promise.all([
      import('../../export/printPdf'),
      import('../../export/printPdfDownload'),
    ]);
    const source = await exporter({ content: 'basemap', signal: controller.signal });
    sourceSurface = source.surface;
    throwIfCancelled(controller.signal);
    const output = { width: preflight.dimensions.widthPx, height: preflight.dimensions.heightPx };
    const regions = preflight.plan.tiles.map((tile) => ({
      x: tile.renderX,
      y: tile.renderY,
      width: tile.renderWidth,
      height: tile.renderHeight,
    }));
    const exportPlan = createPrintRegionExportPlan({
      content: 'basemap',
      document,
      output,
      regions,
      signal: controller.signal,
      symbolBufferPx: document.style.visibility.labels ? NATIVE_SYMBOL_BUFFER_PX : 0,
    });
    const renderNativeTile = createPrintTileRenderer(exportPlan);
    const [{ createNativePrintPdf }, { startPrintPdfDownload }] = await pdfModules;
    const pdf = await createNativePrintPdf(document, source, {
      preflight,
      renderTile: ({ region, signal }) => renderNativeTile({ output, region, signal }),
      signal: controller.signal,
      onStage: (stage) => setStatus(stageStatus(stage)),
      onProgress: ({ completedTiles, totalTiles, fraction }) => {
        setStatus(`Building PDF… ${completedTiles}/${totalTiles} regions (${Math.round(fraction * 100)}%).`);
      },
    });
    throwIfCancelled(controller.signal);
    startPrintPdfDownload(pdf, filename);
    setStatus('Download started for PDF.');
  } catch (error) {
    reportPdfFailure(error, controller.signal, options);
  } finally {
    finishPdfJob(sourceSurface, controller, options);
  }
}
