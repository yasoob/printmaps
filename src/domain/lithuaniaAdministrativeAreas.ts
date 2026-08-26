import LITHUANIA_ADMIN_1_JSON from '../data/lithuaniaAdmin1.txt?raw';
import type { LayerGeometry } from './project';

const COUNTRY_SOURCE = 'Natural Earth 1:110m Admin 0 Countries (public domain), downloaded 2026-08-26';
const REGION_SOURCE = 'Natural Earth 1:10m Admin 1 States/Provinces (public domain), downloaded 2026-08-26';
type LithuaniaGeometry = Extract<LayerGeometry, { type: 'Polygon' | 'MultiPolygon' }>;
type LithuaniaAdmin1RegionId = 'LT-UT' | 'LT-VL' | 'LT-AL' | 'LT-PN' | 'LT-TE' | 'LT-KL' | 'LT-SA' | 'LT-MR' | 'LT-TA' | 'LT-KU';
type LithuaniaAdmin1Region = Readonly<{
  id: LithuaniaAdmin1RegionId;
  name: string;
  sourceName: string;
  geometry: LithuaniaGeometry;
}>;
const LITHUANIA_ADMIN_1_REGIONS = JSON.parse(LITHUANIA_ADMIN_1_JSON) as readonly LithuaniaAdmin1Region[];

function detachGeometry(geometry: LithuaniaGeometry): LithuaniaGeometry {
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

export const LITHUANIA_COUNTRY_AREA = {
  countryCode: 'LTU' as const,
  id: 'LTU' as const,
  name: 'Lithuania',
  level: 'country' as const,
  source: COUNTRY_SOURCE,
  geometry: {"type":"Polygon","coordinates":[[[26.494331,55.615107],[26.588279,55.167176],[25.768433,54.846963],[25.536354,54.282423],[24.450684,53.905702],[23.484128,53.912498],[23.243987,54.220567],[22.731099,54.327537],[22.651052,54.582741],[22.757764,54.856574],[22.315724,55.015299],[21.268449,55.190482],[21.0558,56.031076],[22.201157,56.337802],[23.878264,56.273671],[24.860684,56.372528],[25.000934,56.164531],[25.533047,56.100297],[26.494331,55.615107]]]} as LithuaniaGeometry,
};

export const LITHUANIA_REGION_AREAS = LITHUANIA_ADMIN_1_REGIONS.map((region) => ({
  countryCode: 'LTU' as const,
  id: region.id,
  name: region.name,
  level: 'region' as const,
  source: REGION_SOURCE,
  geometry: detachGeometry(region.geometry as LithuaniaGeometry),
}));
