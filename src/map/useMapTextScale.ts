import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapError } from './MapCanvasLifecycle';
import { createMapTextScaleController } from './MapTextScale';

type MutableReference<T> = { current: T };

type TextScaleOptions = {
  containerRef: RefObject<HTMLDivElement | null>;
  contentReadyRef: MutableReference<boolean>;
  invalidateExporter: () => void;
  mapFailedRef: MutableReference<boolean>;
  mapRef: MutableReference<MapLibreMap | null>;
  setMapError: Dispatch<SetStateAction<MapError | null>>;
  textScalePercent: number;
};

export function useMapTextScale(options: TextScaleOptions) {
  const { containerRef, contentReadyRef, invalidateExporter, mapFailedRef, mapRef, setMapError, textScalePercent } = options;
  const textScaleValue = useRef(textScalePercent);
  const controller = useRef<ReturnType<typeof createMapTextScaleController> | null>(null);
  const synchronizeTextScale = useCallback((currentMap: MapLibreMap) => {
    try {
      controller.current ??= createMapTextScaleController(
        currentMap as unknown as Parameters<typeof createMapTextScaleController>[0],
      );
      controller.current.apply(textScaleValue.current);
      containerRef.current?.setAttribute('data-map-text-scale', String(textScaleValue.current));
      return true;
    } catch {
      mapFailedRef.current = true;
      contentReadyRef.current = false;
      containerRef.current?.removeAttribute('data-map-ready');
      containerRef.current?.removeAttribute('data-map-text-scale');
      invalidateExporter();
      queueMicrotask(() => setMapError({
        kind: 'renderer',
        message: 'Map labels could not be resized. Reload the page and retry.',
      }));
      return false;
    }
  }, [containerRef, contentReadyRef, invalidateExporter, mapFailedRef, setMapError]);

  useLayoutEffect(() => {
    textScaleValue.current = textScalePercent;
  }, [textScalePercent]);

  useEffect(() => {
    const currentMap = mapRef.current;
    if (currentMap && controller.current) synchronizeTextScale(currentMap);
  }, [mapRef, synchronizeTextScale, textScalePercent]);

  const resetTextScale = useCallback(() => {
    containerRef.current?.removeAttribute('data-map-text-scale');
    controller.current = null;
  }, [containerRef]);

  return { resetTextScale, synchronizeTextScale };
}
