import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';
import { isValidPosition } from '../domain/routeGeometry';
import { mapContentSourceId } from './MapContentGeometry';

export type RouteVertexMarker = {
  addTo: (map: RouteVertexMap) => RouteVertexMarker;
  getElement: () => HTMLElement;
  getLngLat: () => { lng: number; lat: number };
  on: (event: 'drag' | 'dragend', handler: () => void) => RouteVertexMarker;
  remove: () => void;
  setLngLat: (coordinate: readonly [number, number]) => RouteVertexMarker;
};

type RouteVertexMap = Pick<MapLibreMap, 'getSource' | 'project' | 'unproject'>;

type MarkerFactory = (element: HTMLElement) => RouteVertexMarker;

export type RouteVertexEditingSession = (() => void) & {
  focusVertex: (vertexIndex: number) => void;
};

const createMapLibreMarker: MarkerFactory = (element) => (
  new Marker({ draggable: true, element }) as unknown as RouteVertexMarker
);

function normalizedMapCoordinate(longitude: number, latitude: number): [number, number] | null {
  if (!isValidPosition(longitude, latitude)) return null;
  return [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))];
}

function didSetRouteSourceGeometry(
  map: RouteVertexMap,
  layerId: string,
  coordinates: readonly (readonly [number, number])[],
): boolean {
  try {
    const source = map.getSource(mapContentSourceId(layerId)) as {
      setData?: (data: unknown) => void;
    } | undefined;
    if (typeof source?.setData !== 'function') return false;
    source.setData({
      type: 'Feature',
      properties: { layerId },
      geometry: {
        type: 'LineString',
        coordinates: coordinates.map((coordinate) => [...coordinate]),
      },
    });
    return true;
  } catch {
    return false;
  }
}

export function installRouteVertexEditing(
  map: RouteVertexMap,
  layer: ContentLayer,
  onCommit: (vertexIndex: number, coordinate: readonly [number, number]) => void,
  createMarker: MarkerFactory = createMapLibreMarker,
): RouteVertexEditingSession {
  if (
    layer.type !== 'route'
    || layer.locked
    || !layer.visible
    || layer.geometry?.type !== 'LineString'
  ) {
    const emptySession = (() => {}) as RouteVertexEditingSession;
    emptySession.focusVertex = () => {};
    return emptySession;
  }

  const canonicalCoordinates = layer.geometry.coordinates.map((coordinate) => [...coordinate] as [number, number]);
  const markers: RouteVertexMarker[] = [];
  let hasUncommittedPreview = false;
  const preview = (vertexIndex: number, coordinate: readonly [number, number]) => {
    const coordinates = canonicalCoordinates.map((candidate, index) => (
      index === vertexIndex ? [coordinate[0], coordinate[1]] as [number, number] : candidate
    ));
    const didSucceed = didSetRouteSourceGeometry(map, layer.id, coordinates);
    hasUncommittedPreview ||= didSucceed;
    return didSucceed;
  };

  for (const [vertexIndex, coordinate] of canonicalCoordinates.entries()) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'route-vertex-marker';
    element.dataset.routeVertexIndex = String(vertexIndex);
    element.setAttribute('aria-label', `Drag route vertex ${vertexIndex + 1}`);
    element.title = `Drag route vertex ${vertexIndex + 1} · Arrow keys nudge`;
    const marker = createMarker(element).setLngLat(coordinate).addTo(map);
    marker.on('drag', () => {
      const { lng, lat } = marker.getLngLat();
      const coordinate = normalizedMapCoordinate(lng, lat);
      if (coordinate) preview(vertexIndex, coordinate);
    });
    marker.on('dragend', () => {
      const { lng, lat } = marker.getLngLat();
      const nextCoordinate = normalizedMapCoordinate(lng, lat);
      if (!nextCoordinate || !preview(vertexIndex, nextCoordinate)) {
        marker.setLngLat(coordinate);
        didSetRouteSourceGeometry(map, layer.id, canonicalCoordinates);
        hasUncommittedPreview = false;
        return;
      }
      hasUncommittedPreview = false;
      onCommit(vertexIndex, nextCoordinate);
    });
    element.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const currentCoordinate = marker.getLngLat();
      const point = map.project([currentCoordinate.lng, currentCoordinate.lat]);
      const step = event.shiftKey ? 1 : 8;
      switch (event.key) {
        case 'ArrowLeft': { point.x -= step; break; }
        case 'ArrowRight': { point.x += step; break; }
        case 'ArrowUp': { point.y -= step; break; }
        case 'ArrowDown': { point.y += step; break; }
      }
      const next = map.unproject(point);
      const nextCoordinate = normalizedMapCoordinate(next.lng, next.lat);
      if (!nextCoordinate || !preview(vertexIndex, nextCoordinate)) return;
      marker.setLngLat(nextCoordinate);
      hasUncommittedPreview = false;
      onCommit(vertexIndex, nextCoordinate);
    });
    markers.push(marker);
  }

  const cleanup = (() => {
    if (hasUncommittedPreview) didSetRouteSourceGeometry(map, layer.id, canonicalCoordinates);
    for (const marker of markers) marker.remove();
  }) as RouteVertexEditingSession;
  cleanup.focusVertex = (vertexIndex) => markers[vertexIndex]?.getElement().focus();
  return cleanup;
}
