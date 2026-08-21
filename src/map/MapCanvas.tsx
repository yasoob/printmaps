import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { AttributionControl, Map, NavigationControl, type Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer, PageSettings } from '../domain/project';
import { capturePrintFramePng, type PreviewPngExporter } from '../export/previewPng';
import {
  createMapLibreContentAdapter,
  type MapContentAdapter,
  type MapContentState,
} from './MapContentAdapter';

type MapCanvasProps = {
  layers: ContentLayer[];
  selectedId: string | null;
  previewedId: string | null;
  onLayerSelect: (id: string) => void;
  onBackgroundClick: () => void;
  onExporterChange?: (exporter: PreviewPngExporter | null) => void;
  fitRequest?: number;
  orientation?: 'landscape' | 'portrait';
  page?: PageSettings;
};

type MapError = {
  kind: 'content' | 'renderer' | 'style';
  message: string;
};

type ContentError = MapError & {
  source: 'sync' | 'hit-test';
};

const OPEN_STYLE = '/styles/liberty.json';
const PAGE_BOUNDS: [[number, number], [number, number]] = [[16.28, 48.14], [16.48, 48.26]];

export function MapCanvas({
  layers,
  selectedId,
  previewedId,
  onLayerSelect,
  onBackgroundClick,
  onExporterChange,
  fitRequest = 0,
  orientation = 'landscape',
  page,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const contentAdapterRef = useRef<MapContentAdapter | null>(null);
  const contentStateRef = useRef<MapContentState>({ layers, selectedId, previewedId });
  const contentSyncDeferredRef = useRef(false);
  const contentReadyRef = useRef(false);
  const layerSelectRef = useRef(onLayerSelect);
  const backgroundClickRef = useRef(onBackgroundClick);
  const exporterChangeRef = useRef(onExporterChange);
  const availableExporterRef = useRef<PreviewPngExporter | null>(null);
  const [mapError, setMapError] = useState<MapError | null>(null);
  const [contentError, setContentError] = useState<ContentError | null>(null);

  const invalidateExporter = useCallback(() => {
    if (availableExporterRef.current) {
      availableExporterRef.current = null;
      exporterChangeRef.current?.(null);
    }
  }, []);

  const handleContentSyncResult = useCallback((result: ReturnType<MapContentAdapter['sync']> | undefined) => {
    contentSyncDeferredRef.current = result === 'deferred';
    if (result === 'failed' || result === 'deferred') {
      contentReadyRef.current = false;
      containerRef.current?.removeAttribute('data-map-ready');
      invalidateExporter();
    }
    if (result === 'failed') {
      queueMicrotask(() => setContentError({
        kind: 'content',
        source: 'sync',
        message: 'The map content could not be rendered. Review the layer data and retry.',
      }));
    } else if (result === 'synced') {
      contentReadyRef.current = true;
      queueMicrotask(() => setContentError((error) => error?.source === 'sync' ? null : error));
    }
  }, [invalidateExporter]);

  useEffect(() => {
    backgroundClickRef.current = onBackgroundClick;
    layerSelectRef.current = onLayerSelect;
  }, [onBackgroundClick, onLayerSelect]);

  useEffect(() => {
    exporterChangeRef.current = onExporterChange;
    onExporterChange?.(availableExporterRef.current);
    return () => onExporterChange?.(null);
  }, [onExporterChange]);

  useEffect(() => {
    contentStateRef.current = { layers, selectedId, previewedId };
    const adapter = contentAdapterRef.current;
    handleContentSyncResult(adapter?.sync(contentStateRef.current));
  }, [handleContentSyncResult, layers, previewedId, selectedId]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const probe = document.createElement('canvas');
    if (!probe.getContext('webgl2')) {
      queueMicrotask(() => setMapError({
        kind: 'renderer',
        message: 'WebGL 2 is unavailable in this browser. Your project can still be edited.',
      }));
      return;
    }

    let map: MapLibreMap;
    try {
      map = new Map({
        container: containerRef.current,
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
      return;
    }

    let styleLoaded = false;
    let mapFailed = false;
    let attributionInitialized = false;
    let attributionResizeFrame: number | null = null;
    const mobileViewportQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 760px)')
      : null;
    const syncAttributionState = (mobile: boolean) => {
      const attribution = containerRef.current?.querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib');
      if (!attribution) return;
      if (mobile) {
        attribution.removeAttribute('open');
        attribution.classList.remove('maplibregl-compact-show');
      } else {
        attribution.setAttribute('open', '');
        attribution.classList.add('maplibregl-compact-show');
      }
    };
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (attributionResizeFrame !== null) cancelAnimationFrame(attributionResizeFrame);
      attributionResizeFrame = requestAnimationFrame(() => {
        attributionResizeFrame = null;
        syncAttributionState(event.matches);
      });
    };
    const handleMapClick = (event: { point: Parameters<MapContentAdapter['hitTest']>[0] }) => {
      const adapter = contentAdapterRef.current;
      if (!adapter) {
        backgroundClickRef.current();
        return;
      }

      const layerId = adapter.hitTest(event.point);
      if (layerId === undefined) {
        setContentError((error) => error?.source === 'sync' ? error : {
          kind: 'content',
          source: 'hit-test',
          message: 'The map content could not be rendered. Review the layer data and retry.',
        });
        return;
      }

      setContentError((error) => error?.source === 'hit-test' ? null : error);
      if (layerId) {
        layerSelectRef.current(layerId);
      } else {
        backgroundClickRef.current();
      }
    };
    const handleLoad = () => {
      styleLoaded = true;
      if (containerRef.current) {
        contentAdapterRef.current = createMapLibreContentAdapter(map, containerRef.current);
        handleContentSyncResult(contentAdapterRef.current.sync(contentStateRef.current));
      }
    };
    const exportPreview: PreviewPngExporter = () => {
      const printFrame = containerRef.current?.parentElement?.querySelector<HTMLElement>('.print-frame');
      if (!printFrame) return Promise.reject(new Error('The print frame is not ready to export.'));
      const attribution = containerRef.current
        ?.querySelector<HTMLElement>('.maplibregl-ctrl-attrib-inner')
        ?.textContent ?? '';
      return capturePrintFramePng(map.getCanvas(), printFrame, attribution);
    };
    const handleIdle = () => {
      if (mapFailed) return;
      if (!attributionInitialized) {
        syncAttributionState(mobileViewportQuery?.matches ?? false);
        attributionInitialized = true;
      }
      if (contentSyncDeferredRef.current && contentAdapterRef.current) {
        handleContentSyncResult(contentAdapterRef.current.sync(contentStateRef.current));
      }
      if (!contentReadyRef.current) return;
      if (availableExporterRef.current !== exportPreview) {
        availableExporterRef.current = exportPreview;
        exporterChangeRef.current?.(exportPreview);
      }
      containerRef.current?.setAttribute('data-map-ready', 'true');
    };
    const handleAttributionDrag = () => {
      if (!mobileViewportQuery?.matches) return;
      syncAttributionState(true);
    };
    const handleError = () => {
      mapFailed = true;
      containerRef.current?.removeAttribute('data-map-ready');
      if (availableExporterRef.current === exportPreview) {
        availableExporterRef.current = null;
        exporterChangeRef.current?.(null);
      }
      if (!styleLoaded) {
        setMapError({
          kind: 'style',
          message: 'The map style could not be loaded. Check your connection and retry.',
        });
      } else {
        setMapError((error) => error ?? {
          kind: 'renderer',
          message: 'The map renderer encountered an error. Reload the page and retry.',
        });
      }
    };
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
    mobileViewportQuery?.addEventListener('change', handleViewportChange);
    map.once('load', handleLoad);
    map.on('idle', handleIdle);
    map.on('drag', handleAttributionDrag);
    map.on('error', handleError);
    map.on('click', handleMapClick);
    mapRef.current = map;

    return () => {
      if (availableExporterRef.current === exportPreview) {
        availableExporterRef.current = null;
        exporterChangeRef.current?.(null);
      }
      mobileViewportQuery?.removeEventListener('change', handleViewportChange);
      if (attributionResizeFrame !== null) cancelAnimationFrame(attributionResizeFrame);
      try { map.off('load', handleLoad); } catch {
        try { map.off('load', handleLoad); } catch { /* Cleanup retries are bounded and contained. */ }
      }
      try { map.off('idle', handleIdle); } catch {
        try { map.off('idle', handleIdle); } catch { /* Cleanup retries are bounded and contained. */ }
      }
      try { map.off('drag', handleAttributionDrag); } catch {
        try { map.off('drag', handleAttributionDrag); } catch { /* Cleanup retries are bounded and contained. */ }
      }
      try { map.off('error', handleError); } catch {
        try { map.off('error', handleError); } catch { /* Cleanup retries are bounded and contained. */ }
      }
      try { map.off('click', handleMapClick); } catch {
        try { map.off('click', handleMapClick); } catch { /* Cleanup retries are bounded and contained. */ }
      }
      const adapter = contentAdapterRef.current;
      contentAdapterRef.current = null;
      if (adapter) {
        try { adapter.destroy(); } catch {
          try { adapter.destroy(); } catch { /* Cleanup retries are bounded and contained. */ }
        }
      }
      if (mapRef.current === map) {
        mapRef.current = null;
        try { map.remove(); } catch {
          try { map.remove(); } catch { /* Cleanup retries are bounded and contained. */ }
        }
      }
    };
  }, [handleContentSyncResult]);

  useEffect(() => {
    if (fitRequest > 0 && mapRef.current) {
      mapRef.current.fitBounds(PAGE_BOUNDS, { padding: 64, duration: 0 });
      containerRef.current?.setAttribute('data-camera-fit-request', String(fitRequest));
    }
  }, [fitRequest]);

  const visibleError = mapError ?? contentError;

  return (
    <div className="canvas-surface" aria-label="Map canvas">
      <div ref={containerRef} className="map-root" data-testid="map-canvas" data-fit-request={fitRequest} />
      {visibleError && (
        <div className="map-fallback" role="status">
          <div><strong>Map preview unavailable</strong><span>{visibleError.message}</span></div>
        </div>
      )}
      <div
        className={`print-frame is-${orientation}`}
        style={{
          aspectRatio: page ? `${page.widthMm} / ${page.heightMm}` : undefined,
          '--studio-page-ratio': page ? page.widthMm / page.heightMm : 297 / 210,
        } as CSSProperties}
        aria-hidden="true"
      >
        <span className="page-label">{page?.preset ?? 'A4'} · {orientation === 'landscape' ? 'Landscape' : 'Portrait'}</span>
      </div>
    </div>
  );
}
