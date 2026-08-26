import { SWITZERLAND_ADMIN_1_REGIONS } from '../data/switzerlandAdmin1';
import type { LayerGeometry } from './project';

const COUNTRY_SOURCE = 'Natural Earth 1:110m Admin 0 Countries (public domain), downloaded 2026-08-26';
const REGION_SOURCE = 'Natural Earth 1:10m Admin 1 States/Provinces (public domain), downloaded 2026-08-26';
type SwitzerlandRegionGeometry = Extract<LayerGeometry, { type: 'Polygon' | 'MultiPolygon' }>;

function detachRegionGeometry(region: (typeof SWITZERLAND_ADMIN_1_REGIONS)[number]): SwitzerlandRegionGeometry {
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

export const SWITZERLAND_COUNTRY_AREA = {
  countryCode: 'CHE' as const,
  id: 'CHE' as const,
  name: 'Switzerland',
  level: 'country' as const,
  source: COUNTRY_SOURCE,
  geometry: { type: 'Polygon' as const, coordinates: [[[9.594226,47.525058],[9.632932,47.347601],[9.47997,47.10281],[9.932448,46.920728],[10.442701,46.893546],[10.363378,46.483571],[9.922837,46.314899],[9.182882,46.440215],[8.966306,46.036932],[8.489952,46.005151],[8.31663,46.163642],[7.755992,45.82449],[7.273851,45.776948],[6.843593,45.991147],[6.5001,46.429673],[6.022609,46.27299],[6.037389,46.725779],[6.768714,47.287708],[6.736571,47.541801],[7.192202,47.449766],[7.466759,47.620582],[8.317301,47.61358],[8.522612,47.830828],[9.594226,47.525058]]] as [number, number][][] },
};

export const SWITZERLAND_REGION_AREAS = SWITZERLAND_ADMIN_1_REGIONS.map((region) => ({
  countryCode: 'CHE' as const,
  id: region.id,
  name: region.name,
  level: 'region' as const,
  source: REGION_SOURCE,
  geometry: detachRegionGeometry(region),
}));
