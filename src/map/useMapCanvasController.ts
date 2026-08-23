import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';
import type { CameraSettings, ContentLayer, MapFeatureVisibility, MapLanguage, MapStylePreset } from '../domain/project';
import type { PreviewPngExporter } from '../export/previewPng';
import type { MapContentAdapter, MapContentState } from './MapContentAdapter';
import {
  startMapLifecycle,
  type ContentError,
  type MapError,
} from './MapCanvasLifecycle';
import { mapStyleUrl } from './mapStyles';
import { useMapFeatureVisibility } from './useMapFeatureVisibility';
import { useMapLanguage } from './useMapLanguage';
import { useMapTextScale } from './useMapTextScale';

type MapCanvasControllerOptions = {
  camera: CameraSettings;
  stylePreset: MapStylePreset;
  language: MapLanguage;
  textScalePercent: number;
  featureVisibility: MapFeatureVisibility;
  fitRequest: number;
  layers: ContentLayer[];
  assets: Record<string, CustomMarkerAsset>;
  onBackgroundClick: () => void;
  onExporterChange?: (exporter: PreviewPngExporter | null) => void;
  onLayerSelect: (id: string) => void;
  onMapClick?: (coordinate: [number, number]) => void;
  previewedId: string | null;
  selectedId: string | null;
  contentRevision?: object;
};

const PAGE_BOUNDS: [[number, number], [number, number]] = [[16.28, 48.14], [16.48, 48.26]];

function clearMapStateAttributes(container: HTMLDivElement | null) {
  container?.removeAttribute('data-map-ready');
  container?.removeAttribute('data-map-bearing');
  container?.removeAttribute('data-map-pitch');
}

export function useMapCanvasController({
  camera,
  stylePreset,
  language,
  textScalePercent,
  featureVisibility,
  fitRequest,
  layers,
  assets,
  onBackgroundClick,
  onExporterChange,
  onLayerSelect,
  onMapClick,
  previewedId,
  selectedId,
  contentRevision,
}: MapCanvasControllerOptions) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null), contentAdapter = useRef<MapContentAdapter | null>(null);
  const contentState = useRef<MapContentState>({ layers, assets, selectedId, previewedId, contentRevision });
  const contentSyncDeferred = useRef(false), contentReady = useRef(false), mapFailed = useRef(false);
  const layerSelect = useRef(onLayerSelect), backgroundClick = useRef(onBackgroundClick), mapClick = useRef(onMapClick);
  const exporterChange = useRef(onExporterChange);
  const availableExporter = useRef<PreviewPngExporter | null>(null);
  const handledFitRequest = useRef(0);
  const [mapError, setMapError] = useState<MapError | null>(null), [contentError, setContentError] = useState<ContentError | null>(null);

  const invalidateExporter = useCallback(() => {
    if (!availableExporter.current) return;
    availableExporter.current = null;
    exporterChange.current?.(null);
  }, []);
  const { resetTextScale, synchronizeTextScale } = useMapTextScale({ containerRef: container, contentReadyRef: contentReady, invalidateExporter, mapFailedRef: mapFailed, mapRef: map, setMapError, textScalePercent });
  const { resetFeatureVisibility, synchronizeFeatureVisibility } = useMapFeatureVisibility({ containerRef: container, contentReadyRef: contentReady, featureVisibility, invalidateExporter, mapFailedRef: mapFailed, mapRef: map, setMapError });
  const { resetMapLanguage, synchronizeMapLanguage } = useMapLanguage({ containerRef: container, contentReadyRef: contentReady, invalidateExporter, language, mapFailedRef: mapFailed, mapRef: map, setMapError });

  const handleContentSyncResult = useCallback((result: ReturnType<MapContentAdapter['sync']> | undefined) => {
    contentSyncDeferred.current = result === 'deferred';
    if (result === 'failed' || result === 'deferred') {
      contentReady.current = false;
      container.current?.removeAttribute('data-map-ready');
      invalidateExporter();
    }
    if (result === 'failed') {
      queueMicrotask(() => setContentError({
        kind: 'content',
        source: 'sync',
        message: 'The map content could not be rendered. Review the layer data and retry.',
      }));
    } else if (result === 'synced') {
      contentReady.current = true;
      queueMicrotask(() => setContentError((error) => error?.source === 'sync' ? null : error));
    }
  }, [invalidateExporter]);

  useLayoutEffect(() => {
    backgroundClick.current = onBackgroundClick;
    layerSelect.current = onLayerSelect;
    mapClick.current = onMapClick;
  }, [onBackgroundClick, onLayerSelect, onMapClick]);

  useEffect(() => {
    exporterChange.current = onExporterChange;
    onExporterChange?.(availableExporter.current);
    return () => onExporterChange?.(null);
  }, [onExporterChange]);

  useEffect(() => {
    contentState.current = { layers, assets, selectedId, previewedId, contentRevision };
    handleContentSyncResult(contentAdapter.current?.sync(contentState.current));
  }, [assets, handleContentSyncResult, layers, previewedId, selectedId, contentRevision]);

  useEffect(() => {
    contentReady.current = false;
    contentSyncDeferred.current = false;
    clearMapStateAttributes(container.current);
    resetFeatureVisibility(); resetMapLanguage(); resetTextScale();
    invalidateExporter();
    queueMicrotask(() => {
      setMapError(null);
      setContentError(null);
    });
    container.current?.setAttribute('data-style-preset', stylePreset);
    return startMapLifecycle({
      handleContentSyncResult,
      references: {
        availableExporter,
        backgroundClick,
        container,
        contentAdapter,
        contentReady,
        contentState,
        contentSyncDeferred,
        exporterChange,
        layerSelect,
        mapClick,
        map, mapFailed,
        synchronizeFeatureVisibility: { current: synchronizeFeatureVisibility },
        synchronizeMapLanguage: { current: synchronizeMapLanguage },
        synchronizeTextScale: { current: synchronizeTextScale },
      },
      setContentError,
      setMapError,
      styleUrl: mapStyleUrl(stylePreset),
    });
  }, [handleContentSyncResult, invalidateExporter, resetFeatureVisibility, resetMapLanguage, resetTextScale, stylePreset, synchronizeFeatureVisibility, synchronizeMapLanguage, synchronizeTextScale]);

  useEffect(() => {
    if (!map.current) return;
    map.current.jumpTo({ bearing: camera.bearing, pitch: camera.pitch });
    container.current?.setAttribute('data-map-bearing', String(camera.bearing));
    container.current?.setAttribute('data-map-pitch', String(camera.pitch));
  }, [camera.bearing, camera.pitch, stylePreset]);

  useEffect(() => {
    if (!(fitRequest > handledFitRequest.current && map.current)) return;
    handledFitRequest.current = fitRequest;
    map.current.fitBounds(PAGE_BOUNDS, {
      bearing: camera.bearing,
      duration: 0,
      padding: 64,
      pitch: camera.pitch,
    });
    container.current?.setAttribute('data-camera-fit-request', String(fitRequest));
  }, [camera.bearing, camera.pitch, fitRequest]);

  return { container, visibleError: mapError ?? contentError };
}
