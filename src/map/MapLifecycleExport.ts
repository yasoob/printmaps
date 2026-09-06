import type { Map as MapLibreMap } from 'maplibre-gl';
import { capturePrintFramePng, type PreviewPngExporter } from '../export/previewPng';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';
import type { ContentLayer } from '../domain/project';
import type { MapContentAdapter } from './MapContentAdapter';
import { captureBasemapOnly } from './MapExportCapture';
import { createNativePrintTileRenderer } from './NativePrintTileRenderer';
import { waitForMapExportReady } from './MapExportReadiness';

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
  return exportPreview;
}
