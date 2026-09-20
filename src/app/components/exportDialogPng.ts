import type React from 'react';
import { trackEditorAction } from '../../analytics/editorAnalytics';
import type { ProjectDocument } from '../../domain/project';
import {
  createLargeRasterPng,
  createLargeRasterPngRegions,
  pickLargeRasterPngFile,
  type LargeRasterStage,
  type LargeRasterWritable,
} from '../../export/largeRasterPng';
import type { ExportPreflightResult, RasterDelivery } from '../../export/preflight';
import type { PrintSizePngStage } from '../../export/printSizePng';
import { startPreviewDownload, type PreviewPngExporter } from '../../export/previewPng';
import { createPrintRegionExportPlan, NATIVE_SYMBOL_BUFFER_PX } from './exportDialogRaster';
import { prepareStudioPrintRenderer } from '../../export/studioPrintRenderer';

type Options = Readonly<{
  abortControllerRef: React.RefObject<AbortController | null>;
  document: ProjectDocument;
  exporter: PreviewPngExporter;
  filename: string;
  preflight: ExportPreflightResult;
  rasterDelivery: RasterDelivery;
  setBusy: (isBusy: boolean) => void;
  setError: (error: string | null) => void;
  setStatus: (status: string) => void;
}>;

const PNG_STAGE_STATUS: Record<PrintSizePngStage, string> = {
  rendering: 'Rendering native-detail map regions…',
  composing: 'Composing native-detail map regions…',
  encoding: 'Encoding PNG…',
};

const STREAMING_STAGE_STATUS: Record<LargeRasterStage, string> = {
  rendering: 'Rendering native-detail map regions…',
  encoding: 'Encoding PNG scanlines…',
  writing: 'Finalizing PNG…',
};

function reportPngStage(stage: PrintSizePngStage | 'downloading', setStatus: Options['setStatus']): void {
  if (stage !== 'downloading') setStatus(PNG_STAGE_STATUS[stage]);
  window.dispatchEvent(new CustomEvent('printmap:png-export-stage', { detail: { stage } }));
}

function isAbort(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof DOMException && error.name === 'AbortError');
}

async function abortWithoutMasking(writable: LargeRasterWritable, error: unknown): Promise<void> {
  try {
    await writable.abort(error);
  } catch {
    // Preserve the planning or renderer failure.
  }
}

async function reportPngFailure(options: Readonly<{
  error: unknown;
  writable: LargeRasterWritable | null;
  isWritableOwnedByEncoder: boolean;
  signal: AbortSignal;
  setError: Options['setError'];
  setStatus: Options['setStatus'];
}>): Promise<void> {
  const { error, writable, isWritableOwnedByEncoder, signal, setError, setStatus } = options;
  if (writable && !isWritableOwnedByEncoder) await abortWithoutMasking(writable, error);
  if (isAbort(error, signal)) {
    trackEditorAction('exportCancelled', { format: 'png' });
    setStatus('Export cancelled.');
  }
  else {
    trackEditorAction('exportFailed', { format: 'png' });
    setError(error instanceof Error ? error.message : 'PNG export failed.');
    setStatus('Export failed.');
  }
}

export async function runPngExport(options: Options): Promise<void> {
  trackEditorAction('exportStarted', { format: 'png' });
  const { abortControllerRef, document, exporter, filename, preflight, rasterDelivery } = options;
  const { setBusy, setError, setStatus } = options;
  const destinationPromise = rasterDelivery === 'streaming-png'
    ? pickLargeRasterPngFile(filename)
    : null;
  const controller = new AbortController();
  abortControllerRef.current = controller;
  setBusy(true);
  setError(null);
  setStatus('Rendering native-detail map regions…');
  let writable: LargeRasterWritable | null = null;
  let isWritableOwnedByEncoder = false;
  let poster: Awaited<ReturnType<typeof prepareStudioPrintRenderer>> | undefined;

  try {
    if (!preflight.dimensions || !preflight.plan) {
      throw new Error('Export preflight did not produce a target tile plan.');
    }
    const output = { width: preflight.dimensions.widthPx, height: preflight.dimensions.heightPx };
    writable = destinationPromise ? await destinationPromise : null;
    const regions = writable
      ? createLargeRasterPngRegions(preflight).map(({ region }) => region)
      : preflight.plan.tiles.map((tile) => ({
        x: tile.renderX, y: tile.renderY, width: tile.renderWidth, height: tile.renderHeight,
      }));
    const exportPlan = createPrintRegionExportPlan({
      content: 'composite',
      document,
      output,
      regions,
      signal: controller.signal,
      symbolBufferPx: document.style.visibility.labels ? NATIVE_SYMBOL_BUFFER_PX : 0,
    });
    poster = await prepareStudioPrintRenderer(document, exporter, exportPlan);
    const { renderTile, isAttributionIncluded } = poster;

    if (writable) {
      isWritableOwnedByEncoder = true;
      const result = await createLargeRasterPng({
        preflight,
        isAttributionIncluded,
        writable,
        renderTile: ({ region, signal }) => renderTile({ output, region, signal }),
        signal: controller.signal,
        onStage: (stage) => setStatus(STREAMING_STAGE_STATUS[stage]),
        onProgress: ({ completedTiles, totalTiles, fraction }) => {
          setStatus(`Rendering PNG… ${completedTiles}/${totalTiles} regions (${Math.round(fraction * 100)}%).`);
        },
      });
      trackEditorAction('exportCompleted', { format: 'png' });
      setStatus(`Saved ${result.width} × ${result.height} PNG.`);
      return;
    }

    const { createPrintSizePng } = await import('../../export/printSizePng');
    const result = await createPrintSizePng({
      preflight,
      isAttributionIncluded,
      renderTile: ({ region, signal }) => renderTile({ output, region, signal }),
      signal: controller.signal,
      onStage: (stage) => reportPngStage(stage, setStatus),
      onProgress: ({ completedTiles, totalTiles, fraction }) => {
        setStatus(`Composing PNG… ${completedTiles}/${totalTiles} regions (${Math.round(fraction * 100)}%).`);
      },
    });
    try {
      if (controller.signal.aborted) throw new DOMException('PNG export was cancelled.', 'AbortError');
      reportPngStage('downloading', setStatus);
      startPreviewDownload(result.blob, filename);
      trackEditorAction('exportCompleted', { format: 'png' });
      setStatus(`Download started for ${result.width} × ${result.height} PNG.`);
    } finally {
      result.surface.width = 0;
      result.surface.height = 0;
    }
  } catch (error) {
    await reportPngFailure({ error, writable, isWritableOwnedByEncoder, signal: controller.signal, setError, setStatus });
  } finally {
    poster?.dispose();
    if (abortControllerRef.current === controller) abortControllerRef.current = null;
    setBusy(false);
  }
}
