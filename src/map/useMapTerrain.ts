import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { TerrainSettings } from '../domain/studio';
import type { MapError } from './MapCanvasLifecycle';
import { createMapTerrainController } from './MapTerrain';

export function useMapTerrain(options: {
  terrain: TerrainSettings;
  basemapVisible: boolean;
  buildingsVisible: boolean;
  mapRef: RefObject<MapLibreMap | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  mapFailedRef: RefObject<boolean>;
  invalidateExporter: () => void;
  setMapError: Dispatch<SetStateAction<MapError | null>>;
}) {
  const { terrain, basemapVisible, buildingsVisible, mapRef, containerRef, mapFailedRef, invalidateExporter, setMapError } = options;
  const latest = useRef({ terrain, basemapVisible, buildingsVisible });
  const controller = useRef<ReturnType<typeof createMapTerrainController> | null>(null);
  const fail = useCallback((error: Error) => {
    mapFailedRef.current = true;
    containerRef.current?.removeAttribute('data-map-ready');
    invalidateExporter();
    setMapError({ kind: 'renderer', message: `Terrain could not be rendered: ${error.message} Retry the map or disable terrain.` });
  }, [containerRef, invalidateExporter, mapFailedRef, setMapError]);
  const synchronizeTerrain = useCallback((map: MapLibreMap) => {
    const value = latest.current;
    if (!controller.current && !value.terrain.enabled && !value.terrain.contours.enabled && !value.terrain.buildings.enabled) return true;
    try {
      controller.current ??= createMapTerrainController(map, fail);
      containerRef.current?.removeAttribute('data-map-ready');
      invalidateExporter();
      controller.current.apply(value.terrain, value.basemapVisible, value.buildingsVisible);
      return true;
    } catch (error) {
      fail(error instanceof Error ? error : new Error('Terrain style application failed.'));
      return false;
    }
  }, [containerRef, fail, invalidateExporter]);
  useLayoutEffect(() => { latest.current = { terrain, basemapVisible, buildingsVisible }; }, [terrain, basemapVisible, buildingsVisible]);
  useEffect(() => {
    if (mapRef.current && (controller.current || mapRef.current.isStyleLoaded?.())) synchronizeTerrain(mapRef.current);
  }, [terrain, basemapVisible, buildingsVisible, mapRef, synchronizeTerrain]);
  const resetTerrain = useCallback(() => {
    controller.current?.dispose();
    controller.current = null;
  }, []);
  useEffect(() => resetTerrain, [resetTerrain]);
  return { resetTerrain, synchronizeTerrain };
}
