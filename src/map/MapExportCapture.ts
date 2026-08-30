import type { PreviewPngExporter } from '../export/previewPng';
import type { MapContentAdapter } from './MapContentAdapter';

type PreviewCapture = Awaited<ReturnType<PreviewPngExporter>>;

function releasePreviewCapture(capture: PreviewCapture | undefined): void {
  if (!capture) return;
  capture.surface.width = 0;
  capture.surface.height = 0;
}

type BasemapVisibilitySetter = (override: boolean | null) => boolean;

function prepareVisibleBasemap(
  setBasemapVisibility: BasemapVisibilitySetter | undefined,
  onRestoreFailure: () => void,
): void {
  if (!setBasemapVisibility || setBasemapVisibility(true)) return;
  onRestoreFailure();
  throw new Error('The basemap could not be prepared for export. Reload the map and try again.');
}

function requireContentAdapter(
  adapter: MapContentAdapter | null,
  setBasemapVisibility: BasemapVisibilitySetter | undefined,
): MapContentAdapter {
  if (adapter) return adapter;
  setBasemapVisibility?.(null);
  throw new Error('The map overlays could not be isolated for layered SVG export. Reload the map and try again.');
}

function hideContentLayers(
  adapter: MapContentAdapter,
  setBasemapVisibility: BasemapVisibilitySetter | undefined,
  onRestoreFailure: () => void,
): void {
  if (adapter.setExportVisibility(false)) return;
  setBasemapVisibility?.(null);
  onRestoreFailure();
  throw new Error('The map overlays could not be isolated for layered SVG export. Reload the map and try again.');
}

function immediateRestoreFailure(
  isBasemapRestored: boolean,
  isContentRestored: boolean,
): Error | undefined {
  if (!isContentRestored) {
    return new Error('The map overlays could not be restored after layered SVG export. Reload the map before exporting again.');
  }
  if (!isBasemapRestored) {
    return new Error('The basemap could not be restored after export. Reload the map before exporting again.');
  }
}

export async function captureBasemapOnly(
  adapter: MapContentAdapter | null,
  capture: () => Promise<PreviewCapture>,
  waitForRender: (signal?: AbortSignal) => Promise<void>,
  options: Readonly<{
    onRestoreFailure: () => void;
    setBasemapVisibility?: (override: boolean | null) => boolean;
    signal?: AbortSignal;
  }>,
): Promise<PreviewCapture> {
  const { onRestoreFailure, setBasemapVisibility, signal } = options;
  prepareVisibleBasemap(setBasemapVisibility, onRestoreFailure);
  const contentAdapter = requireContentAdapter(adapter, setBasemapVisibility);
  hideContentLayers(contentAdapter, setBasemapVisibility, onRestoreFailure);

  let result: PreviewCapture | undefined;
  let captureFailure: unknown;
  try {
    await waitForRender(signal);
    result = await capture();
  } catch (error) {
    captureFailure = error;
  }

  const isBasemapRestored = setBasemapVisibility?.(null) ?? true;
  const isContentRestored = contentAdapter.setExportVisibility(true);
  let restoreFailure = immediateRestoreFailure(isBasemapRestored, isContentRestored);
  if (!restoreFailure) {
    try {
      await waitForRender();
    } catch {
      restoreFailure = new Error('The map could not finish restoring its overlays after layered SVG export. Reload the map before exporting again.');
    }
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
