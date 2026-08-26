import GREECE_ADMIN_1_JSON from '../data/greeceAdmin1.txt?raw';
import GREECE_COUNTRY_JSON from '../data/greeceCountry.json?raw';
import type { LayerGeometry } from './project';

const COUNTRY_SOURCE = 'Natural Earth 1:110m Admin 0 Countries (public domain), downloaded 2026-08-26';
const REGION_SOURCE = 'Natural Earth 1:10m Admin 1 States/Provinces (public domain), downloaded 2026-08-26';
type GreeceGeometry = Extract<LayerGeometry, { type: 'Polygon' | 'MultiPolygon' }>;
type GreeceAdmin1Region = Readonly<{
  id: string;
  name: string;
  geometry: GreeceGeometry;
}>;
const GREECE_ADMIN_1_REGIONS = JSON.parse(GREECE_ADMIN_1_JSON) as readonly GreeceAdmin1Region[];
const GREECE_COUNTRY_GEOMETRY = JSON.parse(GREECE_COUNTRY_JSON) as GreeceGeometry;

function detachGeometry(geometry: GreeceGeometry): GreeceGeometry {
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.map((ring) => ring.map(([longitude, latitude]) => (
        [longitude, latitude] as [number, number]
      ))),
    };
  }
  return {
    type: 'MultiPolygon',
    coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => ring.map(([longitude, latitude]) => (
      [longitude, latitude] as [number, number]
    )))),
  };
}

export const GREECE_COUNTRY_AREA = {
  countryCode: 'GRC' as const,
  id: 'GRC' as const,
  name: 'Greece',
  level: 'country' as const,
  source: COUNTRY_SOURCE,
  geometry: detachGeometry(GREECE_COUNTRY_GEOMETRY),
};

export const GREECE_REGION_AREAS = GREECE_ADMIN_1_REGIONS.map((region) => ({
  countryCode: 'GRC' as const,
  id: region.id,
  name: region.name,
  level: 'region' as const,
  source: REGION_SOURCE,
  geometry: detachGeometry(region.geometry),
}));
