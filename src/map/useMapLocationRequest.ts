import { useEffect, useRef, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { didApplyMapLocation, type MapLocationRequest } from './MapLocationRequest';

type MapLocationRequestOptions = {
  container: RefObject<HTMLDivElement | null>;
  locationRequest: MapLocationRequest;
  map: RefObject<MapLibreMap | null>;
  stylePreset: string;
};

export function useMapLocationRequest(options: MapLocationRequestOptions): void {
  const applied = useRef({ request: 0, scope: NaN });
  useEffect(() => {
    if (!options.map.current || !options.locationRequest.coordinate || options.locationRequest.request <= 0) return;
    const scope = options.locationRequest.scope ?? 0;
    if (applied.current.scope === scope && applied.current.request >= options.locationRequest.request) return;
    if (!didApplyMapLocation(options.map.current, options.locationRequest.coordinate)) return;
    applied.current = { request: options.locationRequest.request, scope };
    options.container.current?.setAttribute('data-map-location-applied', String(options.locationRequest.request));
    options.locationRequest.onApplied?.();
  }, [options.container, options.locationRequest, options.map, options.stylePreset]);
}
