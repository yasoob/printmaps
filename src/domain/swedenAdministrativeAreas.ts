import SWEDEN_ADMIN_1_JSON from '../data/swedenAdmin1.txt?raw';
import type { LayerGeometry } from './project';

const COUNTRY_SOURCE = 'Natural Earth 1:110m Admin 0 Countries (public domain), downloaded 2026-08-26';
const REGION_SOURCE = 'Natural Earth 1:10m Admin 1 States/Provinces (public domain), downloaded 2026-08-26';
type SwedenGeometry = Extract<LayerGeometry, { type: 'Polygon' | 'MultiPolygon' }>;
type SwedenAdmin1Region = Readonly<{
  id: string;
  name: string;
  sourceName: string;
  geometry: SwedenGeometry;
}>;
const SWEDEN_ADMIN_1_REGIONS = JSON.parse(SWEDEN_ADMIN_1_JSON) as readonly SwedenAdmin1Region[];

function detachGeometry(geometry: SwedenGeometry): SwedenGeometry {
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

export const SWEDEN_COUNTRY_AREA = {
  countryCode: 'SWE' as const,
  id: 'SWE' as const,
  name: 'Sweden',
  level: 'country' as const,
  source: COUNTRY_SOURCE,
  geometry: {"type":"Polygon","coordinates":[[[11.027369,58.856149],[11.468272,59.432393],[12.300366,60.117933],[12.631147,61.293572],[11.992064,61.800362],[11.930569,63.128318],[12.579935,64.066219],[13.571916,64.049114],[13.919905,64.445421],[13.55569,64.787028],[15.108411,66.193867],[16.108712,67.302456],[16.768879,68.013937],[17.729182,68.010552],[17.993868,68.567391],[19.87856,68.407194],[20.025269,69.065139],[20.645593,69.106247],[21.978535,68.616846],[23.539473,67.936009],[23.56588,66.396051],[23.903379,66.006927],[22.183173,65.723741],[21.213517,65.026005],[21.369631,64.413588],[19.778876,63.609554],[17.847779,62.7494],[17.119555,61.341166],[17.831346,60.636583],[18.787722,60.081914],[17.869225,58.953766],[16.829185,58.719827],[16.44771,57.041118],[15.879786,56.104302],[14.666681,56.200885],[14.100721,55.407781],[12.942911,55.361737],[12.625101,56.30708],[11.787942,57.441817],[11.027369,58.856149]]]} as SwedenGeometry,
};

export const SWEDEN_REGION_AREAS = SWEDEN_ADMIN_1_REGIONS.map((region) => ({
  countryCode: 'SWE' as const,
  id: region.id,
  name: region.name,
  level: 'region' as const,
  source: REGION_SOURCE,
  geometry: detachGeometry(region.geometry as SwedenGeometry),
}));
