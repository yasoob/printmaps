import { MAX_MERCATOR_LATITUDE, type ContentLayer } from './project';

export function isValidPosition(longitude: number, latitude: number) {
  return Number.isFinite(longitude)
    && Number.isFinite(latitude)
    && longitude >= -180
    && longitude <= 180
    && latitude >= -MAX_MERCATOR_LATITUDE
    && latitude <= MAX_MERCATOR_LATITUDE;
}

export function moveRouteVertex(
  layer: ContentLayer | undefined,
  vertexIndex: number,
  [longitude, latitude]: readonly [number, number],
): ContentLayer | null {
  if (
    layer?.type !== 'route'
    || layer.geometry?.type !== 'LineString'
    || !Number.isSafeInteger(vertexIndex)
    || vertexIndex < 0
    || vertexIndex >= layer.geometry.coordinates.length
    || !isValidPosition(longitude, latitude)
    || (
      layer.geometry.coordinates[vertexIndex][0] === longitude
      && layer.geometry.coordinates[vertexIndex][1] === latitude
    )
  ) return null;

  const coordinates = layer.geometry.coordinates.map((position, index) => (
    index === vertexIndex
      ? [longitude, latitude] as [number, number]
      : position
  ));
  return { ...layer, geometry: { type: 'LineString', coordinates } };
}

export function insertRouteVertex(
  layer: ContentLayer | undefined,
  vertexIndex: number,
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
  const directLongitudeDelta = end[0] - start[0];
  const midpointLongitude = Math.abs(directLongitudeDelta) <= 180
    ? (start[0] + end[0]) / 2
    : start[0] + (((directLongitudeDelta + 540) % 360) - 180) / 2;
  const midpoint: [number, number] = [
    midpointLongitude > 180 ? midpointLongitude - 360 : midpointLongitude,
    (start[1] + end[1]) / 2,
  ];
  if (!isValidPosition(midpoint[0], midpoint[1])) return null;
  const coordinates = layer.geometry.coordinates.map((coordinate) => [...coordinate] as [number, number]);
  coordinates.splice(vertexIndex + 1, 0, midpoint);
  return { ...layer, geometry: { type: 'LineString', coordinates } };
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
  return { ...layer, geometry: { type: 'LineString', coordinates } };
}
