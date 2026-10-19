import type { Map as MapLibreMap } from 'maplibre-gl';
import { capturePrintFramePng, type PreviewPngExporter } from '../export/previewPng';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';
import type { ContentLayer } from '../domain/project';
import type { MapContentAdapter } from './MapContentAdapter';
import { captureBasemapOnly } from './MapExportCapture';
import { createNativePrintTileRenderer } from './NativePrintTileRenderer';
import { waitForMapExportReady } from './MapExportReadiness';
import { captureMapRenderSnapshot } from './MapRenderSnapshot';

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
  resolveExportStyle: (map: MapLibreMap, content: 'basemap' | 'composite') => ReturnType<MapLibreMap['getStyle']>;
  setBasemapExportVisibility: (map: MapLibreMap, override: boolean | null) => boolean;
};

export function createLifecycleExportPreview(
  map: MapLibreMap,
  references: LifecycleExportReferences,
  onRestoreFailure: () => void,
): PreviewPngExporter {
  const isCurrent = () => references.map.current === map && !references.mapFailed.current;
  const isSourceReady = () => isCurrent()
    && references.contentReady.current
    && references.availableExporter.current === exportPreview;
  const exportPreview: PreviewPngExporter = async (exportOptions) => {
    if (!isSourceReady()) {
      throw new Error('The map is not ready to export. Wait for recovery or retry the map.');
    }
    const printFrame = references.container.current?.parentElement?.querySelector<HTMLElement>('.print-frame');
    if (!printFrame) throw new Error('The print frame is not ready to export.');
    const capture = () => capturePrintFramePng(map.getCanvas(), printFrame, {
      projectToCanvas: (coordinate) => map.project([coordinate[0], coordinate[1]]),
      referenceLongitude: map.getCenter().lng,
    });
    if (exportOptions?.content !== 'basemap') return capture();
    return captureBasemapOnly(
      references.contentAdapter.current,
      () => capture(),
      (signal) => waitForMapExportReady(map, { isCurrent, isReady: isSourceReady, signal }),
      {
        onRestoreFailure: () => {
          if (references.map.current === map) onRestoreFailure();
        },
        setBasemapVisibility: (override) => references.map.current === map
          && references.setBasemapExportVisibility(map, override),
        signal: exportOptions.signal,
      },
    );
  };
  exportPreview.createPrintTileRenderer = createNativePrintTileRenderer(map, {
    resolvePrintFrame: () => references.container.current?.parentElement?.querySelector<HTMLElement>('.print-frame'),
    resolveStyle: (content) => references.resolveExportStyle(map, content),
    resolveLayers: () => references.contentState.current.layers,
    resolveAssets: () => references.contentState.current.assets ?? {},
    isSourceReady,
  });
  exportPreview.captureRenderSnapshot = (options) => captureMapRenderSnapshot(map, {
    isSourceReady,
    resolveStyle: (content) => references.resolveExportStyle(map, content),
    resolvePrintFrame: () => references.container.current?.parentElement?.querySelector<HTMLElement>('.print-frame'),
    resolveContent: () => references.contentState.current,
  }, options);
  exportPreview.captureVectorBasemap = async (options = {}) => {
    const snapshot = exportPreview.captureRenderSnapshot!({ content: 'basemap' });
    const content = references.contentState.current;
    const controller = new AbortController();
    const cancel = () => controller.abort(options.signal?.reason);
    const invalidate = () => controller.abort(new Error('The map changed during vector export. Retry the export.'));
    const events = ['movestart', 'styledata', 'resize', 'remove', 'webglcontextlost'] as const;
    for (const event of events) map.on(event, invalidate);
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) cancel();
    try {
      const { captureVectorBasemap } = await import('../export/vector/capture');
      const capture = await captureVectorBasemap(snapshot, { signal: controller.signal });
      if (!isSourceReady() || references.contentState.current !== content) invalidate();
      if (controller.signal.aborted) throw controller.signal.reason;
      return capture;
    } finally {
      for (const event of events) map.off(event, invalidate);
      options.signal?.removeEventListener('abort', cancel);
    }
  };
  return exportPreview;
}
