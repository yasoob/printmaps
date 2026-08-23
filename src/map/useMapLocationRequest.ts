import { useEffect, useRef, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { applyMapLocation, type MapLocationRequest } from './MapLocationRequest';

type MapLocationRequestOptions = {
  container: RefObject<HTMLDivElement | null>;
  locationRequest: MapLocationRequest;
  map: RefObject<MapLibreMap | null>;
  stylePreset: string;
};

export function useMapLocationRequest(options: MapLocationRequestOptions): void {
  const applied = useRef({ request: 0, stylePreset: '' });
  useEffect(() => {
    if (!options.map.current || !options.locationRequest.coordinate || options.locationRequest.request <= 0) return;
    const previous = applied.current;
    if (previous.request >= options.locationRequest.request && previous.stylePreset === options.stylePreset) return;
    applyMapLocation(options.map.current, options.locationRequest.coordinate);
    applied.current = { request: options.locationRequest.request, stylePreset: options.stylePreset };
    options.container.current?.setAttribute('data-map-location-applied', String(options.locationRequest.request));
    options.locationRequest.onApplied?.();
  }, [options.container, options.locationRequest, options.map, options.stylePreset]);
}
