import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer, MapStylePreset, ShapeGeometry } from '../domain/project';
import { canDirectlyEditShapePoints, installShapeVertexEditing } from './ShapeVertexEditing';
import { mutationRejected, type ProjectMutationResult } from '../domain/projectMutation';

type ShapeVertexEditingOptions = {
  active: boolean;
  layers: ContentLayer[];
  map: RefObject<MapLibreMap | null>;
  onShapeGeometryChange?: (id: string, geometry: ShapeGeometry) => ProjectMutationResult;
  selectedId: string | null;
  stylePreset: MapStylePreset;
};

export function useShapeVertexEditing({
  active,
  layers,
  map,
  onShapeGeometryChange,
  selectedId,
  stylePreset,
}: ShapeVertexEditingOptions) {
  const shapeGeometryChange = useRef(onShapeGeometryChange);
  const pendingFocus = useRef<{ layerId: string; ringIndex: number; vertexIndex: number } | null>(null);
  const selectedLayer = layers.find((layer) => layer.id === selectedId);
  const selectedLayerRef = useRef(selectedLayer);
  const session = useRef<ReturnType<typeof installShapeVertexEditing> | null>(null);
  const canCommit = typeof onShapeGeometryChange === 'function';
  const sessionKey = canDirectlyEditShapePoints(selectedLayer)
    ? `${selectedLayer.id}:${selectedLayer.geometry.coordinates.map((ring) => ring.length).join(':')}` : null;
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
    const editing = installShapeVertexEditing(
      activeMap,
      selectedLayer,
      (geometry) => shapeGeometryChange.current?.(selectedLayer.id, geometry) ?? mutationRejected('Area editing is no longer available.', 'unavailable'),
    );
    session.current = editing;
    if (pendingFocus.current?.layerId === selectedLayer.id) {
      editing.focusPoint(pendingFocus.current.ringIndex, pendingFocus.current.vertexIndex);
    }
    pendingFocus.current = null;
    return () => {
      const activeElement = globalThis.document.activeElement;
      const ringIndex = activeElement instanceof HTMLElement ? activeElement.dataset.shapeRingIndex : undefined;
      const vertexIndex = activeElement instanceof HTMLElement ? activeElement.dataset.shapeVertexIndex : undefined;
      if (ringIndex !== undefined && vertexIndex !== undefined) {
        pendingFocus.current = { layerId: selectedLayer.id, ringIndex: Number(ringIndex), vertexIndex: Number(vertexIndex) };
      }
      session.current = null;
      editing();
    };
  }, [active, canCommit, map, sessionKey, stylePreset]);
  useLayoutEffect(() => {
    if (selectedLayer) session.current?.synchronizeLayer(selectedLayer);
  }, [selectedLayer]);
}
