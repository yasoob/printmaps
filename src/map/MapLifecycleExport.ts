import type { Map as MapLibreMap } from 'maplibre-gl';
import { capturePrintFramePng, type PreviewPngExporter } from '../export/previewPng';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';
import type { ContentLayer } from '../domain/project';
import type { MapContentAdapter } from './MapContentAdapter';
import { captureBasemapOnly } from './MapExportCapture';
import { createNativePrintTileRenderer } from './NativePrintTileRenderer';

type MutableReference<T> = { current: T };

export type LifecycleExportReferences = {
  availableExporter: MutableReference<PreviewPngExporter | null>;
  container: MutableReference<HTMLDivElement | null>;
  contentAdapter: MutableReference<MapContentAdapter | null>;
  contentReady: MutableReference<boolean>;
  contentState: MutableReference<{
    assets?: Record<string, CustomMarkerAsset>;
    layers: ContentLayer[];
  }>;
  exporterChange: MutableReference<((exporter: PreviewPngExporter | null) => void) | undefined>;
  map: MutableReference<MapLibreMap | null>;
  mapFailed: MutableReference<boolean>;
};

function waitForMapRender(map: MapLibreMap, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Export cancelled.', 'AbortError'));
      return;
    }
    const cleanup = () => {
      clearTimeout(timeout);
      map.off('render', handleRender);
      map.off('error', handleRendererError);
      signal?.removeEventListener('abort', handleAbort);
    };
    const finish = (error?: unknown) => {
      cleanup();
      if (error) reject(error); else resolve();
    };
    const handleRender = () => finish();
    const handleRendererError = (event?: { error?: unknown }) => finish(
      event?.error instanceof Error
        ? event.error
        : new Error('The map renderer failed while preparing the export.'),
    );
    const handleAbort = () => finish(new DOMException('Export cancelled.', 'AbortError'));
    const timeout = setTimeout(() => finish(new Error('The map renderer timed out while preparing the export.')), 1000);
    signal?.addEventListener('abort', handleAbort, { once: true });
    try {
      map.once('render', handleRender);
      map.once('error', handleRendererError);
      map.triggerRepaint();
    } catch (error) {
      finish(error);
    }
  });
}

export function createLifecycleExportPreview(
  map: MapLibreMap,
  references: LifecycleExportReferences,
  onRestoreFailure: () => void,
): PreviewPngExporter {
  const exportPreview: PreviewPngExporter = async (exportOptions) => {
    const printFrame = references.container.current?.parentElement?.querySelector<HTMLElement>('.print-frame');
    if (!printFrame) throw new Error('The print frame is not ready to export.');
    const attribution = references.container.current
      ?.querySelector<HTMLElement>('.maplibregl-ctrl-attrib-inner')
      ?.textContent ?? '';
    const capture = (isAttributionIncluded: boolean) => {
      const referenceLongitude = map.getCenter().lng;
      return capturePrintFramePng(
        map.getCanvas(),
        printFrame,
        attribution,
        {
          projectToCanvas: (coordinate) => map.project([coordinate[0], coordinate[1]]),
          isAttributionIncluded,
          referenceLongitude,
        },
      );
    };
    if (exportOptions?.content !== 'basemap') return capture(true);
    return captureBasemapOnly(
      references.contentAdapter.current,
      () => capture(false),
      (signal) => waitForMapRender(map, signal),
      { onRestoreFailure, signal: exportOptions.signal },
    );
  };
  exportPreview.createPrintTileRenderer = createNativePrintTileRenderer(map, {
    resolvePrintFrame: () => references.container.current?.parentElement?.querySelector<HTMLElement>('.print-frame'),
    resolveLayers: () => references.contentState.current.layers,
    resolveAssets: () => references.contentState.current.assets ?? {},
    isSourceReady: () => !references.mapFailed.current
      && references.contentReady.current
      && references.map.current === map
      && references.availableExporter.current === exportPreview,
  });
  return exportPreview;
}
