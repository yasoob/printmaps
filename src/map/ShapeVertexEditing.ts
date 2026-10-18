import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer, ShapeGeometry } from '../domain/project';
import { isValidPosition, midpointPosition } from '../domain/routeGeometry';
import { didPreviewMapGeometry } from './MapGeometryPreview';
import { setControlTooltip } from './mapControlTooltips';

export type ShapeEditMode = 'points' | 'transform';

export type ShapeVertexMarker = {
  addTo: (map: ShapeVertexMap) => ShapeVertexMarker;
  getElement: () => HTMLElement;
  getLngLat: () => { lng: number; lat: number };
  on: (event: 'drag' | 'dragend', handler: () => void) => ShapeVertexMarker;
  remove: () => void;
  setLngLat: (coordinate: readonly [number, number]) => ShapeVertexMarker;
};

type ShapeVertexMap = Pick<MapLibreMap, 'getSource' | 'project' | 'unproject'>;
type MarkerFactory = (element: HTMLElement) => ShapeVertexMarker;
type PointKey = `${number}:${number}`;
type EditableShapeLayer = ContentLayer & { geometry: Extract<ShapeGeometry, { type: 'Polygon' }> };

export type ShapeVertexEditingSession = (() => void) & {
  focusPoint: (ringIndex: number, vertexIndex: number) => void;
  synchronizeLayer: (layer: ContentLayer) => boolean;
};

const MAX_DIRECT_AREA_POINTS = 80;
const createMapLibreMarker: MarkerFactory = (element) => (
  new Marker({ draggable: true, element }) as unknown as ShapeVertexMarker
);

function pointKey(ringIndex: number, vertexIndex: number): PointKey {
  return `${ringIndex}:${vertexIndex}`;
}

function normalizedCoordinate(longitude: number, latitude: number): [number, number] | null {
  if (!isValidPosition(longitude, latitude)) return null;
  return [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))];
}

function editablePointCount(layer: ContentLayer): number {
  if (layer.geometry?.type !== 'Polygon') return 0;
  return layer.geometry.coordinates.reduce((count, ring) => count + Math.max(0, ring.length - 1), 0);
}

export function canDirectlyEditShapePoints(layer: ContentLayer | undefined): layer is EditableShapeLayer {
  const pointCount = layer ? editablePointCount(layer) : 0;
  return layer?.type === 'shape'
    && !layer.locked
    && layer.visible
    && layer.geometry?.type === 'Polygon'
    && pointCount >= 3
    && pointCount <= MAX_DIRECT_AREA_POINTS;
}

function didUpdateSourceGeometry(
  map: ShapeVertexMap,
  layer: EditableShapeLayer,
  geometry: EditableShapeLayer['geometry'],
): boolean {
  return didPreviewMapGeometry(map, layer, geometry);
}

function movedGeometry(
  geometry: EditableShapeLayer['geometry'],
  ringIndex: number,
  vertexIndex: number,
  coordinate: readonly [number, number],
) {
  const next = structuredClone(geometry);
  const ring = next.coordinates[ringIndex];
  if (!ring || vertexIndex >= ring.length - 1) return null;
  ring[vertexIndex] = [coordinate[0], coordinate[1]];
  if (vertexIndex === 0) ring[ring.length - 1] = [coordinate[0], coordinate[1]];
  const distinct = new Set(ring.slice(0, -1).map((point) => `${point[0]},${point[1]}`));
  return distinct.size >= 3 ? next : null;
}

function insertedGeometry(
  geometry: EditableShapeLayer['geometry'],
  ringIndex: number,
  vertexIndex: number,
  coordinate: readonly [number, number],
) {
  const next = structuredClone(geometry);
  const ring = next.coordinates[ringIndex];
  if (!ring || vertexIndex >= ring.length - 1) return null;
  ring.splice(vertexIndex + 1, 0, [coordinate[0], coordinate[1]]);
  return next;
}

function removedGeometry(
  geometry: EditableShapeLayer['geometry'],
  ringIndex: number,
  vertexIndex: number,
) {
  const next = structuredClone(geometry);
  const ring = next.coordinates[ringIndex];
  if (!ring || ring.length <= 4 || vertexIndex >= ring.length - 1) return null;
  ring.splice(vertexIndex, 1);
  ring[ring.length - 1] = [...ring[0]];
  return next;
}

