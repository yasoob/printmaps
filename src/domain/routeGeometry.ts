import { createArcGeometry } from './routeArcGeometry';
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
    ? createArcGeometry(coordinates)
    : { type: 'LineString' as const, coordinates };
  if (!geometry) return null;
  const updated = { ...layer, geometry };
  delete updated.provenance;
  return updated;
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
  if (
    layer?.type !== 'route'
    || layer.geometry?.type !== 'LineString'
    || !Number.isSafeInteger(vertexIndex)
    || vertexIndex < 0
    || vertexIndex >= layer.geometry.coordinates.length - 1
  ) return null;

  const start = layer.geometry.coordinates[vertexIndex];
  const end = layer.geometry.coordinates[vertexIndex + 1];
  const inserted: [number, number] = requestedCoordinate
    ? [requestedCoordinate[0], requestedCoordinate[1]]
    : midpointPosition(start, end);
  if (!isValidPosition(inserted[0], inserted[1])) return null;
  const coordinates = layer.geometry.coordinates.map((coordinate) => [...coordinate] as [number, number]);
  coordinates.splice(vertexIndex + 1, 0, inserted);
  const updated = { ...layer, geometry: { type: 'LineString' as const, coordinates } };
  delete updated.provenance;
  return updated;
}

export function removeRouteVertex(
  layer: ContentLayer | undefined,
  vertexIndex: number,
): ContentLayer | null {
  if (
    layer?.type !== 'route'
    || layer.geometry?.type !== 'LineString'
    || layer.geometry.coordinates.length <= 2
    || !Number.isSafeInteger(vertexIndex)
    || vertexIndex < 0
    || vertexIndex >= layer.geometry.coordinates.length
  ) return null;

  const coordinates = layer.geometry.coordinates.map((coordinate) => [...coordinate] as [number, number]);
  coordinates.splice(vertexIndex, 1);
  if (new Set(coordinates.map(([longitude, latitude]) => `${longitude},${latitude}`)).size < 2) return null;
  const updated = { ...layer, geometry: { type: 'LineString' as const, coordinates } };
  delete updated.provenance;
  return updated;
}
