import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { CameraSettings, ContentLayer } from '../domain/project';
import type { PreviewPngExporter } from '../export/previewPng';
import type { MapContentAdapter, MapContentState } from './MapContentAdapter';
import {
  startMapLifecycle,
  type ContentError,
  type MapError,
} from './MapCanvasLifecycle';

type MapCanvasControllerOptions = {
  camera: CameraSettings;
  fitRequest: number;
  layers: ContentLayer[];
  onBackgroundClick: () => void;
  onExporterChange?: (exporter: PreviewPngExporter | null) => void;
  onLayerSelect: (id: string) => void;
  onMapClick?: (coordinate: [number, number]) => void;
  previewedId: string | null;
  selectedId: string | null;
  contentRevision?: object;
};

const PAGE_BOUNDS: [[number, number], [number, number]] = [[16.28, 48.14], [16.48, 48.26]];

export function useMapCanvasController({
  camera,
  fitRequest,
  layers,
  onBackgroundClick,
  onExporterChange,
  onLayerSelect,
  onMapClick,
  previewedId,
  selectedId,
  contentRevision,
}: MapCanvasControllerOptions) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const contentAdapter = useRef<MapContentAdapter | null>(null);
  const contentState = useRef<MapContentState>({ layers, selectedId, previewedId, contentRevision });
  const contentSyncDeferred = useRef(false);
  const contentReady = useRef(false);
  const layerSelect = useRef(onLayerSelect);
  const backgroundClick = useRef(onBackgroundClick);
  const mapClick = useRef(onMapClick);
  const exporterChange = useRef(onExporterChange);
  const availableExporter = useRef<PreviewPngExporter | null>(null);
  const handledFitRequest = useRef(0);
  const [mapError, setMapError] = useState<MapError | null>(null);
  const [contentError, setContentError] = useState<ContentError | null>(null);

  const invalidateExporter = useCallback(() => {
    if (!availableExporter.current) return;
    availableExporter.current = null;
    exporterChange.current?.(null);
  }, []);

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
    contentState.current = { layers, selectedId, previewedId, contentRevision };
    handleContentSyncResult(contentAdapter.current?.sync(contentState.current));
  }, [handleContentSyncResult, layers, previewedId, selectedId, contentRevision]);

  useEffect(() => startMapLifecycle({
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
      map,
    },
    setContentError,
    setMapError,
  }), [handleContentSyncResult]);

  useEffect(() => {
    if (!map.current) return;
    map.current.jumpTo({ bearing: camera.bearing, pitch: camera.pitch });
    container.current?.setAttribute('data-map-bearing', String(camera.bearing));
    container.current?.setAttribute('data-map-pitch', String(camera.pitch));
  }, [camera.bearing, camera.pitch]);

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
