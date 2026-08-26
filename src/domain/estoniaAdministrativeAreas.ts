import ESTONIA_ADMIN_1_JSON from '../data/estoniaAdmin1.txt?raw';
import type { LayerGeometry } from './project';

const COUNTRY_SOURCE = 'Natural Earth 1:110m Admin 0 Countries (public domain), downloaded 2026-08-26';
const REGION_SOURCE = 'Natural Earth 1:10m Admin 1 States/Provinces (public domain), downloaded 2026-08-26';
type EstoniaGeometry = Extract<LayerGeometry, { type: 'Polygon' | 'MultiPolygon' }>;
type EstoniaAdmin1RegionId = 'EE-84' | 'EE-67' | 'EE-82' | 'EE-86' | 'EE-44' | 'EE-65' | 'EE-78' | 'EE-49' | 'EE-57' | 'EE-37' | 'EE-59' | 'EE-74' | 'EE-39' | 'EE-70' | 'EE-51';
type EstoniaAdmin1Region = Readonly<{
  id: EstoniaAdmin1RegionId;
  name: string;
  sourceName: string;
  geometry: EstoniaGeometry;
}>;
const ESTONIA_ADMIN_1_REGIONS = JSON.parse(ESTONIA_ADMIN_1_JSON) as readonly EstoniaAdmin1Region[];

function detachGeometry(geometry: EstoniaGeometry): EstoniaGeometry {
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

export const ESTONIA_COUNTRY_AREA = {
  countryCode: 'EST' as const,
  id: 'EST' as const,
  name: 'Estonia',
  level: 'country' as const,
  source: COUNTRY_SOURCE,
  geometry: {"type":"Polygon","coordinates":[[[27.981127,59.475373],[27.98112,59.47537],[28.131699,59.300825],[27.42015,58.72457],[27.716686,57.791899],[27.288185,57.474528],[26.463532,57.476389],[25.60281,57.847529],[25.164594,57.970157],[24.312863,57.793424],[24.428928,58.383413],[24.061198,58.257375],[23.42656,58.612753],[23.339795,59.18724],[24.604214,59.465854],[25.864189,59.61109],[26.949136,59.445803],[27.981114,59.475388],[27.981127,59.475373]]]} as EstoniaGeometry,
};

export const ESTONIA_REGION_AREAS = ESTONIA_ADMIN_1_REGIONS.map((region) => ({
  countryCode: 'EST' as const,
  id: region.id,
  name: region.name,
  level: 'region' as const,
  source: REGION_SOURCE,
  geometry: detachGeometry(region.geometry),
}));
