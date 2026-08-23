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
