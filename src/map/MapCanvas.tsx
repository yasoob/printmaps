import { useEffect, useRef, useState } from 'react';
import { AttributionControl, Map, NavigationControl, type Map as MapLibreMap } from 'maplibre-gl';

type MapCanvasProps = {
  onBackgroundClick: () => void;
};

const OPEN_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export function MapCanvas({ onBackgroundClick }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

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

    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
    map.once('idle', () => containerRef.current?.setAttribute('data-map-ready', 'true'));
    map.on('click', onBackgroundClick);
    mapRef.current = map;

    return () => {
      map.off('click', onBackgroundClick);
      if (mapRef.current === map) {
        map.remove();
        mapRef.current = null;
      }
    };
  }, [onBackgroundClick]);

  return (
    <div className="canvas-surface" aria-label="Map canvas">
      <div ref={containerRef} className="map-root" data-testid="map-canvas" />
      {mapError && (
        <div className="map-fallback" role="status">
          <div><strong>Map preview unavailable</strong><span>{mapError}</span></div>
        </div>
      )}
      <div className="print-frame" aria-hidden="true">
        <span className="page-label">A4 · Landscape</span>
      </div>
    </div>
  );
}
