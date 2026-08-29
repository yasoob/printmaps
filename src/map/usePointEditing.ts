import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer, MapStylePreset } from '../domain/project';
import { installPointEditing } from './PointEditing';

type PointEditingOptions = {
  layers: ContentLayer[];
  map: RefObject<MapLibreMap | null>;
  onPoiCoordinatesChange?: (id: string, coordinate: readonly [number, number]) => void;
  selectedId: string | null;
  stylePreset: MapStylePreset;
};

export function usePointEditing({
  layers,
  map,
  onPoiCoordinatesChange,
  selectedId,
  stylePreset,
}: PointEditingOptions) {
  const coordinatesChange = useRef(onPoiCoordinatesChange);
  const pendingFocus = useRef<string | null>(null);
  const canCommit = typeof onPoiCoordinatesChange === 'function';
  useLayoutEffect(() => {
    coordinatesChange.current = onPoiCoordinatesChange;
  }, [onPoiCoordinatesChange]);

  useEffect(() => {
    const activeMap = map.current;
    const selectedLayer = layers.find((layer) => layer.id === selectedId);
    if (!activeMap || !selectedLayer || !canCommit) {
      pendingFocus.current = null;
      return;
    }
    const editing = installPointEditing(
      activeMap,
      selectedLayer,
      (coordinate) => coordinatesChange.current?.(selectedLayer.id, coordinate),
    );
    if (pendingFocus.current === selectedLayer.id) editing.focusHandle();
    pendingFocus.current = null;
    return () => {
      const activeElement = globalThis.document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement.dataset.poiMoveHandle === selectedLayer.id) {
        pendingFocus.current = selectedLayer.id;
      }
      editing();
    };
  }, [canCommit, layers, map, selectedId, stylePreset]);
}
