import type React from 'react';
import type { ProjectDocument } from '../../domain/project';
import {
  createLargeRasterPackage,
  pickLargeRasterPackageFile,
  type LargeRasterStage,
} from '../../export/largeRasterPackage';
import type { ExportPreflightResult, RasterDelivery } from '../../export/preflight';
import { createPrintSizePng, type PrintSizePngStage } from '../../export/printSizePng';
import { startPreviewDownload, type PreviewPngExporter } from '../../export/previewPng';
import { createPrintTileExportPlan } from './exportDialogRaster';

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
  rendering: 'Rendering native-detail map tiles…',
  composing: 'Composing native-detail map tiles…',
  encoding: 'Encoding PNG…',
};

const PACKAGE_STAGE_STATUS: Record<LargeRasterStage, string> = {
  rendering: 'Rendering native-detail map tiles…',
  encoding: 'Encoding PNG tile…',
  writing: 'Streaming tile package…',
};

function reportPngStage(stage: PrintSizePngStage | 'downloading', setStatus: Options['setStatus']): void {
  if (stage !== 'downloading') setStatus(PNG_STAGE_STATUS[stage]);
  window.dispatchEvent(new CustomEvent('printmap:png-export-stage', { detail: { stage } }));
}

function isAbort(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof DOMException && error.name === 'AbortError');
}

export async function runPngExport(options: Options): Promise<void> {
  const { abortControllerRef, document, exporter, filename, preflight, rasterDelivery } = options;
  const { setBusy, setError, setStatus } = options;
  const destinationPromise = rasterDelivery === 'tile-package'
    ? pickLargeRasterPackageFile(filename)
    : null;
  const controller = new AbortController();
  abortControllerRef.current = controller;
  setBusy(true);
  setError(null);
  setStatus('Rendering native-detail map tiles…');

  try {
    if (!preflight.dimensions || !preflight.plan) {
      throw new Error('Export preflight did not produce a target tile plan.');
    }
    const output = { width: preflight.dimensions.widthPx, height: preflight.dimensions.heightPx };
    const writable = destinationPromise ? await destinationPromise : null;
    const exportPlan = createPrintTileExportPlan(output, document, preflight.plan.tiles, controller.signal);
    const nativeRenderer = exporter.createPrintTileRenderer;
    if (!nativeRenderer) throw new Error('The live map preview is not ready yet. Wait for the map to load and try again.');
    const renderTile = nativeRenderer(exportPlan);

    if (writable) {
      const result = await createLargeRasterPackage({
        preflight,
        writable,
        renderTile: ({ region, signal }) => renderTile({ output, region, signal }),
        signal: controller.signal,
        onStage: (stage) => setStatus(PACKAGE_STAGE_STATUS[stage]),
        onProgress: ({ completedTiles, totalTiles, fraction }) => {
          setStatus(`Streaming tile package… ${completedTiles}/${totalTiles} tiles (${Math.round(fraction * 100)}%).`);
        },
      });
      setStatus(`Saved ${result.width} × ${result.height} tile package with ${result.tileCount} PNG tiles.`);
      return;
    }

    const result = await createPrintSizePng({
      preflight,
      renderTile: ({ region, signal }) => renderTile({ output, region, signal }),
      signal: controller.signal,
      onStage: (stage) => reportPngStage(stage, setStatus),
      onProgress: ({ completedTiles, totalTiles, fraction }) => {
        setStatus(`Composing PNG… ${completedTiles}/${totalTiles} tiles (${Math.round(fraction * 100)}%).`);
      },
    });
    try {
      reportPngStage('downloading', setStatus);
      startPreviewDownload(result.blob, filename);
      setStatus(`Download started for ${result.width} × ${result.height} PNG.`);
    } finally {
      result.surface.width = 0;
      result.surface.height = 0;
    }
  } catch (error) {
    if (isAbort(error, controller.signal)) setStatus('Export cancelled.');
    else {
      setError(error instanceof Error ? error.message : 'PNG export failed.');
      setStatus('Export failed.');
    }
  } finally {
    if (abortControllerRef.current === controller) abortControllerRef.current = null;
    setBusy(false);
  }
}
