import { useEffect, useRef, useState } from 'react';
import { AttributionControl, Map, NavigationControl, type Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';
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
  fitRequest?: number;
  orientation?: 'landscape' | 'portrait';
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
  fitRequest = 0,
  orientation = 'landscape',
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const contentAdapterRef = useRef<MapContentAdapter | null>(null);
  const contentStateRef = useRef<MapContentState>({ layers, selectedId, previewedId });
  const contentSyncDeferredRef = useRef(false);
  const layerSelectRef = useRef(onLayerSelect);
  const backgroundClickRef = useRef(onBackgroundClick);
  const [mapError, setMapError] = useState<MapError | null>(null);
  const [contentError, setContentError] = useState<ContentError | null>(null);

  const handleContentSyncResult = (result: ReturnType<MapContentAdapter['sync']> | undefined) => {
    contentSyncDeferredRef.current = result === 'deferred';
    if (result === 'failed') {
      queueMicrotask(() => setContentError({
        kind: 'content',
        source: 'sync',
        message: 'The map content could not be rendered. Review the layer data and retry.',
      }));
    } else if (result === 'synced') {
      queueMicrotask(() => setContentError((error) => error?.source === 'sync' ? null : error));
    }
  };

  useEffect(() => {
    backgroundClickRef.current = onBackgroundClick;
    layerSelectRef.current = onLayerSelect;
  }, [onBackgroundClick, onLayerSelect]);

  useEffect(() => {
    contentStateRef.current = { layers, selectedId, previewedId };
    const adapter = contentAdapterRef.current;
    handleContentSyncResult(adapter?.sync(contentStateRef.current));
  }, [layers, previewedId, selectedId]);

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
      });
    } catch {
      queueMicrotask(() => setMapError({
        kind: 'renderer',
        message: 'The map renderer is unavailable in this browser. Your project can still be edited.',
      }));
      return;
    }

    let styleLoaded = false;
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
    const handleIdle = () => {
      containerRef.current?.setAttribute('data-map-ready', 'true');
      if (contentSyncDeferredRef.current && contentAdapterRef.current) {
        handleContentSyncResult(contentAdapterRef.current.sync(contentStateRef.current));
      }
    };
    const handleError = () => {
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
    map.once('load', handleLoad);
    map.on('idle', handleIdle);
    map.on('error', handleError);
    map.on('click', handleMapClick);
    mapRef.current = map;

    return () => {
      try { map.off('load', handleLoad); } catch {
        try { map.off('load', handleLoad); } catch { /* Cleanup retries are bounded and contained. */ }
      }
      try { map.off('idle', handleIdle); } catch {
        try { map.off('idle', handleIdle); } catch { /* Cleanup retries are bounded and contained. */ }
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
  }, []);

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
      <div className={`print-frame is-${orientation}`} aria-hidden="true">
        <span className="page-label">A4 · {orientation === 'landscape' ? 'Landscape' : 'Portrait'}</span>
      </div>
    </div>
  );
}
