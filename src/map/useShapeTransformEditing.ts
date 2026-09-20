import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer, MapStylePreset, ShapeGeometry } from '../domain/project';
import { installShapeTransformEditing, isEditableShapeLayer } from './ShapeTransformEditing';
import { mutationRejected, type ProjectMutationResult } from '../domain/projectMutation';

type ShapeTransformEditingOptions = {
  active: boolean;
  layers: ContentLayer[];
  map: RefObject<MapLibreMap | null>;
  onShapeGeometryChange?: (id: string, geometry: ShapeGeometry) => ProjectMutationResult;
  selectedId: string | null;
  stylePreset: MapStylePreset;
};

export function useShapeTransformEditing({
  active,
  layers,
  map,
  onShapeGeometryChange,
  selectedId,
  stylePreset,
}: ShapeTransformEditingOptions) {
  const shapeGeometryChange = useRef(onShapeGeometryChange);
  const pendingFocus = useRef<{ layerId: string; role: string } | null>(null);
  const selectedLayer = layers.find((layer) => layer.id === selectedId);
  const selectedLayerRef = useRef(selectedLayer);
  const session = useRef<ReturnType<typeof installShapeTransformEditing> | null>(null);
  const canCommit = typeof onShapeGeometryChange === 'function';
  const sessionKey = selectedLayer && isEditableShapeLayer(selectedLayer) ? selectedLayer.id : null;
  useLayoutEffect(() => {
    shapeGeometryChange.current = onShapeGeometryChange;
    selectedLayerRef.current = selectedLayer;
  }, [onShapeGeometryChange, selectedLayer]);

  useLayoutEffect(() => {
    const activeMap = map.current;
    const selectedLayer = selectedLayerRef.current;
    if (!active || !activeMap || !selectedLayer || !canCommit || !sessionKey) {
      pendingFocus.current = null;
      return;
    }
    const editing = installShapeTransformEditing(
      activeMap,
      selectedLayer,
      (geometry) => shapeGeometryChange.current?.(selectedLayer.id, geometry) ?? mutationRejected('Area editing is no longer available.', 'unavailable'),
    );
    session.current = editing;
    if (pendingFocus.current?.layerId === selectedLayer.id) editing.focusHandle(pendingFocus.current.role);
    pendingFocus.current = null;
    return () => {
      const activeElement = globalThis.document.activeElement;
      const role = activeElement instanceof HTMLElement ? activeElement.dataset.shapeTransformHandle : undefined;
      if (role) pendingFocus.current = { layerId: selectedLayer.id, role };
      session.current = null;
      editing();
    };
  }, [active, canCommit, map, sessionKey, stylePreset]);
  useLayoutEffect(() => {
    if (selectedLayer) session.current?.synchronizeLayer(selectedLayer);
  }, [selectedLayer]);
}
