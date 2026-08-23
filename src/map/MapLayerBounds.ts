import type { ContentLayer } from '../domain/project';

export type MapBounds = [[number, number], [number, number]];

export function layerBounds(layers: readonly ContentLayer[], layerId: string | null): MapBounds | undefined {
  const geometry = layers.find(({ id }) => id === layerId)?.geometry;
  if (!geometry) return;
  let coordinates: readonly (readonly [number, number])[];
  if (geometry.type === 'Point') coordinates = [geometry.coordinates];
  else if (geometry.type === 'LineString') coordinates = geometry.coordinates;
  else coordinates = geometry.coordinates.flat();
  if (coordinates.length === 0 || coordinates.some(([longitude, latitude]) => (
    !Number.isFinite(longitude) || !Number.isFinite(latitude)
  ))) return;

  let minimumLongitude = Infinity;
  let minimumLatitude = Infinity;
  let maximumLongitude = -Infinity;
  let maximumLatitude = -Infinity;
  for (const [longitude, latitude] of coordinates) {
    minimumLongitude = Math.min(minimumLongitude, longitude);
    minimumLatitude = Math.min(minimumLatitude, latitude);
    maximumLongitude = Math.max(maximumLongitude, longitude);
    maximumLatitude = Math.max(maximumLatitude, latitude);
  }
  return [[minimumLongitude, minimumLatitude], [maximumLongitude, maximumLatitude]];
}
