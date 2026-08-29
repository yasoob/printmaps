import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer, LayerGeometry } from '../domain/project';
import { isValidPosition } from '../domain/routeGeometry';
import { mapContentSourceId } from './MapContentGeometry';

type PointGeometry = Extract<LayerGeometry, { type: 'Point' }>;
type PointEditingMap = Pick<MapLibreMap, 'getSource' | 'project' | 'unproject'>;

export type PointEditingMarker = {
  addTo: (map: PointEditingMap) => PointEditingMarker;
  getElement: () => HTMLElement;
  getLngLat: () => { lng: number; lat: number };
  on: (event: 'drag' | 'dragend', handler: () => void) => PointEditingMarker;
  remove: () => void;
  setLngLat: (coordinate: readonly [number, number]) => PointEditingMarker;
};

type MarkerFactory = (element: HTMLElement) => PointEditingMarker;
export type PointEditingSession = (() => void) & { focusHandle: () => void };

const createMapLibreMarker: MarkerFactory = (element) => (
  new Marker({ draggable: true, element }) as unknown as PointEditingMarker
);

function normalizedCoordinate(longitude: number, latitude: number): [number, number] | null {
  if (!isValidPosition(longitude, latitude)) return null;
  return [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))];
}

function didSetPointSourceGeometry(
  map: PointEditingMap,
  layerId: string,
  coordinate: readonly [number, number],
) {
  try {
    const source = map.getSource(mapContentSourceId(layerId)) as { setData?: (data: unknown) => void } | undefined;
    if (typeof source?.setData !== 'function') return false;
    source.setData({
      type: 'Feature',
      properties: { layerId },
      geometry: { type: 'Point', coordinates: [...coordinate] },
    });
    return true;
  } catch {
    return false;
  }
}

function emptySession(): PointEditingSession {
  const cleanup = (() => {}) as PointEditingSession;
  cleanup.focusHandle = () => {};
  return cleanup;
}

function isEditablePoint(layer: ContentLayer): layer is ContentLayer & { geometry: PointGeometry } {
  return layer.type === 'poi'
    && layer.visible
    && !layer.locked
    && layer.geometry?.type === 'Point';
}

export function installPointEditing(
  map: PointEditingMap,
  layer: ContentLayer,
  onCommit: (coordinate: readonly [number, number]) => void,
  createMarker: MarkerFactory = createMapLibreMarker,
): PointEditingSession {
  if (!isEditablePoint(layer)) return emptySession();
  const original = [...layer.geometry.coordinates] as [number, number];
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'poi-move-marker';
  element.dataset.poiMoveHandle = layer.id;
  element.setAttribute('aria-label', `Move ${layer.name}`);
  element.title = `Move ${layer.name} · Arrow keys nudge`;
  const size = layer.appearance?.kind === 'poi' ? layer.appearance.size : 16;
  element.style.setProperty('--studio-poi-move-size', `${Math.max(28, size + 12)}px`);
  const marker = createMarker(element).setLngLat(original).addTo(map);
  let hasPreview = false;

  const preview = () => {
    const { lng, lat } = marker.getLngLat();
    const coordinate = normalizedCoordinate(lng, lat);
    if (!coordinate || !didSetPointSourceGeometry(map, layer.id, coordinate)) return null;
    hasPreview = true;
    return coordinate;
  };

  marker.on('drag', () => { preview(); });
  marker.on('dragend', () => {
    const coordinate = preview();
    if (!coordinate) {
      marker.setLngLat(original);
      didSetPointSourceGeometry(map, layer.id, original);
      hasPreview = false;
      return;
    }
    hasPreview = false;
    onCommit(coordinate);
  });
  element.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const current = marker.getLngLat();
    const point = map.project([current.lng, current.lat]);
    const step = event.shiftKey ? 1 : 8;
    switch (event.key) {
      case 'ArrowLeft': { point.x -= step; break; }
      case 'ArrowRight': { point.x += step; break; }
      case 'ArrowUp': { point.y -= step; break; }
      case 'ArrowDown': { point.y += step; break; }
    }
    const next = map.unproject(point);
    const coordinate = normalizedCoordinate(next.lng, next.lat);
    if (!coordinate) return;
    marker.setLngLat(coordinate);
    if (!didSetPointSourceGeometry(map, layer.id, coordinate)) return;
    hasPreview = false;
    onCommit(coordinate);
  });

  const cleanup = (() => {
    if (hasPreview) didSetPointSourceGeometry(map, layer.id, original);
    marker.remove();
  }) as PointEditingSession;
  cleanup.focusHandle = () => element.focus();
  return cleanup;
}
