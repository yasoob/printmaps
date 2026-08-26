import type { Map as MapLibreMap } from 'maplibre-gl';
import { sampleArc } from '../domain/routeArcGeometry';
import type { ContentLayer, LayerGeometry, ShapeGeometry } from '../domain/project';

const SOURCE_PREFIX = 'studio-source-';
const WORLD_MASK_RING: [number, number][] = [
  [-180, -85.051129], [180, -85.051129], [180, 85.051129], [-180, 85.051129], [-180, -85.051129],
];
const encodedContentId = (id: string) => `${id.length}:${id}`;

export function mapContentSourceId(id: string, role?: string): string {
  return `${SOURCE_PREFIX}${encodedContentId(id)}${role ? `:${role}` : ''}`;
}

type GeoJsonGeometry = Exclude<LayerGeometry, { type: 'Arc' }>;

function isInvertedShape(layer: ContentLayer, geometry: LayerGeometry | undefined): geometry is ShapeGeometry {
  return (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon')
    && layer.appearance?.kind === 'shape'
    && layer.appearance.invert;
}

export function mapGeometryForLayer(layer: ContentLayer): GeoJsonGeometry {
  const geometry = layer.geometry;
  if (geometry?.type === 'Arc') return { type: 'LineString', coordinates: sampleArc(geometry) };
  if (isInvertedShape(layer, geometry)) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    if (polygons.some((polygon) => polygon.length === 0)) {
      throw new Error(`Shape layer "${layer.id}" contains an empty polygon.`);
    }
    const exteriorRings = polygons.map((polygon) => polygon[0]);
    const outsideMask = [WORLD_MASK_RING, ...exteriorRings];
    const filledIslands = polygons.flatMap((polygon) => polygon.slice(1).map((ring) => [ring]));
    return filledIslands.length === 0
      ? { type: 'Polygon', coordinates: outsideMask }
      : { type: 'MultiPolygon', coordinates: [outsideMask, ...filledIslands] };
  }
  return geometry!;
}

export function addMapContentSource(
  map: MapLibreMap,
  id: string,
  layer: ContentLayer,
  geometry: GeoJsonGeometry,
) {
  map.addSource(id, {
    type: 'geojson',
    data: { type: 'Feature', properties: { layerId: layer.id }, geometry },
  });
}
