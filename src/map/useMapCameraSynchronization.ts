import { useEffect, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { CameraSettings, MapStylePreset } from '../domain/project';
import { setMapInteractionLock } from './MapInteractionLock';
import { writeCameraViewportAttributes } from './MapCameraViewport';

type CameraSynchronizationOptions = {
  camera: CameraSettings;
  container: RefObject<HTMLDivElement | null>;
  map: RefObject<MapLibreMap | null>;
  instance?: MapLibreMap | null;
  stylePreset: MapStylePreset;
};

export function useMapCameraSynchronization(options: CameraSynchronizationOptions) {
  const { bearing, center, pitch, zoom } = options.camera;
  const [longitude, latitude] = center;
  useEffect(() => {
    if (!options.map.current) return;
    const center: [number, number] = [longitude, latitude];
    options.map.current.jumpTo({ bearing, center, pitch, zoom });
    writeCameraViewportAttributes(options.container.current, { bearing, center, pitch, zoom });
  }, [bearing, latitude, longitude, pitch, zoom, options.container, options.map, options.stylePreset]);
  useEffect(() => {
    if (options.map.current) setMapInteractionLock(options.map.current, options.camera.locked);
  }, [options.camera.locked, options.instance, options.map, options.stylePreset]);
}
