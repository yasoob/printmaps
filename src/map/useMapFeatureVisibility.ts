import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapFeatureVisibility } from '../domain/project';
import type { MapError } from './MapCanvasLifecycle';
import { createMapFeatureVisibilityController } from './MapFeatureVisibility';

type MutableReference<T> = { current: T };

type FeatureVisibilityOptions = {
  containerRef: RefObject<HTMLDivElement | null>;
  contentReadyRef: MutableReference<boolean>;
  featureVisibility: MapFeatureVisibility;
  invalidateExporter: () => void;
  mapFailedRef: MutableReference<boolean>;
  mapRef: MutableReference<MapLibreMap | null>;
  setMapError: Dispatch<SetStateAction<MapError | null>>;
};

function serializeVisibility(visibility: MapFeatureVisibility) {
  return `roads:${visibility.roads},buildings:${visibility.buildings},labels:${visibility.labels},water:${visibility.water},parks:${visibility.parks},landuse:${visibility.landuse},transit:${visibility.transit}`;
}

export function useMapFeatureVisibility(options: FeatureVisibilityOptions) {
  const { containerRef, contentReadyRef, featureVisibility, invalidateExporter, mapFailedRef, mapRef, setMapError } = options;
  const visibilityValue = useRef(featureVisibility);
  const controller = useRef<ReturnType<typeof createMapFeatureVisibilityController> | null>(null);
  const appliedVisibility = useRef<string | null>(null);
  const synchronizeFeatureVisibility = useCallback((currentMap: MapLibreMap) => {
    const serializedVisibility = serializeVisibility(visibilityValue.current);
    if (controller.current && appliedVisibility.current === serializedVisibility) return true;
    containerRef.current?.removeAttribute('data-map-ready');
    invalidateExporter();
    try {
      controller.current ??= createMapFeatureVisibilityController(
        currentMap as unknown as Parameters<typeof createMapFeatureVisibilityController>[0],
      );
      controller.current.apply(visibilityValue.current);
      appliedVisibility.current = serializedVisibility;
      containerRef.current?.setAttribute('data-map-feature-visibility', serializedVisibility);
      return true;
    } catch {
      mapFailedRef.current = true;
      contentReadyRef.current = false;
      containerRef.current?.removeAttribute('data-map-ready');
      containerRef.current?.removeAttribute('data-map-feature-visibility');
      invalidateExporter();
      queueMicrotask(() => setMapError({
        kind: 'renderer',
        message: 'Map feature visibility could not be applied. Reload the page and retry.',
      }));
      return false;
    }
  }, [containerRef, contentReadyRef, invalidateExporter, mapFailedRef, setMapError]);

  useLayoutEffect(() => {
    visibilityValue.current = featureVisibility;
  }, [featureVisibility]);

  useEffect(() => {
    const currentMap = mapRef.current;
    if (currentMap && controller.current) synchronizeFeatureVisibility(currentMap);
  }, [featureVisibility, mapRef, synchronizeFeatureVisibility]);

  const resetFeatureVisibility = useCallback(() => {
    containerRef.current?.removeAttribute('data-map-feature-visibility');
    controller.current = null;
    appliedVisibility.current = null;
  }, [containerRef]);

  return { resetFeatureVisibility, synchronizeFeatureVisibility };
}
