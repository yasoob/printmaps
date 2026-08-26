import { NETHERLANDS_ADMIN_1_REGIONS } from '../data/netherlandsAdmin1';
import type { LayerGeometry } from './project';

const COUNTRY_SOURCE = 'Natural Earth 1:110m Admin 0 Countries (public domain), downloaded 2026-08-26';
const REGION_SOURCE = 'Natural Earth 1:10m Admin 1 States/Provinces (public domain), downloaded 2026-08-26';
type NetherlandsRegionGeometry = Extract<LayerGeometry, { type: 'Polygon' | 'MultiPolygon' }>;

function detachRegionGeometry(region: (typeof NETHERLANDS_ADMIN_1_REGIONS)[number]): NetherlandsRegionGeometry {
  if (region.geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: region.geometry.coordinates.map((ring) => ring.map(([longitude, latitude]) => (
        [longitude, latitude] as [number, number]
      ))),
    };
  }
  return {
    type: 'MultiPolygon',
    coordinates: region.geometry.coordinates.map((polygon) => polygon.map((ring) => ring.map(([longitude, latitude]) => (
      [longitude, latitude] as [number, number]
    )))),
  };
}

export const NETHERLANDS_COUNTRY_AREA = {
  countryCode: 'NLD' as const,
  id: 'NLD' as const,
  name: 'Netherlands',
  level: 'country' as const,
  source: COUNTRY_SOURCE,
  geometry: { type: 'Polygon' as const, coordinates: [[[6.90514,53.482162],[7.092053,53.144043],[6.84287,52.22844],[6.589397,51.852029],[5.988658,51.851616],[6.156658,50.803721],[5.606976,51.037298],[4.973991,51.475024],[4.047071,51.267259],[3.314971,51.345755],[3.315011,51.345777],[3.830289,51.620545],[4.705997,53.091798],[6.074183,53.510403],[6.90514,53.482162]]] as [number, number][][] },
};

export const NETHERLANDS_REGION_AREAS = NETHERLANDS_ADMIN_1_REGIONS.map((region) => ({
  countryCode: 'NLD' as const,
  id: region.id,
  name: region.name,
  level: 'region' as const,
  source: REGION_SOURCE,
  geometry: detachRegionGeometry(region),
}));
