import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer, MapStylePreset } from '../domain/project';
import { installRouteVertexEditing } from './RouteVertexEditing';

type RouteVertexEditingOptions = {
  layers: ContentLayer[];
  map: RefObject<MapLibreMap | null>;
  onRouteVertexChange?: (id: string, vertexIndex: number, coordinate: readonly [number, number]) => void;
  onRouteVertexInsert?: (id: string, segmentIndex: number) => void;
  onRouteVertexPreview?: (coordinates: [number, number][]) => boolean;
  selectedId: string | null;
  stylePreset: MapStylePreset;
};

export function useRouteVertexEditing({
  layers,
  map,
  onRouteVertexChange,
  onRouteVertexInsert,
  onRouteVertexPreview,
  selectedId,
  stylePreset,
}: RouteVertexEditingOptions) {
  const routeVertexChange = useRef(onRouteVertexChange);
  const routeVertexInsert = useRef(onRouteVertexInsert);
  const routeVertexPreview = useRef(onRouteVertexPreview);
  const pendingFocus = useRef<{ layerId: string; vertexIndex: number } | null>(null);
  const canCommit = typeof onRouteVertexChange === 'function';
  useLayoutEffect(() => {
    routeVertexChange.current = onRouteVertexChange;
    routeVertexInsert.current = onRouteVertexInsert;
    routeVertexPreview.current = onRouteVertexPreview;
  }, [onRouteVertexChange, onRouteVertexInsert, onRouteVertexPreview]);

  useEffect(() => {
    const activeMap = map.current;
    const selectedLayer = layers.find((layer) => layer.id === selectedId);
    if (!activeMap || !selectedLayer || !canCommit) {
      pendingFocus.current = null;
      return;
    }
    const editing = installRouteVertexEditing(
      activeMap,
      selectedLayer,
      (vertexIndex, coordinate) => routeVertexChange.current?.(selectedLayer.id, vertexIndex, coordinate),
      {
        onInsert: (segmentIndex) => routeVertexInsert.current?.(selectedLayer.id, segmentIndex),
        onPreview: (coordinates) => routeVertexPreview.current?.(coordinates),
      },
    );
    if (pendingFocus.current?.layerId === selectedLayer.id) {
      editing.focusVertex(pendingFocus.current.vertexIndex);
    }
    pendingFocus.current = null;
    return () => {
      const activeElement = globalThis.document.activeElement;
      const focusedIndex = activeElement instanceof HTMLElement
        ? activeElement.dataset.routeVertexIndex
        : undefined;
      if (focusedIndex !== undefined) {
        pendingFocus.current = { layerId: selectedLayer.id, vertexIndex: Number(focusedIndex) };
      } else if (activeElement instanceof HTMLElement && activeElement.dataset.routeSegmentIndex !== undefined) {
        pendingFocus.current = {
          layerId: selectedLayer.id,
          vertexIndex: Number(activeElement.dataset.routeSegmentIndex) + 1,
        };
      }
      editing();
    };
  }, [canCommit, layers, map, selectedId, stylePreset]);
}
