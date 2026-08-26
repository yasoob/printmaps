import type { Dispatch, SetStateAction } from 'react';
import { AttributionControl, NavigationControl, type Map as MapLibreMap } from 'maplibre-gl';
import type { PreviewPngExporter } from '../export/previewPng';
import { createMapLibreContentAdapter, type MapContentAdapter, type MapContentState } from './MapContentAdapter';
import type { CameraSettings } from '../domain/project';
import { createInteractiveMap } from './MapCanvasFactory';
import type { CameraViewportChangeMode } from './MapCameraViewport';
import { createLifecycleExportPreview, type LifecycleExportReferences } from './MapLifecycleExport';

export type MapError = {
  kind: 'content' | 'renderer' | 'style';
  message: string;
};

export type ContentError = MapError & {
  source: 'sync' | 'hit-test';
};

const MAP_STARTUP_TIMEOUT_MS = 12_000;

type MapLifecycleState = {
  isDisposed: boolean;
  isStyleLoaded: boolean;
  startupTimeout: number | null;
};

function clearStartupTimeout(state: MapLifecycleState): void {
  if (state.startupTimeout === null) return;
  window.clearTimeout(state.startupTimeout);
  state.startupTimeout = null;
}

type MutableReference<T> = { current: T };

type LifecycleReferences = LifecycleExportReferences & {
  backgroundClick: MutableReference<() => void>;
  cameraViewportChange: MutableReference<((center: readonly [number, number], zoom: number, mode: CameraViewportChangeMode) => void) | undefined>;
  cameraViewportChangeMode: MutableReference<CameraViewportChangeMode>;
  container: MutableReference<HTMLDivElement | null>;
  contentAdapter: MutableReference<MapContentAdapter | null>;
  contentReady: MutableReference<boolean>;
  contentState: MutableReference<MapContentState>;
  contentSyncDeferred: MutableReference<boolean>;
  exporterChange: MutableReference<((exporter: PreviewPngExporter | null) => void) | undefined>;
  ignoreNextMapClick: MutableReference<boolean>;
  layerSelect: MutableReference<(id: string) => void>;
  mapClick: MutableReference<((coordinate: [number, number]) => void) | undefined>;
  map: MutableReference<MapLibreMap | null>; mapFailed: MutableReference<boolean>;
  synchronizeFeatureVisibility: MutableReference<(map: MapLibreMap) => boolean>; synchronizeMapLanguage: MutableReference<(map: MapLibreMap) => boolean>; synchronizeTextScale: MutableReference<(map: MapLibreMap) => boolean>;
};

export type MapLifecycleOptions = {
  handleContentSyncResult: (result: ReturnType<MapContentAdapter['sync']> | undefined) => void;
  initialCamera: CameraSettings;
  references: LifecycleReferences;
  setContentError: Dispatch<SetStateAction<ContentError | null>>;
  setMapError: Dispatch<SetStateAction<MapError | null>>;
  styleUrl: string;
};


function createAttributionController(container: HTMLDivElement) {
  let isInitialized = false;
  let resizeFrame: number | null = null;
  const viewportQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 760px)')
    : null;
  const sync = (isMobile: boolean) => {
    const attribution = container.querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib');
    if (!attribution) return;
    if (isMobile) {
      attribution.removeAttribute('open');
      attribution.classList.remove('maplibregl-compact-show');
    } else {
      attribution.setAttribute('open', '');
      attribution.classList.add('maplibregl-compact-show');
    }
  };
  const handleViewportChange = (event: MediaQueryListEvent) => {
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      sync(event.matches);
    });
  };
  const handleDrag = () => {
    if (viewportQuery?.matches) sync(true);
  };
  return {
    destroy: () => {
      viewportQuery?.removeEventListener('change', handleViewportChange);
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    },
    handleDrag,
    initialize: () => {
      if (isInitialized) return;
      sync(viewportQuery?.matches ?? false);
      isInitialized = true;
    },
    listen: () => viewportQuery?.addEventListener('change', handleViewportChange),
  };
}

