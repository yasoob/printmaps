import ITALY_ADMIN_1_JSON from '../data/italyAdmin1.txt?raw';
import ITALY_COUNTRY_JSON from '../data/italyCountry.json?raw';
import type { LayerGeometry } from './project';

const COUNTRY_SOURCE = 'Natural Earth 1:110m Admin 0 Countries (public domain), downloaded 2026-08-26';
const REGION_SOURCE = 'Natural Earth 1:10m Admin 1 States/Provinces (public domain), downloaded 2026-08-26';
type ItalyGeometry = Extract<LayerGeometry, { type: 'Polygon' | 'MultiPolygon' }>;
type ItalyAdmin1Region = Readonly<{
  id: string;
  name: string;
  geometry: ItalyGeometry;
}>;
const ITALY_ADMIN_1_REGIONS = JSON.parse(ITALY_ADMIN_1_JSON) as readonly ItalyAdmin1Region[];
const ITALY_COUNTRY_GEOMETRY = JSON.parse(ITALY_COUNTRY_JSON) as ItalyGeometry;

function detachGeometry(geometry: ItalyGeometry): ItalyGeometry {
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

export const ITALY_COUNTRY_AREA = {
  countryCode: 'ITA' as const,
  id: 'ITA' as const,
  name: 'Italy',
  level: 'country' as const,
  source: COUNTRY_SOURCE,
  geometry: detachGeometry(ITALY_COUNTRY_GEOMETRY),
};

export const ITALY_REGION_AREAS = ITALY_ADMIN_1_REGIONS.map((region) => ({
  countryCode: 'ITA' as const,
  id: region.id,
  name: region.name,
  level: 'region' as const,
  source: REGION_SOURCE,
  geometry: detachGeometry(region.geometry),
}));
