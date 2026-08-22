import type { Dispatch, SetStateAction } from 'react';
import { AttributionControl, Map, NavigationControl, type Map as MapLibreMap } from 'maplibre-gl';
import { capturePrintFramePng, type PreviewPngExporter } from '../export/previewPng';
import {
  createMapLibreContentAdapter,
  type MapContentAdapter,
  type MapContentState,
} from './MapContentAdapter';

export type MapError = {
  kind: 'content' | 'renderer' | 'style';
  message: string;
};

export type ContentError = MapError & {
  source: 'sync' | 'hit-test';
};

type MutableReference<T> = { current: T };

type LifecycleReferences = {
  availableExporter: MutableReference<PreviewPngExporter | null>;
  backgroundClick: MutableReference<() => void>;
  container: MutableReference<HTMLDivElement | null>;
  contentAdapter: MutableReference<MapContentAdapter | null>;
  contentReady: MutableReference<boolean>;
  contentState: MutableReference<MapContentState>;
  contentSyncDeferred: MutableReference<boolean>;
  exporterChange: MutableReference<((exporter: PreviewPngExporter | null) => void) | undefined>;
  layerSelect: MutableReference<(id: string) => void>;
  map: MutableReference<MapLibreMap | null>;
};

export type MapLifecycleOptions = {
  handleContentSyncResult: (result: ReturnType<MapContentAdapter['sync']> | undefined) => void;
  references: LifecycleReferences;
  setContentError: Dispatch<SetStateAction<ContentError | null>>;
  setMapError: Dispatch<SetStateAction<MapError | null>>;
};

type LifecycleState = {
  isMapFailed: boolean;
  isStyleLoaded: boolean;
};

const OPEN_STYLE = '/styles/liberty.json';

function createMap(container: HTMLDivElement, setMapError: MapLifecycleOptions['setMapError']) {
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2')) {
    queueMicrotask(() => setMapError({
      kind: 'renderer',
      message: 'WebGL 2 is unavailable in this browser. Your project can still be edited.',
    }));
    return null;
  }

  try {
    return new Map({
      container,
      style: OPEN_STYLE,
      center: [16.3725, 48.2084],
      zoom: 11.2,
      attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
  } catch {
    queueMicrotask(() => setMapError({
      kind: 'renderer',
      message: 'The map renderer is unavailable in this browser. Your project can still be edited.',
    }));
    return null;
  }
}

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
  state: LifecycleState,
  options: MapLifecycleOptions,
  initializeAttribution: () => void,
) {
  const { references, handleContentSyncResult, setContentError, setMapError } = options;
  const exportPreview: PreviewPngExporter = () => {
    const printFrame = references.container.current?.parentElement?.querySelector<HTMLElement>('.print-frame');
    if (!printFrame) return Promise.reject(new Error('The print frame is not ready to export.'));
    const attribution = references.container.current
      ?.querySelector<HTMLElement>('.maplibregl-ctrl-attrib-inner')
      ?.textContent ?? '';
    return capturePrintFramePng(map.getCanvas(), printFrame, attribution);
  };
  const handleLoad = () => {
    state.isStyleLoaded = true;
    const container = references.container.current;
    if (!container) return;
    references.contentAdapter.current = createMapLibreContentAdapter(map, container);
    handleContentSyncResult(references.contentAdapter.current.sync(references.contentState.current));
  };
  const handleIdle = () => {
    if (state.isMapFailed) return;
    initializeAttribution();
    if (references.contentSyncDeferred.current && references.contentAdapter.current) {
      handleContentSyncResult(references.contentAdapter.current.sync(references.contentState.current));
    }
    if (!references.contentReady.current) return;
    if (references.availableExporter.current !== exportPreview) {
      references.availableExporter.current = exportPreview;
      references.exporterChange.current?.(exportPreview);
    }
    references.container.current?.setAttribute('data-map-ready', 'true');
  };
  const handleClick = (event: { point: Parameters<MapContentAdapter['hitTest']>[0] }) => {
    const adapter = references.contentAdapter.current;
    if (!adapter) {
      references.backgroundClick.current();
      return;
    }
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
    if (hitLayerId) references.layerSelect.current(hitLayerId);
    else references.backgroundClick.current();
  };
  const handleError = () => {
    state.isMapFailed = true;
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
  return { exportPreview, handleClick, handleError, handleIdle, handleLoad };
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
  attribution.destroy();
  retryCleanup(() => map.off('load', handlers.handleLoad));
  retryCleanup(() => map.off('idle', handlers.handleIdle));
  retryCleanup(() => map.off('drag', attribution.handleDrag));
  retryCleanup(() => map.off('error', handlers.handleError));
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
  const state: LifecycleState = { isMapFailed: false, isStyleLoaded: false };
  const handlers = createMapEventHandlers(map, state, options, attribution.initialize);
  map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
  map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
  attribution.listen();
  map.once('load', handlers.handleLoad);
  map.on('idle', handlers.handleIdle);
  map.on('drag', attribution.handleDrag);
  map.on('error', handlers.handleError);
  map.on('click', handlers.handleClick);
  options.references.map.current = map;
  return () => cleanupMap(map, handlers, attribution, options.references);
}

export function startMapLifecycle(options: MapLifecycleOptions) {
  const container = options.references.container.current;
  if (!container || options.references.map.current) return;
  const map = createMap(container, options.setMapError);
  return map ? installMapLifecycle(map, options) : undefined;
}
