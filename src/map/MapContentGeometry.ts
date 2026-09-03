import type { Map as MapLibreMap } from 'maplibre-gl';
import { sampleArc } from '../domain/routeArcGeometry';
import type { ContentLayer, LayerGeometry, ShapeGeometry } from '../domain/project';
import { deriveRenderedRoute } from '../domain/renderedRoute';
import { routePictogramImageId } from '../domain/routePictograms';

const SOURCE_PREFIX = 'studio-source-';
const WORLD_MASK_RING: [number, number][] = [
  [-180, -85.051129], [180, -85.051129], [180, 85.051129], [-180, 85.051129], [-180, -85.051129],
];
const encodedContentId = (id: string) => `${id.length}:${id}`;

export function mapContentSourceId(id: string, role?: string): string {
  return `${SOURCE_PREFIX}${encodedContentId(id)}${role ? `:${role}` : ''}`;
}

type GeoJsonGeometry = Exclude<LayerGeometry, { type: 'Arc' }>;
type MapGeoJson = GeoJsonGeometry | {
  type: 'Feature';
  properties: Record<string, string | number>;
  geometry: GeoJsonGeometry;
} | {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: Record<string, string | number>;
    geometry: GeoJsonGeometry;
  }[];
};

export function mapContentDataForLayer(
  layer: ContentLayer,
  geometry: GeoJsonGeometry = mapGeometryForLayer(layer),
): MapGeoJson {
  const data = layer.type === 'route' ? routeMapFeatures(layer) : null;
  if (!data && layer.type === 'route') {
    throw new Error(`Route layer "${layer.id}" cannot be rendered.`);
  }
  return data ?? {
    type: 'Feature',
    properties: { layerId: layer.id },
    geometry,
  };
}

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

export function routeMapFeatures(layer: ContentLayer): MapGeoJson | null {
  const rendered = deriveRenderedRoute(layer);
  if (!rendered) return null;
  const pictogram = layer.appearance?.kind === 'route' ? layer.appearance.marker?.pictogram : undefined;
  return {
    type: 'FeatureCollection',
    features: [
      ...rendered.legs.map((leg) => ({
        type: 'Feature' as const,
        properties: {
          layerId: layer.id,
          featureKind: 'segment',
          segmentIndex: leg.index,
          color: leg.style.color,
          width: leg.style.width,
          strokeStyle: leg.style.strokeStyle,
        },
        geometry: { type: 'LineString' as const, coordinates: leg.path },
      })),
      ...rendered.markers.map((marker, markerIndex) => ({
        type: 'Feature' as const,
        properties: {
          layerId: layer.id,
          featureKind: 'marker',
          markerIndex,
          segmentIndex: marker.legIndex,
          bearing: marker.bearing,
          color: marker.style.color,
          iconImage: routePictogramImageId(pictogram!, marker.style.color),
        },
        geometry: { type: 'Point' as const, coordinates: marker.position },
      })),
    ],
  };
}

export function addMapContentSource(
  map: MapLibreMap,
  id: string,
  layer: ContentLayer,
  geometry: GeoJsonGeometry,
) {
  map.addSource(id, {
    type: 'geojson',
    data: mapContentDataForLayer(layer, geometry),
  });
}
