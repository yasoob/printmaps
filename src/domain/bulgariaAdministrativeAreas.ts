import BULGARIA_ADMIN_1_JSON from '../data/bulgariaAdmin1.txt?raw';
import type { LayerGeometry } from './project';

const COUNTRY_SOURCE = 'Natural Earth 1:110m Admin 0 Countries (public domain), downloaded 2026-08-26';
const REGION_SOURCE = 'Natural Earth 1:10m Admin 1 States/Provinces (public domain), downloaded 2026-08-26';
type BulgariaGeometry = Extract<LayerGeometry, { type: 'Polygon' | 'MultiPolygon' }>;
type BulgariaAdmin1Region = Readonly<{
  id: string;
  name: string;
  sourceName: string;
  geometry: BulgariaGeometry;
}>;
const BULGARIA_ADMIN_1_REGIONS = JSON.parse(BULGARIA_ADMIN_1_JSON) as readonly BulgariaAdmin1Region[];

function detachGeometry(geometry: BulgariaGeometry): BulgariaGeometry {
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

export const BULGARIA_COUNTRY_AREA = {
  countryCode: 'BGR' as const,
  id: 'BGR' as const,
  name: 'Bulgaria',
  level: 'country' as const,
  source: COUNTRY_SOURCE,
  geometry: {"type":"Polygon","coordinates":[[[22.65715,44.234923],[22.944832,43.823785],[23.332302,43.897011],[24.100679,43.741051],[25.569272,43.688445],[26.065159,43.943494],[27.2424,44.175986],[27.970107,43.812468],[28.558081,43.707462],[28.039095,43.293172],[27.673898,42.577892],[27.99672,42.007359],[27.135739,42.141485],[26.117042,41.826905],[26.106138,41.328899],[25.197201,41.234486],[24.492645,41.583896],[23.692074,41.309081],[22.952377,41.337994],[22.881374,41.999297],[22.380526,42.32026],[22.545012,42.461362],[22.436595,42.580321],[22.604801,42.898519],[22.986019,43.211161],[22.500157,43.642814],[22.410446,44.008063],[22.65715,44.234923]]]} as BulgariaGeometry,
};

export const BULGARIA_REGION_AREAS = BULGARIA_ADMIN_1_REGIONS.map((region) => ({
  countryCode: 'BGR' as const,
  id: region.id,
  name: region.name,
  level: 'region' as const,
  source: REGION_SOURCE,
  geometry: detachGeometry(region.geometry),
}));
