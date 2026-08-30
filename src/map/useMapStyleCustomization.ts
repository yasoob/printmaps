import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  isMapStyleCustomized,
  resolveMapStyleTokens,
  type MapStyleCustomization,
} from '../domain/mapStyleCustomization';
import type { MapStylePreset } from '../domain/mapStylePresets';
import type { MapError } from './MapCanvasLifecycle';
import { createSemanticMapStyleController } from './MapStyleSemantic';

type MutableReference<T> = { current: T };

type StyleCustomizationOptions = {
  containerRef: RefObject<HTMLDivElement | null>;
  contentReadyRef: MutableReference<boolean>;
  customization: MapStyleCustomization;
  invalidateExporter: () => void;
  mapFailedRef: MutableReference<boolean>;
  mapRef: MutableReference<MapLibreMap | null>;
  preset: MapStylePreset;
  setMapError: Dispatch<SetStateAction<MapError | null>>;
};

function customizationSignature(preset: MapStylePreset, customization: MapStyleCustomization): string {
  const colors = Object.entries(customization.colors)
    .map(([role, color]) => `${role}:${color}`)
    .join(',');
  return `${preset}:${customization.tone}:${customization.contrast}:${customization.detail}:${colors}`;
}

export function useMapStyleCustomization(options: StyleCustomizationOptions) {
  const {
    containerRef,
    contentReadyRef,
    customization,
    invalidateExporter,
    mapFailedRef,
    mapRef,
    preset,
    setMapError,
  } = options;
  const value = useRef({ preset, customization });
  const initialized = useRef(false);
  const appliedSignature = useRef<string | null>(null);
  const controller = useRef<ReturnType<typeof createSemanticMapStyleController> | null>(null);

  const synchronizeStyleCustomization = useCallback((currentMap: MapLibreMap) => {
    const current = value.current;
    const signature = customizationSignature(current.preset, current.customization);
    if (initialized.current && appliedSignature.current === signature) return true;
    const isCustomized = isMapStyleCustomized(current.customization);
    if (!isCustomized && !initialized.current) {
      initialized.current = true;
      containerRef.current?.setAttribute('data-map-style-customized', 'false');
      return true;
    }
    containerRef.current?.removeAttribute('data-map-ready');
    invalidateExporter();
    try {
      controller.current ??= createSemanticMapStyleController(currentMap);
      controller.current.apply(resolveMapStyleTokens(current.preset, current.customization));
      currentMap.triggerRepaint();
      initialized.current = true;
      appliedSignature.current = signature;
      containerRef.current?.setAttribute('data-map-style-customized', String(isCustomized));
      return true;
    } catch {
      mapFailedRef.current = true;
      contentReadyRef.current = false;
      containerRef.current?.removeAttribute('data-map-ready');
      containerRef.current?.removeAttribute('data-map-style-customized');
      invalidateExporter();
      queueMicrotask(() => setMapError({
        kind: 'renderer',
        message: 'Map color customization could not be applied. Reload the page and retry.',
      }));
      return false;
    }
  }, [containerRef, contentReadyRef, invalidateExporter, mapFailedRef, setMapError]);

  useLayoutEffect(() => {
    value.current = { preset, customization };
  }, [customization, preset]);

  useEffect(() => {
    const currentMap = mapRef.current;
    if (currentMap && initialized.current) synchronizeStyleCustomization(currentMap);
  }, [customization, mapRef, preset, synchronizeStyleCustomization]);

  const resetStyleCustomization = useCallback(() => {
    containerRef.current?.removeAttribute('data-map-style-customized');
    initialized.current = false;
    appliedSignature.current = null;
    controller.current = null;
  }, [containerRef]);

  return { resetStyleCustomization, synchronizeStyleCustomization };
}
