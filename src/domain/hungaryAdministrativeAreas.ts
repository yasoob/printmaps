import { HUNGARY_ADMIN_1_REGIONS } from '../data/hungaryAdmin1';
import type { LayerGeometry } from './project';

const SOURCE = 'Natural Earth 1:10m Admin 1 States/Provinces (public domain), downloaded 2026-08-26';

type HungarianRegionGeometry = Extract<LayerGeometry, { type: 'Polygon' | 'MultiPolygon' }>;

function detachRegionGeometry(region: (typeof HUNGARY_ADMIN_1_REGIONS)[number]): HungarianRegionGeometry {
  if (region.geometryType === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: region.coordinates.map((ring) => ring.map(([longitude, latitude]) => (
        [longitude, latitude] as [number, number]
      ))),
    };
  }
  return {
    type: 'MultiPolygon',
    coordinates: region.coordinates.map((polygon) => polygon.map((ring) => ring.map(([longitude, latitude]) => (
      [longitude, latitude] as [number, number]
    )))),
  };
}

export const HUNGARY_REGION_AREAS = HUNGARY_ADMIN_1_REGIONS.map((region) => ({
  countryCode: 'HUN' as const,
  id: region.id,
  name: region.name,
  level: 'region' as const,
  source: SOURCE,
  geometry: detachRegionGeometry(region),
}));