function createMapEventHandlers(
  map: MapLibreMap,
  state: MapLifecycleState,
  options: MapLifecycleOptions,
  initializeAttribution: () => void,
) {
  const { references, handleContentSyncResult, setContentError, setMapError } = options;
  const exportPreview = createLifecycleExportPreview(map, references, () => {
    references.mapFailed.current = true;
    references.contentReady.current = false;
    references.container.current?.removeAttribute('data-map-ready');
    references.availableExporter.current = null;
    references.exporterChange.current?.(null);
    setMapError((error) => error ?? {
      kind: 'renderer',
      message: 'The map renderer could not restore content after export. Reload the page and retry.',
    });
  });
  const handleLoad = () => {
    if (state.isDisposed || state.isStyleLoaded) return;
    state.isStyleLoaded = true;
    const container = references.container.current;
    if (!container) return;
    const isStyleSynchronized = references.synchronizeMapLanguage.current(map) && references.synchronizeTextScale.current(map) && references.synchronizeFeatureVisibility.current(map);
    if (!isStyleSynchronized) return;
    references.contentAdapter.current = createMapLibreContentAdapter(map, container);
    handleContentSyncResult(references.contentAdapter.current.sync(references.contentState.current));
    map.triggerRepaint();
  };
  const handleIdle = () => {
    if (state.isDisposed || references.mapFailed.current) return;
    initializeAttribution();
    if (references.contentSyncDeferred.current && references.contentAdapter.current) {
      handleContentSyncResult(references.contentAdapter.current.sync(references.contentState.current));
    }
    if (!references.contentReady.current) return;
    clearStartupTimeout(state);
    if (references.availableExporter.current !== exportPreview) {
      references.availableExporter.current = exportPreview;
      references.exporterChange.current?.(exportPreview);
    }
    references.container.current?.setAttribute('data-map-ready', 'true');
  };
  const handleMoveEnd = () => {
    if (state.isDisposed) return;
    const center = map.getCenter();
    const longitude = Math.abs(center.lng) <= 180
      ? center.lng
      : ((center.lng + 180) % 360 + 360) % 360 - 180;
    const mode = references.cameraViewportChangeMode.current;
    references.cameraViewportChangeMode.current = 'history';
    references.cameraViewportChange.current?.([longitude, center.lat], map.getZoom(), mode);
  };
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
  const handleError = () => {
    if (state.isDisposed) return;
    clearStartupTimeout(state);
    references.mapFailed.current = true;
    references.container.current?.removeAttribute('data-map-ready');
    if (references.availableExporter.current === exportPreview) {
      references.availableExporter.current = null;
      references.exporterChange.current?.(null);
    }
    if (state.isStyleLoaded) {
      setMapError((error) => error ?? {
        kind: 'renderer',
        message: 'The map renderer encountered an error. Reload the page and retry.',
      });
    } else {
      setMapError({
        kind: 'style',
        message: 'The map style could not be loaded. Check your connection and retry.',
      });
    }
  };
  const handleLoadTimeout = () => {
    state.startupTimeout = null;
    if (state.isDisposed || references.mapFailed.current) return;
    references.mapFailed.current = true;
    references.container.current?.removeAttribute('data-map-ready');
    setMapError({
      kind: 'style',
      message: 'The map style timed out while loading. Check your connection and retry.',
    });
  };
  return {
    dispose: () => { state.isDisposed = true; clearStartupTimeout(state); },
    exportPreview,
    handleClick,
    handleError,
    handleIdle,
    handleLoad,
    handleLoadTimeout,
    handleMoveEnd,
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
  retryCleanup(() => map.off('idle', handlers.handleIdle));
  retryCleanup(() => map.off('drag', attribution.handleDrag));
  retryCleanup(() => map.off('error', handlers.handleError));
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
  const state: MapLifecycleState = { isDisposed: false, isStyleLoaded: false, startupTimeout: null };
  options.references.mapFailed.current = false;
  const handlers = createMapEventHandlers(map, state, options, attribution.initialize);
  map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right'); map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
  attribution.listen();
  state.startupTimeout = window.setTimeout(handlers.handleLoadTimeout, MAP_STARTUP_TIMEOUT_MS);
  map.once('load', handlers.handleLoad);
  if (map.loaded()) queueMicrotask(handlers.handleLoad);
  map.on('idle', handlers.handleIdle);
  map.on('drag', attribution.handleDrag);
  map.on('error', handlers.handleError);
  map.on('moveend', handlers.handleMoveEnd);
  map.on('click', handlers.handleClick);
  options.references.map.current = map;
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
  return map ? installMapLifecycle(map, options) : undefined;
}