function nudgeCoordinate(
  map: ShapeVertexMap,
  marker: ShapeVertexMarker,
  key: string,
  isFine: boolean,
) {
  const { lng, lat } = marker.getLngLat();
  const point = map.project([lng, lat]);
  const step = isFine ? 1 : 8;
  switch (key) {
    case 'ArrowLeft': { point.x -= step; break; }
    case 'ArrowRight': { point.x += step; break; }
    case 'ArrowUp': { point.y -= step; break; }
    case 'ArrowDown': { point.y += step; break; }
  }
  const next = map.unproject(point);
  return normalizedCoordinate(next.lng, next.lat);
}

function restoreVertexHandles(
  geometry: EditableShapeLayer['geometry'],
  points: Map<PointKey, ShapeVertexMarker>,
  midpoints: Map<PointKey, ShapeVertexMarker>,
) {
  for (const [ringIndex, ring] of geometry.coordinates.entries()) {
    for (let index = 0; index < ring.length - 1; index += 1) {
      points.get(pointKey(ringIndex, index))?.setLngLat(ring[index]);
      midpoints.get(pointKey(ringIndex, index))?.setLngLat(midpointPosition(ring[index], ring[index + 1]));
    }
  }
}

function updateAdjacentMidpoints(geometry: EditableShapeLayer['geometry'], markers: Map<PointKey, ShapeVertexMarker>, ringIndex: number, vertexIndex: number) {
  const ring = geometry.coordinates[ringIndex];
  const pointCount = ring.length - 1;
  for (const edgeIndex of [(vertexIndex - 1 + pointCount) % pointCount, vertexIndex]) {
    markers.get(pointKey(ringIndex, edgeIndex))?.setLngLat(midpointPosition(ring[edgeIndex], ring[(edgeIndex + 1) % pointCount]));
  }
}

function createVertexButton(ringIndex: number, vertexIndex: number) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'shape-vertex-marker';
  element.dataset.shapeRingIndex = String(ringIndex);
  element.dataset.shapeVertexIndex = String(vertexIndex);
  element.setAttribute('aria-label', `Drag area point ${vertexIndex + 1}`);
  setControlTooltip(element, `Drag area point ${vertexIndex + 1}`, 'Arrow keys · Delete');
  return element;
}

function createMidpointButton(vertexIndex: number, pointCount: number) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'shape-midpoint-marker';
  element.setAttribute('aria-label', `Add area point between ${vertexIndex + 1} and ${(vertexIndex + 1) % pointCount + 1}`);
  setControlTooltip(element, 'Drag or click to add an area point');
  return element;
}

function emptyShapeVertexSession(): ShapeVertexEditingSession {
  const empty = (() => {}) as ShapeVertexEditingSession;
  empty.focusPoint = () => {};
  empty.synchronizeLayer = () => false;
  return empty;
}

