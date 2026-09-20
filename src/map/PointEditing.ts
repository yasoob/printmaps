import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer, LayerGeometry } from '../domain/project';
import { isValidPosition } from '../domain/routeGeometry';
import { didPreviewMapGeometry } from './MapGeometryPreview';
import type { ProjectMutationResult } from '../domain/projectMutation';

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
export type PointEditingSession = (() => void) & {
  focusHandle: () => void;
  synchronizeLayer: (layer: ContentLayer) => boolean;
};

const createMapLibreMarker: MarkerFactory = (element) => (
  new Marker({ draggable: true, element }) as unknown as PointEditingMarker
);

function normalizedCoordinate(longitude: number, latitude: number): [number, number] | null {
  if (!isValidPosition(longitude, latitude)) return null;
  return [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))];
}

function emptySession(): PointEditingSession {
  const cleanup = (() => {}) as PointEditingSession;
  cleanup.focusHandle = () => {};
  cleanup.synchronizeLayer = () => false;
  return cleanup;
}

export function isEditablePoint(layer: ContentLayer): layer is ContentLayer & { geometry: PointGeometry } {
  return layer.type === 'poi'
    && layer.visible
    && !layer.locked
    && layer.geometry?.type === 'Point';
}

export function installPointEditing(
  map: PointEditingMap,
  layer: ContentLayer,
  onCommit: (coordinate: readonly [number, number]) => ProjectMutationResult,
  createMarker: MarkerFactory = createMapLibreMarker,
): PointEditingSession {
  if (!isEditablePoint(layer)) return emptySession();
  let currentLayer = layer;
  let original = [...layer.geometry.coordinates] as [number, number];
  const updateSource = (coordinate: readonly [number, number]) =>
    didPreviewMapGeometry(map, currentLayer, { type: 'Point', coordinates: [coordinate[0], coordinate[1]] });
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
  const commit = (coordinate: readonly [number, number]) => {
    const result = onCommit(coordinate);
    if (result.ok) {original = [coordinate[0], coordinate[1]];} else {
      marker.setLngLat(original);
      updateSource(original);
    }
    hasPreview = false;
  };

  const preview = () => {
    const { lng, lat } = marker.getLngLat();
    const coordinate = normalizedCoordinate(lng, lat);
    if (!coordinate || !updateSource(coordinate)) return null;
    hasPreview = true;
    return coordinate;
  };

  marker.on('drag', () => { preview(); });
  marker.on('dragend', () => {
    const coordinate = preview();
    if (!coordinate) {
      marker.setLngLat(original);
      updateSource(original);
      hasPreview = false;
      return;
    }
    commit(coordinate);
  });
  element.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
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
    if (!updateSource(coordinate)) return;
    commit(coordinate);
  });

  const cleanup = (() => {
    if (hasPreview) updateSource(original);
    marker.remove();
  }) as PointEditingSession;
  cleanup.focusHandle = () => element.focus();
  cleanup.synchronizeLayer = (next) => {
    if (next.id !== currentLayer.id || !isEditablePoint(next)) return false;
    currentLayer = next;
    original = [...next.geometry.coordinates];
    marker.setLngLat(original);
    element.setAttribute('aria-label', `Move ${next.name}`);
    element.title = `Move ${next.name} · Arrow keys nudge`;
    const size = next.appearance?.kind === 'poi' ? next.appearance.size : 16;
    element.style.setProperty('--studio-poi-move-size', `${Math.max(28, size + 12)}px`);
    hasPreview = false;
    return true;
  };
  return cleanup;
}
