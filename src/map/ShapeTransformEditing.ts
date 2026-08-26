import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer, ShapeGeometry } from '../domain/project';
import { isValidPosition } from '../domain/routeGeometry';
import { mapContentSourceId, mapGeometryForLayer } from './MapContentGeometry';

export type ShapeTransformMarker = {
  addTo: (map: ShapeTransformMap) => ShapeTransformMarker;
  getElement: () => HTMLElement;
  getLngLat: () => { lng: number; lat: number };
  on: (event: 'drag' | 'dragend', handler: () => void) => ShapeTransformMarker;
  remove: () => void;
  setLngLat: (coordinate: readonly [number, number]) => ShapeTransformMarker;
};

type ScreenPoint = { x: number; y: number };
type ShapeTransformMap = Pick<MapLibreMap, 'getSource' | 'project' | 'unproject'>;
type MarkerFactory = (element: HTMLElement) => ShapeTransformMarker;
type ResizeRole = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
type HandleRole = 'move' | ResizeRole;
export type ShapeTransformEditingSession = (() => void) & {
  focusHandle: (role: string) => void;
};

const MINIMUM_RESIZE_PIXELS = 8;
const createMapLibreMarker: MarkerFactory = (element) => (
  new Marker({ draggable: true, element }) as unknown as ShapeTransformMarker
);

function normalizedCoordinate(map: ShapeTransformMap, point: ScreenPoint): [number, number] | null {
  const { lng, lat } = map.unproject([point.x, point.y]);
  if (!isValidPosition(lng, lat)) return null;
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
}

function positions(geometry: ShapeGeometry): [number, number][] {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flat().flat() as [number, number][];
}

function mapGeometry(
  geometry: ShapeGeometry,
  transform: (point: ScreenPoint) => ScreenPoint,
  map: ShapeTransformMap,
): ShapeGeometry | null {
  const mapRing = (ring: [number, number][]) => {
    const transformed: [number, number][] = [];
    for (const coordinate of ring) {
      const next = normalizedCoordinate(map, transform(map.project(coordinate)));
      if (!next) return null;
      transformed.push(next);
    }
    return transformed;
  };
  const mapPolygon = (polygon: [number, number][][]) => {
    const transformed: [number, number][][] = [];
    for (const ring of polygon) {
      const next = mapRing(ring);
      if (!next) return null;
      transformed.push(next);
    }
    return transformed;
  };
  if (geometry.type === 'Polygon') {
    const coordinates = mapPolygon(geometry.coordinates);
    return coordinates ? { type: 'Polygon', coordinates } : null;
  }
  const coordinates: [number, number][][][] = [];
  for (const polygon of geometry.coordinates) {
    const next = mapPolygon(polygon);
    if (!next) return null;
    coordinates.push(next);
  }
  return { type: 'MultiPolygon', coordinates };
}

function projectedBounds(map: ShapeTransformMap, geometry: ShapeGeometry) {
  const projected = positions(geometry).map((coordinate) => map.project(coordinate));
  const xs = projected.map(({ x }) => x);
  const ys = projected.map(({ y }) => y);
  return {
    left: Math.min(...xs), right: Math.max(...xs),
    top: Math.min(...ys), bottom: Math.max(...ys),
  };
}

