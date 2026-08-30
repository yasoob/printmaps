import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapFeatureVisibility } from '../domain/project';
import type { MapError } from './MapCanvasLifecycle';
import { createMapFeatureVisibilityController } from './MapFeatureVisibility';

type MutableReference<T> = { current: T };

type FeatureVisibilityOptions = {
  basemapVisible: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  contentReadyRef: MutableReference<boolean>;
  featureVisibility: MapFeatureVisibility;
  invalidateExporter: () => void;
  mapFailedRef: MutableReference<boolean>;
  mapRef: MutableReference<MapLibreMap | null>;
  setMapError: Dispatch<SetStateAction<MapError | null>>;
};

function serializeFeatureVisibility(visibility: MapFeatureVisibility) {
  return `roads:${visibility.roads},buildings:${visibility.buildings},labels:${visibility.labels},water:${visibility.water},parks:${visibility.parks},landuse:${visibility.landuse},transit:${visibility.transit}`;
}

function serializeVisibility(visibility: MapFeatureVisibility, isBasemapVisible: boolean) {
  return `basemap:${isBasemapVisible},${serializeFeatureVisibility(visibility)}`;
}

export function useMapFeatureVisibility(options: FeatureVisibilityOptions) {
  const { basemapVisible, containerRef, contentReadyRef, featureVisibility, invalidateExporter, mapFailedRef, mapRef, setMapError } = options;
  const visibilityValue = useRef(featureVisibility), basemapVisibleValue = useRef(basemapVisible);
  const controller = useRef<ReturnType<typeof createMapFeatureVisibilityController> | null>(null);
  const appliedVisibility = useRef<string | null>(null);
  const synchronizeFeatureVisibility = useCallback((currentMap: MapLibreMap) => {
    const serializedVisibility = serializeVisibility(visibilityValue.current, basemapVisibleValue.current);
    if (controller.current && appliedVisibility.current === serializedVisibility) return true;
    containerRef.current?.removeAttribute('data-map-ready');
    invalidateExporter();
    try {
      controller.current ??= createMapFeatureVisibilityController(
        currentMap as unknown as Parameters<typeof createMapFeatureVisibilityController>[0],
      );
      controller.current.apply(visibilityValue.current, basemapVisibleValue.current);
      appliedVisibility.current = serializedVisibility;
      containerRef.current?.setAttribute('data-map-feature-visibility', serializeFeatureVisibility(visibilityValue.current));
      containerRef.current?.setAttribute('data-map-basemap-visible', String(basemapVisibleValue.current));
      return true;
    } catch {
      mapFailedRef.current = true;
      contentReadyRef.current = false;
      containerRef.current?.removeAttribute('data-map-ready');
      containerRef.current?.removeAttribute('data-map-feature-visibility');
      containerRef.current?.removeAttribute('data-map-basemap-visible');
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
    basemapVisibleValue.current = basemapVisible;
  }, [basemapVisible, featureVisibility]);

  useEffect(() => {
    const currentMap = mapRef.current;
    if (currentMap && controller.current) synchronizeFeatureVisibility(currentMap);
  }, [basemapVisible, featureVisibility, mapRef, synchronizeFeatureVisibility]);

  const setBasemapExportVisibility = useCallback((
    currentMap: MapLibreMap,
    override: boolean | null,
  ): boolean => {
    if (!controller.current) return false;
    try {
      controller.current.apply(
        visibilityValue.current,
        override ?? basemapVisibleValue.current,
      );
      currentMap.triggerRepaint();
      appliedVisibility.current = override === null
        ? serializeVisibility(visibilityValue.current, basemapVisibleValue.current)
        : null;
      return true;
    } catch {
      return false;
    }
  }, []);

  const resolveExportStyle = useCallback((
    currentMap: MapLibreMap,
    content: 'basemap' | 'composite',
  ) => {
    if (!controller.current) {
      throw new Error('Map visibility is not ready for native export.');
    }
    return controller.current.style(
      currentMap.getStyle(),
      visibilityValue.current,
      content === 'basemap' || basemapVisibleValue.current,
    ) as ReturnType<MapLibreMap['getStyle']>;
  }, []);

  const resetFeatureVisibility = useCallback(() => {
    containerRef.current?.removeAttribute('data-map-feature-visibility');
    controller.current = null;
    appliedVisibility.current = null;
  }, [containerRef]);

  return {
    resetFeatureVisibility,
    resolveExportStyle,
    setBasemapExportVisibility,
    synchronizeFeatureVisibility,
  };
}
