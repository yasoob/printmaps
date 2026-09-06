import type { Dispatch, SetStateAction } from 'react';
import { AttributionControl, type Map as MapLibreMap } from 'maplibre-gl';
import type { PreviewPngExporter } from '../export/previewPng';
import { createMapLibreContentAdapter, type MapContentAdapter, type MapContentState } from './MapContentAdapter';
import type { CameraSettings } from '../domain/project';
import { createInteractiveMap } from './MapCanvasFactory';
import { armLifecycleDeadline, clearLifecycleDeadline, MAP_READY_TIMEOUT_MS, MAP_STYLE_TIMEOUT_MS, type MapLifecycleDeadlineState } from './MapLifecycleDeadline';
import { publishCameraViewport, readMapCameraViewport, writeCameraViewportAttributes, type CameraViewportPublication } from './MapCameraViewport';
import { createLifecycleExportPreview, type LifecycleExportReferences } from './MapLifecycleExport';
import { createPageNavigationControl } from './MapPageNavigationControl';
import { setMapInteractionLock } from './MapInteractionLock';
import { createAttributionController } from './MapAttributionController';
import { createMapResourceRecovery, mapFailureMessage, type MapFailureEvent } from './MapResourceRecovery';

export type MapError = {
  kind: 'content' | 'renderer' | 'style' | 'resource';
  message: string;
  retrying?: boolean;
};

export type ContentError = MapError & {
  source: 'sync' | 'hit-test';
};

type MutableReference<T> = { current: T };

type LifecycleReferences = LifecycleExportReferences & CameraViewportPublication & {
  backgroundClick: MutableReference<() => void>;
  container: MutableReference<HTMLDivElement | null>;
  contentAdapter: MutableReference<MapContentAdapter | null>;
  contentReady: MutableReference<boolean>;
  contentState: MutableReference<MapContentState>;
  contentSyncDeferred: MutableReference<boolean>;
  exporterChange: MutableReference<((exporter: PreviewPngExporter | null) => void) | undefined>;
  fitPage: MutableReference<() => void>;
  ignoreNextMapClick: MutableReference<boolean>;
  layerSelect: MutableReference<(id: string) => void>;
  mapClick: MutableReference<((coordinate: [number, number]) => void) | undefined>;
  map: MutableReference<MapLibreMap | null>; mapFailed: MutableReference<boolean>;
  resolveExportStyle: (map: MapLibreMap, content: 'basemap' | 'composite') => ReturnType<MapLibreMap['getStyle']>;
  setBasemapExportVisibility: (map: MapLibreMap, override: boolean | null) => boolean;
  synchronizeFeatureVisibility: MutableReference<(map: MapLibreMap) => boolean>; synchronizeMapLanguage: MutableReference<(map: MapLibreMap) => boolean>; synchronizeStyleCustomization: MutableReference<(map: MapLibreMap) => boolean>; synchronizeTextScale: MutableReference<(map: MapLibreMap) => boolean>;
};

export type MapLifecycleOptions = {
  handleContentSyncResult: (result: ReturnType<MapContentAdapter['sync']> | undefined) => void;
  initialCamera: CameraSettings;
  getCanonicalCamera?: () => CameraSettings;
  onCameraError?: (message: string | null) => void;
  onMapCreated?: () => void;
  references: LifecycleReferences;
  setContentError: Dispatch<SetStateAction<ContentError | null>>;
  setMapError: Dispatch<SetStateAction<MapError | null>>;
  styleUrl: string;
};

function createCameraMoveEnd(map: MapLibreMap, state: MapLifecycleDeadlineState, options: MapLifecycleOptions) {
  const { references } = options;
  let isRestoringCamera = false;
  return () => {
    if (isRestoringCamera || state.isDisposed || !references.cameraViewportChange.current) return;
    const result = publishCameraViewport(readMapCameraViewport(map), references);
    options.onCameraError?.(result.ok ? null : result.error);
    if (result.ok) return;
    const camera = options.getCanonicalCamera?.() ?? options.initialCamera;
    isRestoringCamera = true;
    try {
      map.jumpTo({ center: camera.center, zoom: camera.zoom, bearing: camera.bearing, pitch: camera.pitch });
      writeCameraViewportAttributes(references.container.current, camera);
    } finally {
      isRestoringCamera = false;
    }
  };
}

