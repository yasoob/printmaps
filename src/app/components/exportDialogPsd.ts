import type React from 'react';
import type { ProjectDocument } from '../../domain/project';
import { planLayeredPsdExport } from '../../export/layeredPsdPlan';
import type { ExportPreflightResult } from '../../export/preflight';
import type { PreviewPngExporter } from '../../export/previewPng';
import { createPrintRegionExportPlan, NATIVE_SYMBOL_BUFFER_PX } from './exportDialogRaster';

type Options = Readonly<{
  abortControllerRef: React.RefObject<AbortController | null>;
  document: ProjectDocument;
  exporter: PreviewPngExporter | null;
  filename: string;
  setBusy: (isBusy: boolean) => void;
  setCancellationAvailable: (isAvailable: boolean) => void;
  setError: (error: string | null) => void;
  setStatus: (status: string) => void;
}>;

type ReadyPsdPreflight = ExportPreflightResult & {
  dimensions: NonNullable<ExportPreflightResult['dimensions']>;
  plan: NonNullable<ExportPreflightResult['plan']>;
};

type PsdJob = Readonly<{
  createPrintTileRenderer: NonNullable<PreviewPngExporter['createPrintTileRenderer']>;
  effectiveDpi: number;
  exporter: PreviewPngExporter;
  preflight: ReadyPsdPreflight;
}>;

function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Layered PSD export was cancelled.', 'AbortError');
}

function isAbort(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof DOMException && error.name === 'AbortError');
}

function preparePsdJob(options: Options): PsdJob | null {
  const { document, exporter, setError } = options;
  const createPrintTileRenderer = exporter?.createPrintTileRenderer;
  if (!exporter || !createPrintTileRenderer) {
    setError('The live map preview is not ready yet. Wait for the map to load and try again.');
    return null;
  }
  const psdPlan = planLayeredPsdExport(document);
  const { preflight } = psdPlan;
  if (!preflight.safe || !preflight.dimensions || !preflight.plan) {
    setError(preflight.errors[0]?.message ?? 'This layered PSD cannot be rendered safely.');
    return null;
  }
  return {
    createPrintTileRenderer,
    effectiveDpi: psdPlan.effectiveDpi,
    exporter,
    preflight: { ...preflight, dimensions: preflight.dimensions, plan: preflight.plan },
  };
}

function psdStageStatus(stage: 'basemap' | 'layers' | 'packaging', detail?: string): string {
  if (stage === 'basemap') return 'Rendering native-detail PSD basemap regions…';
  if (stage === 'layers') return `Rendering Photoshop layer "${detail ?? 'Artwork'}"…`;
  return 'Packaging Photoshop layers…';
}

function reportPsdFailure(error: unknown, signal: AbortSignal, options: Options): void {
  if (isAbort(error, signal)) options.setStatus('Export cancelled.');
  else {
    options.setError(error instanceof Error ? error.message : 'Layered PSD export failed.');
    options.setStatus('Export failed.');
  }
}

export async function runPsdExport(options: Options): Promise<void> {
  const job = preparePsdJob(options);
  if (!job) return;
  const {
    abortControllerRef,
    document,
    filename,
    setBusy,
    setCancellationAvailable,
    setError,
    setStatus,
  } = options;
  const { createPrintTileRenderer, effectiveDpi, exporter, preflight } = job;
  const controller = new AbortController();
  abortControllerRef.current = controller;
  setBusy(true);
  setCancellationAvailable(true);
  setError(null);
  setStatus('Preparing layered Photoshop document…');
  let sourceSurface: HTMLCanvasElement | null = null;
  try {
    const psdModulePromise = import('../../export/layeredPsd');
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
    const { createLayeredPsd, startLayeredPsdDownload } = await psdModulePromise;
    const psd = await createLayeredPsd(document, source, {
      effectiveDpi,
      preflight,
      renderTile: ({ region, signal }) => renderNativeTile({ output, region, signal }),
      signal: controller.signal,
      onProgress: ({ completedTiles, totalTiles, fraction }) => {
        setStatus(`Building PSD basemap… ${completedTiles}/${totalTiles} regions (${Math.round(fraction * 100)}%).`);
      },
      onStage: (stage, detail) => {
        if (stage === 'packaging') setCancellationAvailable(false);
        setStatus(psdStageStatus(stage, detail));
      },
    });
    throwIfCancelled(controller.signal);
    startLayeredPsdDownload(psd, filename);
    setStatus('Download started for layered PSD.');
  } catch (error) {
    reportPsdFailure(error, controller.signal, options);
  } finally {
    if (sourceSurface) {
      sourceSurface.width = 0;
      sourceSurface.height = 0;
    }
    if (abortControllerRef.current === controller) abortControllerRef.current = null;
    setCancellationAvailable(true);
    setBusy(false);
  }
}
