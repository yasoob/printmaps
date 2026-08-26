import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer, MapStylePreset, ShapeGeometry } from '../domain/project';
import { installShapeTransformEditing } from './ShapeTransformEditing';

type ShapeTransformEditingOptions = {
  active: boolean;
  layers: ContentLayer[];
  map: RefObject<MapLibreMap | null>;
  onShapeGeometryChange?: (id: string, geometry: ShapeGeometry) => void;
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
    const editing = installShapeTransformEditing(
      activeMap,
      selectedLayer,
      (geometry) => shapeGeometryChange.current?.(selectedLayer.id, geometry),
    );
    if (pendingFocus.current?.layerId === selectedLayer.id) editing.focusHandle(pendingFocus.current.role);
    pendingFocus.current = null;
    return () => {
      const activeElement = globalThis.document.activeElement;
      const role = activeElement instanceof HTMLElement ? activeElement.dataset.shapeTransformHandle : undefined;
      if (role) pendingFocus.current = { layerId: selectedLayer.id, role };
      editing();
    };
  }, [active, layers, map, onShapeGeometryChange, selectedId, stylePreset]);
}
