import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer, MapStylePreset } from '../domain/project';
import { installPointEditing, isEditablePoint } from './PointEditing';
import { mutationRejected, type ProjectMutationResult } from '../domain/projectMutation';

type PointEditingOptions = {
  layers: ContentLayer[];
  map: RefObject<MapLibreMap | null>;
  onPoiCoordinatesChange?: (id: string, coordinate: readonly [number, number]) => ProjectMutationResult;
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
  const selectedLayer = layers.find((layer) => layer.id === selectedId);
  const selectedLayerRef = useRef(selectedLayer);
  const session = useRef<ReturnType<typeof installPointEditing> | null>(null);
  const sessionKey = selectedLayer && isEditablePoint(selectedLayer) ? selectedLayer.id : null;
  useLayoutEffect(() => {
    coordinatesChange.current = onPoiCoordinatesChange;
    selectedLayerRef.current = selectedLayer;
  }, [onPoiCoordinatesChange, selectedLayer]);

  useLayoutEffect(() => {
    const activeMap = map.current;
    const selectedLayer = selectedLayerRef.current;
    if (!activeMap || !selectedLayer || !canCommit || !sessionKey) {
      pendingFocus.current = null;
      return;
    }
    const editing = installPointEditing(
      activeMap,
      selectedLayer,
      (coordinate) => {
        const commit = coordinatesChange.current;
        return commit ? commit(selectedLayer.id, coordinate) : mutationRejected('Point editing is no longer available.', 'unavailable');
      },
    );
    session.current = editing;
    if (pendingFocus.current === selectedLayer.id) editing.focusHandle();
    pendingFocus.current = null;
    return () => {
      const activeElement = globalThis.document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement.dataset.poiMoveHandle === selectedLayer.id) {
        pendingFocus.current = selectedLayer.id;
      }
      session.current = null;
      editing();
    };
  }, [canCommit, map, sessionKey, stylePreset]);
  useLayoutEffect(() => {
    if (selectedLayer) session.current?.synchronizeLayer(selectedLayer);
  }, [selectedLayer]);
}
