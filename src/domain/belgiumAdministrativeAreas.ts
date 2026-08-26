import { BELGIUM_ADMIN_1_REGIONS } from '../data/belgiumAdmin1';
import type { LayerGeometry } from './project';

const COUNTRY_SOURCE = 'Natural Earth 1:110m Admin 0 Countries (public domain), downloaded 2026-08-26';
const REGION_SOURCE = 'Natural Earth 1:10m Admin 1 States/Provinces (public domain), downloaded 2026-08-26';
type BelgiumRegionGeometry = Extract<LayerGeometry, { type: 'Polygon' | 'MultiPolygon' }>;

function detachRegionGeometry(region: (typeof BELGIUM_ADMIN_1_REGIONS)[number]): BelgiumRegionGeometry {
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

export const BELGIUM_COUNTRY_AREA = {
  countryCode: 'BEL' as const,
  id: 'BEL' as const,
  name: 'Belgium',
  level: 'country' as const,
  source: COUNTRY_SOURCE,
  geometry: { type: 'Polygon' as const, coordinates: [[[6.156658,50.803721],[6.043073,50.128052],[5.782417,50.090328],[5.674052,49.529484],[4.799222,49.985373],[4.286023,49.907497],[3.588184,50.378992],[3.123252,50.780363],[2.658422,50.796848],[2.513573,51.148506],[3.314971,51.345781],[3.315011,51.345777],[3.314971,51.345755],[4.047071,51.267259],[4.973991,51.475024],[5.606976,51.037298],[6.156658,50.803721]]] as [number, number][][] },
};

export const BELGIUM_REGION_AREAS = BELGIUM_ADMIN_1_REGIONS.map((region) => ({
  countryCode: 'BEL' as const,
  id: region.id,
  name: region.name,
  level: 'region' as const,
  source: REGION_SOURCE,
  geometry: detachRegionGeometry(region),
}));
