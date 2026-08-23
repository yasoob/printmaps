import { MAX_MERCATOR_LATITUDE, type ContentLayer } from '../domain/project';

export type MapBounds = [[number, number], [number, number]];
const MULTIPOLYGON_FLAT_DEPTH = 2;

function geometryCoordinates(layer: ContentLayer): readonly (readonly [number, number])[] {
  const geometry = layer.geometry;
  if (!geometry) return [];
  switch (geometry.type) {
    case 'Point': { return [geometry.coordinates]; }
    case 'LineString': { return geometry.coordinates; }
    case 'Polygon': { return geometry.coordinates.flat(); }
    case 'MultiPolygon': { return geometry.coordinates.flat(MULTIPOLYGON_FLAT_DEPTH); }
  }
}

export function combinedLayerBounds(layers: readonly ContentLayer[]): MapBounds | undefined {
  const coordinates = layers.flatMap((layer) => geometryCoordinates(layer));
  if (coordinates.length === 0 || coordinates.some(([longitude, latitude]) => (
    !Number.isFinite(longitude) || Math.abs(longitude) > 180
    || !Number.isFinite(latitude) || Math.abs(latitude) > MAX_MERCATOR_LATITUDE
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

export function layerBounds(layers: readonly ContentLayer[], layerId: string | null): MapBounds | undefined {
  const layer = layers.find(({ id }) => id === layerId);
  return layer ? combinedLayerBounds([layer]) : undefined;
}
