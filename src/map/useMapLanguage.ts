import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapLanguage } from '../domain/project';
import type { MapError } from './MapCanvasLifecycle';
import { createMapLanguageController } from './MapLanguage';

type MutableReference<T> = { current: T };

type MapLanguageOptions = {
  containerRef: RefObject<HTMLDivElement | null>;
  contentReadyRef: MutableReference<boolean>;
  invalidateExporter: () => void;
  language: MapLanguage;
  mapFailedRef: MutableReference<boolean>;
  mapRef: MutableReference<MapLibreMap | null>;
  setMapError: Dispatch<SetStateAction<MapError | null>>;
};

export function useMapLanguage(options: MapLanguageOptions) {
  const { containerRef, contentReadyRef, invalidateExporter, language, mapFailedRef, mapRef, setMapError } = options;
  const languageValue = useRef(language);
  const controller = useRef<ReturnType<typeof createMapLanguageController> | null>(null);
  const appliedLanguage = useRef<MapLanguage | null>(null);
  const synchronizeMapLanguage = useCallback((currentMap: MapLibreMap) => {
    if (controller.current && appliedLanguage.current === languageValue.current) return true;
    containerRef.current?.removeAttribute('data-map-ready');
    invalidateExporter();
    try {
      controller.current ??= createMapLanguageController(
        currentMap as unknown as Parameters<typeof createMapLanguageController>[0],
      );
      controller.current.apply(languageValue.current);
      appliedLanguage.current = languageValue.current;
      containerRef.current?.setAttribute('data-map-language', languageValue.current);
      return true;
    } catch {
      mapFailedRef.current = true;
      contentReadyRef.current = false;
      containerRef.current?.removeAttribute('data-map-ready');
      containerRef.current?.removeAttribute('data-map-language');
      invalidateExporter();
      queueMicrotask(() => setMapError({
        kind: 'renderer',
        message: 'Map label language could not be applied. Reload the page and retry.',
      }));
      return false;
    }
  }, [containerRef, contentReadyRef, invalidateExporter, mapFailedRef, setMapError]);

  useLayoutEffect(() => {
    languageValue.current = language;
  }, [language]);

  useEffect(() => {
    const currentMap = mapRef.current;
    if (currentMap && controller.current) synchronizeMapLanguage(currentMap);
  }, [language, mapRef, synchronizeMapLanguage]);

  const resetMapLanguage = useCallback(() => {
    containerRef.current?.removeAttribute('data-map-language');
    controller.current = null;
    appliedLanguage.current = null;
  }, [containerRef]);

  return { resetMapLanguage, synchronizeMapLanguage };
}