function createMapEventHandlers(
  map: MapLibreMap,
  state: MapLifecycleDeadlineState,
  options: MapLifecycleOptions,
  initializeAttribution: () => void,
) {
  const { references, handleContentSyncResult, setContentError, setMapError } = options;
  const invalidate = () => {
    references.container.current?.removeAttribute('data-map-ready');
    references.availableExporter.current = null;
    references.exporterChange.current?.(null);
  };
  const recovery = createMapResourceRecovery(map, (error) => {
    if (state.isDisposed || references.mapFailed.current) return;
    if (error) setMapError(error);
    else setMapError((current) => current?.kind === 'resource' ? null : current);
  });
  const exportPreview = createLifecycleExportPreview(map, references, () => {
    references.mapFailed.current = true;
    references.contentReady.current = false;
    references.container.current?.removeAttribute('data-map-ready');
    references.availableExporter.current = null;
    references.exporterChange.current?.(null);
    recovery.dispose();
    setMapError({
      kind: 'renderer',
      message: 'The map renderer could not restore content after export. Retry the map without reloading your project.',
    });
  });
  const handleLoadTimeout = () => {
    state.startupTimeout = null;
    if (state.isDisposed || references.mapFailed.current) return;
    references.mapFailed.current = true;
    references.container.current?.removeAttribute('data-map-ready');
    setMapError(state.isStyleLoaded
      ? { kind: 'renderer', message: 'The map preview timed out while preparing. Retry the map without reloading your project.' }
      : { kind: 'style', message: 'The map style timed out while loading. Check your connection and retry.' });
  };
  const handleStyleLoad = () => {
    if (state.isDisposed || state.isStyleLoaded) return;
    state.isStyleLoaded = true; armLifecycleDeadline(state, handleLoadTimeout, MAP_READY_TIMEOUT_MS);
  };
  const handleLoad = () => {
    if (state.isDisposed || state.isMapLoaded) return;
    if (!state.isStyleLoaded) handleStyleLoad();
    state.isMapLoaded = true;
    const container = references.container.current; if (!container) return;
    const isStyleSynchronized = references.synchronizeStyleCustomization.current(map) && references.synchronizeMapLanguage.current(map) && references.synchronizeTextScale.current(map) && references.synchronizeFeatureVisibility.current(map);
    if (!isStyleSynchronized) return;
    references.contentAdapter.current = createMapLibreContentAdapter(map, container);
    handleContentSyncResult(references.contentAdapter.current.sync(references.contentState.current));
    map.triggerRepaint();
  };
  const handleIdle = () => {
    if (state.isDisposed || references.mapFailed.current || !map.loaded() || !recovery.canPublishReady()) return;
    initializeAttribution();
    if (references.contentSyncDeferred.current && references.contentAdapter.current) {
      handleContentSyncResult(references.contentAdapter.current.sync(references.contentState.current));
    }
    if (!references.contentReady.current || !map.loaded()) return;
    clearLifecycleDeadline(state);
    if (references.availableExporter.current !== exportPreview) {
      references.availableExporter.current = exportPreview;
      references.exporterChange.current?.(exportPreview);
    }
    references.container.current?.setAttribute('data-map-ready', 'true');
    setMapError((error) => error?.retrying ? null : error);
  };
  const handleMoveEnd = createCameraMoveEnd(map, state, options);
  const handleClick = (event: { point: Parameters<MapContentAdapter['hitTest']>[0]; lngLat: { lng: number; lat: number } }) => {
    if (state.isDisposed) return;
    if (references.ignoreNextMapClick.current) {
      references.ignoreNextMapClick.current = false;
      return;
    }
    if (references.mapClick.current) return references.mapClick.current([event.lngLat.lng, event.lngLat.lat]);
    const adapter = references.contentAdapter.current;
    if (!adapter) return references.backgroundClick.current();
    const hitLayerId = adapter.hitTest(event.point);
    if (hitLayerId === undefined) {
      setContentError((error) => error?.source === 'sync' ? error : {
        kind: 'content',
        source: 'hit-test',
        message: 'The map content could not be rendered. Review the layer data and retry.',
      });
      return;
    }
    setContentError((error) => error?.source === 'hit-test' ? null : error);
    if (hitLayerId) references.layerSelect.current(hitLayerId); else references.backgroundClick.current();
  };
  const handleError = (event?: MapFailureEvent) => {
    if (state.isDisposed || references.mapFailed.current) return;
    clearLifecycleDeadline(state);
    invalidate();
    if (recovery.handleError(event)) return;
    recovery.dispose();
    references.mapFailed.current = true;
    setMapError(mapFailureMessage(event, state.isStyleLoaded));
  };
  return {
    dispose: () => { state.isDisposed = true; clearLifecycleDeadline(state); recovery.dispose(); },
    exportPreview,
    handleClick,
    handleError,
    handleContextLost: () => handleError(),
    handleDataLoading: () => { if (!state.isDisposed) invalidate(); },
    handleIdle,
    handleLoad,
    handleLoadTimeout,
    handleMoveEnd,
    handleStyleLoad,
  };
}