export function installShapeVertexEditing(
  map: ShapeVertexMap,
  layer: ContentLayer,
  onCommit: (geometry: ShapeGeometry) => import('../domain/projectMutation').ProjectMutationResult,
  createMarker: MarkerFactory = createMapLibreMarker,
): ShapeVertexEditingSession {
  if (!canDirectlyEditShapePoints(layer)) return emptyShapeVertexSession();
  let currentLayer = layer, geometry = structuredClone(layer.geometry);
  const topology = geometry.coordinates.map((ring) => ring.length).join(':');
  const markers: ShapeVertexMarker[] = [], pointMarkers = new Map<PointKey, ShapeVertexMarker>();
  const midpointMarkers = new Map<PointKey, ShapeVertexMarker>();
  let hasUncommittedPreview = false;

  const commit = (next: EditableShapeLayer['geometry']) => {
    const result = onCommit(next);
    if (result.ok) geometry = structuredClone(next);
    else {
      didUpdateSourceGeometry(map, currentLayer, geometry);
      restoreVertexHandles(geometry, pointMarkers, midpointMarkers);
    }
    hasUncommittedPreview = false;
  };
  for (const [ringIndex, ring] of geometry.coordinates.entries()) {
    for (let vertexIndex = 0; vertexIndex < ring.length - 1; vertexIndex += 1) {
      const element = createVertexButton(ringIndex, vertexIndex);
      const marker = createMarker(element).setLngLat(ring[vertexIndex]).addTo(map);
      pointMarkers.set(pointKey(ringIndex, vertexIndex), marker);
      const preview = () => {
        const { lng, lat } = marker.getLngLat();
        const nextCoordinate = normalizedCoordinate(lng, lat);
        const next = nextCoordinate ? movedGeometry(geometry, ringIndex, vertexIndex, nextCoordinate) : null;
        if (!next || !didUpdateSourceGeometry(map, currentLayer, next)) return null;
        updateAdjacentMidpoints(next, midpointMarkers, ringIndex, vertexIndex);
        hasUncommittedPreview = true;
        return next;
      };
      marker.on('drag', () => { preview(); });
      marker.on('dragend', () => {
        const next = preview();
        if (!next) {
          marker.setLngLat(geometry.coordinates[ringIndex][vertexIndex]);
          didUpdateSourceGeometry(map, currentLayer, geometry);
          hasUncommittedPreview = false;
          return;
        }
        hasUncommittedPreview = false;
        commit(next);
      });
      element.addEventListener('keydown', (event) => {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          const next = removedGeometry(geometry, ringIndex, vertexIndex);
          if (!next) return;
          event.preventDefault();
          event.stopPropagation();
          commit(next);
          return;
        }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const nextCoordinate = nudgeCoordinate(map, marker, event.key, event.shiftKey);
        const next = nextCoordinate ? movedGeometry(geometry, ringIndex, vertexIndex, nextCoordinate) : null;
        if (!next || !didUpdateSourceGeometry(map, currentLayer, next)) return;
        marker.setLngLat(nextCoordinate!);
        updateAdjacentMidpoints(next, midpointMarkers, ringIndex, vertexIndex);
        hasUncommittedPreview = false;
        commit(next);
      });
      markers.push(marker);
    }
  }

  for (const [ringIndex, ring] of geometry.coordinates.entries()) {
    const pointCount = ring.length - 1;
    for (let vertexIndex = 0; vertexIndex < pointCount; vertexIndex += 1) {
      const initial = midpointPosition(ring[vertexIndex], ring[(vertexIndex + 1) % pointCount]);
      const element = createMidpointButton(vertexIndex, pointCount);
      const marker = createMarker(element).setLngLat(initial).addTo(map);
      midpointMarkers.set(pointKey(ringIndex, vertexIndex), marker);
      let wasDragged = false;
      const geometryAtMarker = () => {
        const { lng, lat } = marker.getLngLat();
        const coordinate = normalizedCoordinate(lng, lat);
        return coordinate ? insertedGeometry(geometry, ringIndex, vertexIndex, coordinate) : null;
      };
      marker.on('drag', () => {
        wasDragged = true;
        const next = geometryAtMarker();
        if (next && didUpdateSourceGeometry(map, currentLayer, next)) hasUncommittedPreview = true;
      });
      marker.on('dragend', () => {
        const next = geometryAtMarker();
        if (!next || !didUpdateSourceGeometry(map, currentLayer, next)) return;
        hasUncommittedPreview = false;
        commit(next);
      });
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        if (wasDragged) { wasDragged = false; return; }
        const ring = geometry.coordinates[ringIndex];
        const next = insertedGeometry(geometry, ringIndex, vertexIndex, midpointPosition(ring[vertexIndex], ring[vertexIndex + 1]));
        if (next) commit(next);
      });
      markers.push(marker);
    }
  }

  const cleanup = (() => {
    if (hasUncommittedPreview) didUpdateSourceGeometry(map, currentLayer, geometry);
    for (const marker of markers) marker.remove();
  }) as ShapeVertexEditingSession;
  cleanup.focusPoint = (ringIndex, vertexIndex) => pointMarkers.get(pointKey(ringIndex, vertexIndex))?.getElement().focus();
  cleanup.synchronizeLayer = (next) => {
    if (next.id !== currentLayer.id || !canDirectlyEditShapePoints(next)
      || next.geometry.coordinates.map((ring) => ring.length).join(':') !== topology) return false;
    currentLayer = next;
    geometry = structuredClone(next.geometry);
    restoreVertexHandles(geometry, pointMarkers, midpointMarkers);
    hasUncommittedPreview = false;
    return true;
  };
  return cleanup;
}
