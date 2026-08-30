import {
  arcSegmentPoint,
  createArcGeometry,
  type ArcGeometry,
} from './routeArcGeometry';
import { MAX_MERCATOR_LATITUDE, type ContentLayer } from './project';

export function isValidPosition(longitude: number, latitude: number) {
  return Number.isFinite(longitude)
    && Number.isFinite(latitude)
    && longitude >= -180
    && longitude <= 180
    && latitude >= -MAX_MERCATOR_LATITUDE
    && latitude <= MAX_MERCATOR_LATITUDE;
}

export function midpointPosition(
  start: readonly [number, number],
  end: readonly [number, number],
): [number, number] {
  const directLongitudeDelta = end[0] - start[0];
  const midpointLongitude = Math.abs(directLongitudeDelta) <= 180
    ? (start[0] + end[0]) / 2
    : start[0] + (((directLongitudeDelta + 540) % 360) - 180) / 2;
  const normalizedLongitude = midpointLongitude > 180 ? midpointLongitude - 360 : midpointLongitude;
  return [
    Number(normalizedLongitude.toFixed(6)),
    Number(((start[1] + end[1]) / 2).toFixed(6)),
  ];
}

function routePositions(layer: ContentLayer): readonly (readonly [number, number])[] | null {
  if (layer.geometry?.type === 'LineString') return layer.geometry.coordinates;
  if (layer.geometry?.type === 'Arc') return layer.geometry.anchors;
  return null;
}

type EditableRouteGeometry = Extract<
NonNullable<ContentLayer['geometry']>,
{ type: 'Arc' | 'LineString' }
>;

function editableRouteGeometry(layer: ContentLayer | undefined): EditableRouteGeometry | null {
  const geometry = layer?.type === 'route' ? layer.geometry : undefined;
  return geometry?.type === 'LineString' || geometry?.type === 'Arc' ? geometry : null;
}

function isSegmentIndex(index: number, positionCount: number) {
  return Number.isSafeInteger(index) && index >= 0 && index < positionCount - 1;
}

function isVertexIndex(index: number, positionCount: number) {
  return Number.isSafeInteger(index) && index >= 0 && index < positionCount;
}

function editedRouteLayer(
  layer: ContentLayer,
  geometry: NonNullable<ContentLayer['geometry']>,
): ContentLayer {
  const updated = { ...layer, geometry };
  if (updated.provenance?.service === 'map-matching-v5') delete updated.provenance;
  return updated;
}

function arcGeometryWithAnchors(geometry: ArcGeometry, anchors: readonly (readonly [number, number])[]) {
  return createArcGeometry(anchors, geometry.curvatures);
}

export function replaceRouteGeometry(
  layer: ContentLayer | undefined,
  positions: readonly (readonly [number, number])[],
): ContentLayer | null {
  if (layer?.type !== 'route' || positions.length < 2) return null;
  const current = routePositions(layer);
  if (!current || positions.some(([longitude, latitude]) => !isValidPosition(longitude, latitude))) return null;
  if (new Set(positions.map(([longitude, latitude]) => `${longitude},${latitude}`)).size < 2) return null;
  const coordinates = positions.map(([longitude, latitude]) => [longitude, latitude] as [number, number]);
  const isUnchanged = coordinates.length === current.length
    && coordinates.every(([longitude, latitude], index) => (
      current[index][0] === longitude && current[index][1] === latitude
    ));
  if (isUnchanged) return null;
  const geometry = layer.geometry?.type === 'Arc'
    ? arcGeometryWithAnchors(layer.geometry, coordinates)
    : { type: 'LineString' as const, coordinates };
  if (!geometry) return null;
  return editedRouteLayer(layer, geometry);
}