function retryCleanup(action: () => void) {
  try {
    action();
  } catch {
    try {
      action();
    } catch {
      // Cleanup retries are bounded and contained.
    }
  }
}

function cleanupMap(
  map: MapLibreMap,
  handlers: ReturnType<typeof createMapEventHandlers>,
  attribution: ReturnType<typeof createAttributionController>,
  references: LifecycleReferences,
) {
  if (references.availableExporter.current === handlers.exportPreview) {
    references.availableExporter.current = null;
    references.exporterChange.current?.(null);
  }
  handlers.dispose();
  attribution.destroy();
  retryCleanup(() => map.off('load', handlers.handleLoad));
  retryCleanup(() => map.off('style.load', handlers.handleStyleLoad));
  retryCleanup(() => map.off('idle', handlers.handleIdle));
  retryCleanup(() => map.off('drag', attribution.handleDrag));
  retryCleanup(() => map.off('error', handlers.handleError));
  retryCleanup(() => map.off('webglcontextlost', handlers.handleContextLost));
  retryCleanup(() => map.off('dataloading', handlers.handleDataLoading));
  retryCleanup(() => map.off('moveend', handlers.handleMoveEnd));
  retryCleanup(() => map.off('click', handlers.handleClick));
  const adapter = references.contentAdapter.current;
  references.contentAdapter.current = null;
  if (adapter) retryCleanup(() => adapter.destroy());
  if (references.map.current === map) {
    references.map.current = null;
    retryCleanup(() => map.remove());
  }
}

function installMapLifecycle(map: MapLibreMap, options: MapLifecycleOptions) {
  const container = options.references.container.current!;
  const attribution = createAttributionController(container);
  const state: MapLifecycleDeadlineState = { isDisposed: false, isMapLoaded: false, isStyleLoaded: false, startupTimeout: null };
  options.references.mapFailed.current = false;
  options.references.map.current = map;
  writeCameraViewportAttributes(container, readMapCameraViewport(map));
  const handlers = createMapEventHandlers(map, state, options, attribution.initialize);
  map.addControl(
    createPageNavigationControl(() => options.references.fitPage.current()),
    'bottom-right',
  );
  map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
  setMapInteractionLock(map, options.initialCamera.locked);
  attribution.listen();
  armLifecycleDeadline(state, handlers.handleLoadTimeout, MAP_STYLE_TIMEOUT_MS);
  map.once('style.load', handlers.handleStyleLoad);
  map.once('load', handlers.handleLoad);
  if (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) queueMicrotask(handlers.handleStyleLoad);
  if (map.loaded()) queueMicrotask(handlers.handleLoad);
  map.on('idle', handlers.handleIdle);
  map.on('drag', attribution.handleDrag);
  map.on('error', handlers.handleError);
  map.on('webglcontextlost', handlers.handleContextLost);
  map.on('dataloading', handlers.handleDataLoading);
  map.on('moveend', handlers.handleMoveEnd);
  map.on('click', handlers.handleClick);
  return () => cleanupMap(map, handlers, attribution, options.references);
}

export function startMapLifecycle(options: MapLifecycleOptions) {
  const container = options.references.container.current;
  if (!container || options.references.map.current) return;
  const map = createInteractiveMap({
    camera: options.initialCamera,
    container,
    onError: (message) => options.setMapError({ kind: 'renderer', message }),
    styleUrl: options.styleUrl,
  });
  if (!map) return;
  const cleanup = installMapLifecycle(map, options);
  options.onMapCreated?.();
  return cleanup;
}
