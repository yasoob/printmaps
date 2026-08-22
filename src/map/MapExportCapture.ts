import type { PreviewPngExporter } from '../export/previewPng';
import type { MapContentAdapter } from './MapContentAdapter';

type PreviewCapture = Awaited<ReturnType<PreviewPngExporter>>;

function releasePreviewCapture(capture: PreviewCapture | undefined): void {
  if (!capture) return;
  capture.surface.width = 0;
  capture.surface.height = 0;
}

export async function captureBasemapOnly(
  adapter: MapContentAdapter | null,
  capture: () => Promise<PreviewCapture>,
  waitForRender: (signal?: AbortSignal) => Promise<void>,
  options: Readonly<{ onRestoreFailure: () => void; signal?: AbortSignal }>,
): Promise<PreviewCapture> {
  const { onRestoreFailure, signal } = options;
  if (!adapter) {
    throw new Error('The map overlays could not be isolated for layered SVG export. Reload the map and try again.');
  }
  if (!adapter.setExportVisibility(false)) {
    onRestoreFailure();
    throw new Error('The map overlays could not be isolated for layered SVG export. Reload the map and try again.');
  }

  let result: PreviewCapture | undefined;
  let captureFailure: unknown;
  try {
    await waitForRender(signal);
    result = await capture();
  } catch (error) {
    captureFailure = error;
  }

  let restoreFailure: Error | undefined;
  if (adapter.setExportVisibility(true)) {
    try {
      await waitForRender();
    } catch {
      restoreFailure = new Error('The map could not finish restoring its overlays after layered SVG export. Reload the map before exporting again.');
    }
  } else {
    restoreFailure = new Error('The map overlays could not be restored after layered SVG export. Reload the map before exporting again.');
  }

  if (restoreFailure) {
    releasePreviewCapture(result);
    onRestoreFailure();
    throw restoreFailure;
  }
  if (captureFailure) throw captureFailure;
  if (!result) throw new Error('The raster basemap capture did not produce an export surface.');
  return result;
}
