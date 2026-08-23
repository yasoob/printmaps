import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';

const SOURCE_PREFIX = 'studio-source-';
const WORLD_MASK_RING: [number, number][] = [
  [-180, -85.051129], [180, -85.051129], [180, 85.051129], [-180, 85.051129], [-180, -85.051129],
];
const encodedContentId = (id: string) => `${id.length}:${id}`;

export function mapContentSourceId(id: string, role?: string): string {
  return `${SOURCE_PREFIX}${encodedContentId(id)}${role ? `:${role}` : ''}`;
}

export function mapGeometryForLayer(layer: ContentLayer): NonNullable<ContentLayer['geometry']> {
  return layer.geometry?.type === 'Polygon'
    && layer.appearance?.kind === 'shape'
    && layer.appearance.invert
    ? { type: 'Polygon' as const, coordinates: [WORLD_MASK_RING, ...layer.geometry.coordinates] }
    : layer.geometry!;
}

export function addMapContentSource(
  map: MapLibreMap,
  id: string,
  layer: ContentLayer,
  geometry: NonNullable<ContentLayer['geometry']>,
) {
  map.addSource(id, {
    type: 'geojson',
    data: { type: 'Feature', properties: { layerId: layer.id }, geometry },
  });
}
