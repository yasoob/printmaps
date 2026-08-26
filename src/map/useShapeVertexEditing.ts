import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer, MapStylePreset, ShapeGeometry } from '../domain/project';
import { installShapeVertexEditing } from './ShapeVertexEditing';

type ShapeVertexEditingOptions = {
  active: boolean;
  layers: ContentLayer[];
  map: RefObject<MapLibreMap | null>;
  onShapeGeometryChange?: (id: string, geometry: ShapeGeometry) => void;
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
  useLayoutEffect(() => {
    shapeGeometryChange.current = onShapeGeometryChange;
  }, [onShapeGeometryChange]);

  useEffect(() => {
    const activeMap = map.current;
    const selectedLayer = layers.find((layer) => layer.id === selectedId);
    if (!active || !activeMap || !selectedLayer || !onShapeGeometryChange) {
      pendingFocus.current = null;
      return;
    }
    const editing = installShapeVertexEditing(
      activeMap,
      selectedLayer,
      (geometry) => shapeGeometryChange.current?.(selectedLayer.id, geometry),
    );
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
      editing();
    };
  }, [active, layers, map, onShapeGeometryChange, selectedId, stylePreset]);
}