function handlePoint(role: HandleRole, bounds: ReturnType<typeof projectedBounds>): ScreenPoint {
  if (role === 'move') return { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
  return {
    x: role.endsWith('left') ? bounds.left : bounds.right,
    y: role.startsWith('top') ? bounds.top : bounds.bottom,
  };
}

function oppositePoint(role: ResizeRole, bounds: ReturnType<typeof projectedBounds>): ScreenPoint {
  return {
    x: role.endsWith('left') ? bounds.right : bounds.left,
    y: role.startsWith('top') ? bounds.bottom : bounds.top,
  };
}

type TransformInput = {
  bounds: ReturnType<typeof projectedBounds>;
  currentHandle: ScreenPoint;
  geometry: ShapeGeometry;
  map: ShapeTransformMap;
  originalHandle: ScreenPoint;
  role: HandleRole;
};

function transformedGeometry(input: TransformInput): ShapeGeometry | null {
  const { bounds, currentHandle, geometry, map, originalHandle, role } = input;
  if (role === 'move') {
    const delta = { x: currentHandle.x - originalHandle.x, y: currentHandle.y - originalHandle.y };
    return mapGeometry(geometry, ({ x, y }) => ({ x: x + delta.x, y: y + delta.y }), map);
  }
  const fixed = oppositePoint(role, bounds);
  const originalWidth = originalHandle.x - fixed.x;
  const originalHeight = originalHandle.y - fixed.y;
  const nextWidth = currentHandle.x - fixed.x;
  const nextHeight = currentHandle.y - fixed.y;
  if (
    Math.abs(nextWidth) < MINIMUM_RESIZE_PIXELS
    || Math.abs(nextHeight) < MINIMUM_RESIZE_PIXELS
    || Math.sign(nextWidth) !== Math.sign(originalWidth)
    || Math.sign(nextHeight) !== Math.sign(originalHeight)
  ) return null;
  const scaleX = nextWidth / originalWidth;
  const scaleY = nextHeight / originalHeight;
  return mapGeometry(geometry, ({ x, y }) => ({
    x: fixed.x + (x - fixed.x) * scaleX,
    y: fixed.y + (y - fixed.y) * scaleY,
  }), map);
}

function didUpdateSourceGeometry(map: ShapeTransformMap, layer: ContentLayer, geometry: ShapeGeometry): boolean {
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

type EditableShapeLayer = ContentLayer & { geometry: ShapeGeometry };

function isEditableShapeLayer(layer: ContentLayer): layer is EditableShapeLayer {
  return layer.type === 'shape'
    && !layer.locked
    && layer.visible
    && (layer.geometry?.type === 'Polygon' || layer.geometry?.type === 'MultiPolygon');
}

const HANDLE_LABELS: Record<HandleRole, string> = {
  move: 'Move selected shape',
  'top-left': 'Resize selected shape from top left',
  'top-right': 'Resize selected shape from top right',
  'bottom-right': 'Resize selected shape from bottom right',
  'bottom-left': 'Resize selected shape from bottom left',
};

function emptyShapeTransformSession(): ShapeTransformEditingSession {
  const cleanup = (() => {}) as ShapeTransformEditingSession;
  cleanup.focusHandle = () => {};
  return cleanup;
}

export function installShapeTransformEditing(
  map: ShapeTransformMap,
  layer: ContentLayer,
  onCommit: (geometry: ShapeGeometry) => void,
  createMarker: MarkerFactory = createMapLibreMarker,
): ShapeTransformEditingSession {
  if (!isEditableShapeLayer(layer)) return emptyShapeTransformSession();

  const geometry = structuredClone(layer.geometry);
  const bounds = projectedBounds(map, geometry);
  if (!(bounds.right > bounds.left) || !(bounds.bottom > bounds.top)) return emptyShapeTransformSession();
  const roles: HandleRole[] = ['move', 'top-left', 'top-right', 'bottom-right', 'bottom-left'];
  const markers: ShapeTransformMarker[] = [];
  const markersByRole = new Map<HandleRole, ShapeTransformMarker>();
  let hasUncommittedPreview = false;
  const positionMarkers = (nextGeometry: ShapeGeometry, activeRole?: HandleRole) => {
    const nextBounds = projectedBounds(map, nextGeometry);
    for (const nextRole of roles) {
      if (nextRole === activeRole) continue;
      const nextMarker = markersByRole.get(nextRole);
      const coordinate = normalizedCoordinate(map, handlePoint(nextRole, nextBounds));
      if (nextMarker && coordinate) nextMarker.setLngLat(coordinate);
    }
  };

  for (const role of roles) {
    const originalPoint = handlePoint(role, bounds);
    const originalCoordinate = normalizedCoordinate(map, originalPoint);
    if (!originalCoordinate) continue;
    const element = document.createElement('button');
    element.type = 'button';
    element.className = `shape-transform-marker is-${role}`;
    element.dataset.shapeTransformHandle = role;
    element.setAttribute('aria-label', HANDLE_LABELS[role]);
    element.title = `${HANDLE_LABELS[role]} · Arrow keys nudge`;
    const marker = createMarker(element).setLngLat(originalCoordinate).addTo(map);
    markersByRole.set(role, marker);
    const preview = () => {
      const referenceBounds = projectedBounds(map, geometry);
      const referenceHandle = handlePoint(role, referenceBounds);
      const current = map.project([marker.getLngLat().lng, marker.getLngLat().lat]);
      const transformed = transformedGeometry({
        bounds: referenceBounds,
        currentHandle: current,
        geometry,
        map,
        originalHandle: referenceHandle,
        role,
      });
      if (!transformed || !didUpdateSourceGeometry(map, layer, transformed)) return null;
      positionMarkers(transformed, role);
      hasUncommittedPreview = true;
      return transformed;
    };
    marker.on('drag', () => { preview(); });
    marker.on('dragend', () => {
      const transformed = preview();
      if (!transformed) {
        positionMarkers(geometry);
        didUpdateSourceGeometry(map, layer, geometry);
        hasUncommittedPreview = false;
        return;
      }
      hasUncommittedPreview = false;
      onCommit(transformed);
    });
    element.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const point = map.project([marker.getLngLat().lng, marker.getLngLat().lat]);
      const step = event.shiftKey ? 1 : 8;
      switch (event.key) {
        case 'ArrowLeft': { point.x -= step; break; }
        case 'ArrowRight': { point.x += step; break; }
        case 'ArrowUp': { point.y -= step; break; }
        case 'ArrowDown': { point.y += step; break; }
      }
      const coordinate = normalizedCoordinate(map, point);
      if (!coordinate) return;
      marker.setLngLat(coordinate);
      const transformed = preview();
      if (!transformed) {
        positionMarkers(geometry);
        return;
      }
      hasUncommittedPreview = false;
      onCommit(transformed);
    });
    markers.push(marker);
  }

  const cleanup = (() => {
    if (hasUncommittedPreview) didUpdateSourceGeometry(map, layer, geometry);
    for (const marker of markers) marker.remove();
  }) as ShapeTransformEditingSession;
  cleanup.focusHandle = (role) => markersByRole.get(role as HandleRole)?.getElement().focus();
  return cleanup;
}
