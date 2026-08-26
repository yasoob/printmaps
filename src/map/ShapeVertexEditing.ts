import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer, ShapeGeometry } from '../domain/project';
import { isValidPosition, midpointPosition } from '../domain/routeGeometry';
import { mapContentSourceId, mapGeometryForLayer } from './MapContentGeometry';

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
  const setData = (role: string | undefined, nextGeometry: ShapeGeometry) => {
    const source = map.getSource(mapContentSourceId(layer.id, role)) as { setData?: (data: unknown) => void } | undefined;
    if (typeof source?.setData !== 'function') return false;
    source.setData({ type: 'Feature', properties: { layerId: layer.id }, geometry: nextGeometry });
    return true;
  };
  const transformedLayer = { ...layer, geometry };
  if (!setData(undefined, mapGeometryForLayer(transformedLayer) as ShapeGeometry)) return false;
  if (layer.appearance?.kind === 'shape' && layer.appearance.invert) return setData('outline', geometry);
  return true;
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

export function installShapeVertexEditing(
  map: ShapeVertexMap,
  layer: ContentLayer,
  onCommit: (geometry: ShapeGeometry) => void,
  createMarker: MarkerFactory = createMapLibreMarker,
): ShapeVertexEditingSession {
  const empty = (() => {}) as ShapeVertexEditingSession;
  empty.focusPoint = () => {};
  if (!canDirectlyEditShapePoints(layer)) return empty;
  const geometry = structuredClone(layer.geometry);
  const markers: ShapeVertexMarker[] = [], pointMarkers = new Map<PointKey, ShapeVertexMarker>();
  const midpointMarkers = new Map<PointKey, ShapeVertexMarker>();
  let hasUncommittedPreview = false;

  const updateAdjacentMidpoints = (ringIndex: number, vertexIndex: number, nextGeometry: typeof geometry) => {
    const ring = nextGeometry.coordinates[ringIndex];
    const pointCount = ring.length - 1;
    const adjacentEdgeIndexes = [(vertexIndex - 1 + pointCount) % pointCount, vertexIndex];
    for (const edgeIndex of adjacentEdgeIndexes) {
      midpointMarkers.get(pointKey(ringIndex, edgeIndex))?.setLngLat(midpointPosition(ring[edgeIndex], ring[(edgeIndex + 1) % pointCount]));
    }
  };

  for (const [ringIndex, ring] of geometry.coordinates.entries()) {
    const editableCoordinates = ring.slice(0, -1);
    for (const [vertexIndex, coordinate] of editableCoordinates.entries()) {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'shape-vertex-marker';
      element.dataset.shapeRingIndex = String(ringIndex);
      element.dataset.shapeVertexIndex = String(vertexIndex);
      element.setAttribute('aria-label', `Drag area point ${vertexIndex + 1}`);
      element.title = `Drag area point ${vertexIndex + 1} · Arrow keys nudge · Delete removes`;
      const marker = createMarker(element).setLngLat(coordinate).addTo(map);
      pointMarkers.set(pointKey(ringIndex, vertexIndex), marker);
      const preview = () => {
        const { lng, lat } = marker.getLngLat();
        const nextCoordinate = normalizedCoordinate(lng, lat);
        const next = nextCoordinate ? movedGeometry(geometry, ringIndex, vertexIndex, nextCoordinate) : null;
        if (!next || !didUpdateSourceGeometry(map, layer, next)) return null;
        updateAdjacentMidpoints(ringIndex, vertexIndex, next);
        hasUncommittedPreview = true;
        return next;
      };
      marker.on('drag', () => { preview(); });
      marker.on('dragend', () => {
        const next = preview();
        if (!next) {
          marker.setLngLat(coordinate);
          didUpdateSourceGeometry(map, layer, geometry);
          hasUncommittedPreview = false;
          return;
        }
        hasUncommittedPreview = false;
        onCommit(next);
      });
      element.addEventListener('keydown', (event) => {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          const next = removedGeometry(geometry, ringIndex, vertexIndex);
          if (!next) return;
          event.preventDefault();
          event.stopPropagation();
          onCommit(next);
          return;
        }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const nextCoordinate = nudgeCoordinate(map, marker, event.key, event.shiftKey);
        const next = nextCoordinate ? movedGeometry(geometry, ringIndex, vertexIndex, nextCoordinate) : null;
        if (!next || !didUpdateSourceGeometry(map, layer, next)) return;
        marker.setLngLat(nextCoordinate!);
        hasUncommittedPreview = false;
        onCommit(next);
      });
      markers.push(marker);
    }
  }

  for (const [ringIndex, ring] of geometry.coordinates.entries()) {
    const pointCount = ring.length - 1;
    for (let vertexIndex = 0; vertexIndex < pointCount; vertexIndex += 1) {
      const initial = midpointPosition(ring[vertexIndex], ring[(vertexIndex + 1) % pointCount]);
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'shape-midpoint-marker';
      element.setAttribute('aria-label', `Add area point between ${vertexIndex + 1} and ${(vertexIndex + 1) % pointCount + 1}`);
      element.title = 'Drag or click to add an area point';
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
        if (next && didUpdateSourceGeometry(map, layer, next)) hasUncommittedPreview = true;
      });
      marker.on('dragend', () => {
        const next = geometryAtMarker();
        if (!next || !didUpdateSourceGeometry(map, layer, next)) return;
        hasUncommittedPreview = false;
        onCommit(next);
      });
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        if (wasDragged) { wasDragged = false; return; }
        const next = insertedGeometry(geometry, ringIndex, vertexIndex, initial);
        if (next) onCommit(next);
      });
      markers.push(marker);
    }
  }

  const cleanup = (() => {
    if (hasUncommittedPreview) didUpdateSourceGeometry(map, layer, geometry);
    for (const marker of markers) marker.remove();
  }) as ShapeVertexEditingSession;
  cleanup.focusPoint = (ringIndex, vertexIndex) => pointMarkers.get(pointKey(ringIndex, vertexIndex))?.getElement().focus();
  return cleanup;
}
