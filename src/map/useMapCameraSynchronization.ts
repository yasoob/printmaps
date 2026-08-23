import { useEffect, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { CameraSettings, MapStylePreset } from '../domain/project';
import { setMapInteractionLock } from './MapInteractionLock';

type CameraSynchronizationOptions = {
  camera: CameraSettings;
  container: RefObject<HTMLDivElement | null>;
  map: RefObject<MapLibreMap | null>;
  stylePreset: MapStylePreset;
};

export function useMapCameraSynchronization(options: CameraSynchronizationOptions) {
  useEffect(() => {
    if (!options.map.current) return;
    const { bearing, center, pitch, zoom } = options.camera;
    options.map.current.jumpTo({ bearing, center, pitch, zoom });
    options.container.current?.setAttribute('data-map-bearing', String(bearing));
    options.container.current?.setAttribute('data-map-center', center.join(','));
    options.container.current?.setAttribute('data-map-pitch', String(pitch));
    options.container.current?.setAttribute('data-map-zoom', String(zoom));
  }, [options.camera, options.container, options.map, options.stylePreset]);
  useEffect(() => {
    if (options.map.current) setMapInteractionLock(options.map.current, options.camera.locked);
  }, [options.camera.locked, options.map, options.stylePreset]);
}
