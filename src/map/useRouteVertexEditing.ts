import { useLayoutEffect, useRef, type RefObject } from 'react';
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

type EditableRouteLayer = ContentLayer & {
  geometry: Extract<
    NonNullable<ContentLayer['geometry']>,
    { type: 'Arc' | 'LineString' }
  >;
};

function isEditableRouteLayer(
  layer: ContentLayer | undefined,
): layer is EditableRouteLayer {
  return layer?.type === 'route'
    && !layer.locked
    && layer.visible
    && (layer.geometry?.type === 'LineString' || layer.geometry?.type === 'Arc');
}

function routeEditingPointCount(layer: EditableRouteLayer) {
  if (layer.geometry.type === 'Arc') return layer.geometry.anchors.length;
  if (layer.provenance?.service === 'directions-v5') {
    return layer.provenance.waypoints.length;
  }
  return layer.geometry.coordinates.length;
}

function routeEditingSessionKey(layer: ContentLayer | undefined) {
  if (!isEditableRouteLayer(layer)) return null;
  const pointCount = routeEditingPointCount(layer);
  const midpointCount = layer.geometry.type === 'Arc'
    ? layer.geometry.curvatures.length
    : 0;
  return `${layer.id}:${layer.geometry.type}:${pointCount}:${midpointCount}:${layer.provenance?.service ?? ''}`;
}

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
  const editingSession = useRef<ReturnType<typeof installRouteVertexEditing> | null>(null);
  const pendingFocus = useRef<{ layerId: string; vertexIndex: number } | null>(null);
  const canCommit = typeof onRouteVertexChange === 'function';
  const selectedLayer = layers.find((layer) => layer.id === selectedId);
  const selectedLayerRef = useRef(selectedLayer);
  const sessionKey = routeEditingSessionKey(selectedLayer);
  useLayoutEffect(() => {
    routeVertexChange.current = onRouteVertexChange;
    routeVertexInsert.current = onRouteVertexInsert;
    routeVertexPreview.current = onRouteVertexPreview;
  }, [onRouteVertexChange, onRouteVertexInsert, onRouteVertexPreview]);
  useLayoutEffect(() => {
    selectedLayerRef.current = selectedLayer;
  }, [selectedLayer]);

  useLayoutEffect(() => {
    const activeMap = map.current;
    const currentLayer = selectedLayerRef.current;
    if (!activeMap || !currentLayer || !canCommit || !sessionKey) {
      pendingFocus.current = null;
      return;
    }
    const editing = installRouteVertexEditing(
      activeMap,
      currentLayer,
      (vertexIndex, coordinate) => routeVertexChange.current?.(currentLayer.id, vertexIndex, coordinate),
      {
        onInsert: (segmentIndex) => routeVertexInsert.current?.(currentLayer.id, segmentIndex),
        onPreview: (coordinates) => routeVertexPreview.current?.(coordinates),
      },
    );
    editingSession.current = editing;
    if (pendingFocus.current?.layerId === currentLayer.id) {
      editing.focusVertex(pendingFocus.current.vertexIndex);
    }
    pendingFocus.current = null;
    return () => {
      const activeElement = globalThis.document.activeElement;
      const focusedIndex = activeElement instanceof HTMLElement
        ? activeElement.dataset.routeVertexIndex
        : undefined;
      if (focusedIndex !== undefined) {
        pendingFocus.current = { layerId: currentLayer.id, vertexIndex: Number(focusedIndex) };
      } else if (activeElement instanceof HTMLElement && activeElement.dataset.routeSegmentIndex !== undefined) {
        pendingFocus.current = {
          layerId: currentLayer.id,
          vertexIndex: Number(activeElement.dataset.routeSegmentIndex) + 1,
        };
      }
      if (editingSession.current === editing) editingSession.current = null;
      editing();
    };
  }, [canCommit, map, sessionKey, stylePreset]);
  useLayoutEffect(() => {
    if (selectedLayer) editingSession.current?.synchronizeLayer(selectedLayer);
  }, [selectedLayer]);
}
