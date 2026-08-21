import { useEffect, useRef, useState } from 'react';
import { AttributionControl, Map, NavigationControl, type Map as MapLibreMap } from 'maplibre-gl';

type MapCanvasProps = {
  onBackgroundClick: () => void;
  fitRequest?: number;
  orientation?: 'landscape' | 'portrait';
};

const OPEN_STYLE = '/styles/liberty.json';
const PAGE_BOUNDS: [[number, number], [number, number]] = [[16.28, 48.14], [16.48, 48.26]];

export function MapCanvas({ onBackgroundClick, fitRequest = 0, orientation = 'landscape' }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const backgroundClickRef = useRef(onBackgroundClick);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    backgroundClickRef.current = onBackgroundClick;
  }, [onBackgroundClick]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const probe = document.createElement('canvas');
    if (!probe.getContext('webgl2')) {
      queueMicrotask(() => setMapError('WebGL 2 is unavailable in this browser. Your project can still be edited.'));
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
      queueMicrotask(() => setMapError('The map renderer is unavailable in this browser. Your project can still be edited.'));
      return;
    }

    let styleLoaded = false;
    const handleBackgroundClick = () => backgroundClickRef.current();
    const handleLoad = () => {
      styleLoaded = true;
    };
    const handleError = () => {
      if (!styleLoaded) {
        setMapError('The map style could not be loaded. Check your connection and retry.');
      }
    };
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
    map.once('load', handleLoad);
    map.once('idle', () => containerRef.current?.setAttribute('data-map-ready', 'true'));
    map.on('error', handleError);
    map.on('click', handleBackgroundClick);
    mapRef.current = map;

    return () => {
      map.off('load', handleLoad);
      map.off('error', handleError);
      map.off('click', handleBackgroundClick);
      if (mapRef.current === map) {
        map.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (fitRequest > 0 && mapRef.current) {
      mapRef.current.fitBounds(PAGE_BOUNDS, { padding: 64, duration: 0 });
      containerRef.current?.setAttribute('data-camera-fit-request', String(fitRequest));
    }
  }, [fitRequest]);

  return (
    <div className="canvas-surface" aria-label="Map canvas">
      <div ref={containerRef} className="map-root" data-testid="map-canvas" data-fit-request={fitRequest} />
      {mapError && (
        <div className="map-fallback" role="status">
          <div><strong>Map preview unavailable</strong><span>{mapError}</span></div>
        </div>
      )}
      <div className={`print-frame is-${orientation}`} aria-hidden="true">
        <span className="page-label">A4 · {orientation === 'landscape' ? 'Landscape' : 'Portrait'}</span>
      </div>
    </div>
  );
}