export function moveRouteVertex(
  layer: ContentLayer | undefined,
  vertexIndex: number,
  [longitude, latitude]: readonly [number, number],
): ContentLayer | null {
  if (layer?.type !== 'route' || !Number.isSafeInteger(vertexIndex) || !isValidPosition(longitude, latitude)) return null;
  const current = routePositions(layer);
  if (!current || vertexIndex < 0 || vertexIndex >= current.length) return null;
  if (current[vertexIndex][0] === longitude && current[vertexIndex][1] === latitude) return null;
  const coordinates = current.map((position, index) => (
    index === vertexIndex ? [longitude, latitude] as [number, number] : position
  ));
  return replaceRouteGeometry(layer, coordinates);
}

export function insertRouteVertex(
  layer: ContentLayer | undefined,
  vertexIndex: number,
  requestedCoordinate?: readonly [number, number],
): ContentLayer | null {
  const geometry = editableRouteGeometry(layer);
  if (!layer || !geometry) return null;
  const positions = geometry.type === 'Arc' ? geometry.anchors : geometry.coordinates;
  if (!isSegmentIndex(vertexIndex, positions.length)) return null;
  const start = positions[vertexIndex];
  const end = positions[vertexIndex + 1];
  let inserted: [number, number];
  if (requestedCoordinate) inserted = [requestedCoordinate[0], requestedCoordinate[1]];
  else if (geometry.type === 'Arc') inserted = arcSegmentPoint(geometry, vertexIndex, 0.5);
  else inserted = midpointPosition(start, end);
  if (!isValidPosition(inserted[0], inserted[1])) return null;
  const coordinates = positions.map((coordinate) => [...coordinate] as [number, number]);
  coordinates.splice(vertexIndex + 1, 0, inserted);
  if (geometry.type === 'LineString') return editedRouteLayer(layer, { type: 'LineString', coordinates });
  const curvatures = [...geometry.curvatures];
  curvatures.splice(vertexIndex, 1, curvatures[vertexIndex], curvatures[vertexIndex]);
  const nextGeometry = createArcGeometry(coordinates, curvatures);
  return nextGeometry ? editedRouteLayer(layer, nextGeometry) : null;
}

export function removeRouteVertex(
  layer: ContentLayer | undefined,
  vertexIndex: number,
): ContentLayer | null {
  const geometry = editableRouteGeometry(layer);
  if (!layer || !geometry) return null;
  const positions = geometry.type === 'Arc' ? geometry.anchors : geometry.coordinates;
  if (positions.length <= 2 || !isVertexIndex(vertexIndex, positions.length)) return null;
  const coordinates = positions.map((coordinate) => [...coordinate] as [number, number]);
  coordinates.splice(vertexIndex, 1);
  if (new Set(coordinates.map(([longitude, latitude]) => `${longitude},${latitude}`)).size < 2) return null;
  if (geometry.type === 'LineString') return editedRouteLayer(layer, { type: 'LineString', coordinates });
  const curvatures = [...geometry.curvatures];
  if (vertexIndex === 0) curvatures.shift();
  else if (vertexIndex === geometry.anchors.length - 1) curvatures.pop();
  else {
    const merged = Math.max(-1, Math.min(1, (curvatures[vertexIndex - 1] + curvatures[vertexIndex]) / 2));
    curvatures.splice(vertexIndex - 1, 2, merged);
  }
  const nextGeometry = createArcGeometry(coordinates, curvatures);
  return nextGeometry ? editedRouteLayer(layer, nextGeometry) : null;
}

export function setArcSegmentCurvature(
  layer: ContentLayer | undefined,
  segmentIndex: number,
  curvature: number,
): ContentLayer | null {
  if (
    layer?.type !== 'route'
    || layer.geometry?.type !== 'Arc'
    || !Number.isSafeInteger(segmentIndex)
    || segmentIndex < 0
    || segmentIndex >= layer.geometry.curvatures.length
    || layer.geometry.curvatures[segmentIndex] === curvature
  ) return null;
  const curvatures = [...layer.geometry.curvatures];
  curvatures[segmentIndex] = curvature;
  const geometry = createArcGeometry(layer.geometry.anchors, curvatures);
  return geometry ? editedRouteLayer(layer, geometry) : null;
}
