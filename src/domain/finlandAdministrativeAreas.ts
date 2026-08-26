import FINLAND_ADMIN_1_JSON from '../data/finlandAdmin1.txt?raw';
import type { LayerGeometry } from './project';

const COUNTRY_SOURCE = 'Natural Earth 1:110m Admin 0 Countries (public domain), downloaded 2026-08-26';
const REGION_SOURCE = 'Natural Earth 1:10m Admin 1 States/Provinces (public domain), downloaded 2026-08-26';
type FinlandGeometry = Extract<LayerGeometry, { type: 'Polygon' | 'MultiPolygon' }>;
type FinlandAdmin1Region = Readonly<{
  id: string;
  name: string;
  sourceName: string;
  geometry: FinlandGeometry;
}>;
const FINLAND_ADMIN_1_REGIONS = JSON.parse(FINLAND_ADMIN_1_JSON) as readonly FinlandAdmin1Region[];

function detachGeometry(geometry: FinlandGeometry): FinlandGeometry {
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

export const FINLAND_COUNTRY_AREA = {
  countryCode: 'FIN' as const,
  id: 'FIN' as const,
  name: 'Finland',
  level: 'country' as const,
  source: COUNTRY_SOURCE,
  geometry: {"type":"Polygon","coordinates":[[[28.59193,69.064777],[28.445944,68.364613],[29.977426,67.698297],[29.054589,66.944286],[30.21765,65.80598],[29.54443,64.948672],[30.444685,64.204453],[30.035872,63.552814],[31.516092,62.867687],[31.139991,62.357693],[30.211107,61.780028],[28.07,60.50352],[28.070002,60.503519],[28.069998,60.503517],[26.255173,60.423961],[24.496624,60.057316],[22.869695,59.846373],[22.290764,60.391921],[21.322244,60.72017],[21.544866,61.705329],[21.059211,62.607393],[21.536029,63.189735],[22.442744,63.81781],[24.730512,64.902344],[25.398068,65.111427],[25.294043,65.534346],[23.903379,66.006927],[23.56588,66.396051],[23.539473,67.936009],[21.978535,68.616846],[20.645593,69.106247],[21.244936,69.370443],[22.356238,68.841741],[23.66205,68.891247],[24.735679,68.649557],[25.689213,69.092114],[26.179622,69.825299],[27.732292,70.164193],[29.015573,69.766491],[28.59193,69.064777]]]} as FinlandGeometry,
};

export const FINLAND_REGION_AREAS = FINLAND_ADMIN_1_REGIONS.map((region) => ({
  countryCode: 'FIN' as const,
  id: region.id,
  name: region.name,
  level: 'region' as const,
  source: REGION_SOURCE,
  geometry: detachGeometry(region.geometry),
}));
