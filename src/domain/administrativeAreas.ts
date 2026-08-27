import { union as unionPolygons, type Polygon as ClippingPolygon } from 'polygon-clipping';
import { VIENNA_DISTRICTS } from '../data/viennaDistricts';
import type { LayerGeometry } from './project';

// Generated catalogue IDs are runtime-validated so world coverage does not become a compiler-heavy union.
export type AdministrativeCountryCode = string;
export type AdministrativeAreaId = string;

export type AdministrativeArea = Readonly<{
  countryCode: AdministrativeCountryCode;
  id: string;
  name: string;
  level: 'country' | 'region' | 'municipality';
  source: string;
  geometry: Extract<LayerGeometry, { type: 'Polygon' | 'MultiPolygon' }>;
}>;

type PolygonAdministrativeArea = AdministrativeArea & {
  geometry: Extract<LayerGeometry, { type: 'Polygon' }>;
};
type MergeableAdministrativeLevel = Extract<AdministrativeArea['level'], 'region' | 'municipality'>;
type AdministrativeAreaSelection = { areas: AdministrativeArea[]; level: MergeableAdministrativeLevel };

const MUNICIPALITY_SOURCE = 'City of Vienna Open Government Data district boundaries (CC BY 3.0 AT), downloaded 2026-08-24 and simplified at 0.00008° tolerance';
const MUNICIPALITY_SLIVER_AREA_LIMIT = 1e-6;
const MUNICIPALITY_SLIVER_AREA_RATIO = 1e-4;

export const VIENNA_DISTRICT_SOURCE_URL = 'https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.1.0&typeName=ogdwien:BEZIRKSGRENZEOGD&srsName=EPSG:4326&outputFormat=json';
export const VIENNA_DISTRICT_LICENSE_URL = 'https://creativecommons.org/licenses/by/3.0/at/';

const viennaMunicipalAreas = VIENNA_DISTRICTS.map((district): AdministrativeArea => ({
  countryCode: 'AUT',
  id: district.id,
  name: district.name,
  level: 'municipality',
  source: MUNICIPALITY_SOURCE,
  geometry: {
    type: 'Polygon',
    coordinates: district.coordinates.map((ring) => ring.map(([longitude, latitude]) => (
      [longitude, latitude] as [number, number]
    ))),
  },
}));

// Municipality data remains exceptional and attributed. Countries and regions load only from the generated world catalogue.
export const ADMINISTRATIVE_AREAS: readonly AdministrativeArea[] = viennaMunicipalAreas;

export function administrativeAreaById(id: string): AdministrativeArea | undefined {
  return ADMINISTRATIVE_AREAS.find((area) => area.id === id);
}

function ringArea(ring: readonly (readonly [number, number])[]): number {
  let area = 0;
  for (let index = 1; index < ring.length; index += 1) {
    const [x1, y1] = ring[index - 1];
    const [x2, y2] = ring[index];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function mergeMunicipalityPolygons(areas: readonly PolygonAdministrativeArea[]): [number, number][][] | undefined {
  try {
    const polygons = areas.map(({ geometry }) => geometry.coordinates.map((ring) => (
      ring.map(([longitude, latitude]) => [longitude, latitude] as [number, number])
    )) as ClippingPolygon);
    const merged = unionPolygons(polygons[0], ...polygons.slice(1));
    if (merged.length !== 1) return;
    const [exterior, ...holes] = merged[0];
    if (!exterior) return;
    const sliverAreaLimit = Math.max(
      MUNICIPALITY_SLIVER_AREA_LIMIT,
      Math.abs(ringArea(exterior)) * MUNICIPALITY_SLIVER_AREA_RATIO,
    );
    const meaningfulHoles = holes.filter((ring) => Math.abs(ringArea(ring)) > sliverAreaLimit);
    return [exterior, ...meaningfulHoles].map((ring) => ring.map(([longitude, latitude]) => [longitude, latitude]));
  } catch {
    return undefined;
  }
}

function geometryPartCount({ geometry }: AdministrativeArea): number {
  return unionPolygons(geometry.coordinates).length;
}

function regionGeometryBounds({ geometry }: AdministrativeArea): [number, number, number, number] {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [longitude, latitude] of ring) {
        west = Math.min(west, longitude);
        south = Math.min(south, latitude);
        east = Math.max(east, longitude);
        north = Math.max(north, latitude);
      }
    }
  }
  return [west, south, east, north];
}

function areRegionsConnected(left: AdministrativeArea, right: AdministrativeArea): boolean {
  const [leftWest, leftSouth, leftEast, leftNorth] = regionGeometryBounds(left);
  const [rightWest, rightSouth, rightEast, rightNorth] = regionGeometryBounds(right);
  if (leftEast < rightWest || rightEast < leftWest || leftNorth < rightSouth || rightNorth < leftSouth) return false;
  return unionPolygons(left.geometry.coordinates, right.geometry.coordinates).length
    < geometryPartCount(left) + geometryPartCount(right);
}

function isConnectedRegionSelection(areas: readonly AdministrativeArea[]): boolean {
  const connected = new Set([0]);
  while (connected.size < areas.length) {
    const nextIndex = areas.findIndex((area, index) => (
      !connected.has(index) && [...connected].some((candidate) => areRegionsConnected(areas[candidate], area))
    ));
    if (nextIndex === -1) return false;
    connected.add(nextIndex);
  }
  return true;
}

function mergeRegionGeometry(areas: readonly AdministrativeArea[]): AdministrativeArea['geometry'] | undefined {
  try {
    if (!isConnectedRegionSelection(areas)) return;
    const geometries = areas.map(({ geometry }) => geometry.coordinates);
    const merged = unionPolygons(geometries[0], ...geometries.slice(1));
    if (merged.length === 0) return;
    return merged.length === 1
      ? { type: 'Polygon', coordinates: merged[0] }
      : { type: 'MultiPolygon', coordinates: merged };
  } catch {
    return undefined;
  }
}

function administrativeAreaSelection(areas: readonly AdministrativeArea[]): AdministrativeAreaSelection | undefined {
  const uniqueIds = new Set(areas.map(({ id }) => id));
  if (areas.length === 0 || uniqueIds.size !== areas.length) return;
  const level = areas[0]?.level;
  const countryCode = areas[0]?.countryCode;
  if (!countryCode || (level !== 'region' && level !== 'municipality')
    || areas.some((area) => area.level !== level || area.countryCode !== countryCode)) return;
  return { areas: [...areas], level };
}

export function mergeAdministrativeAreaRecords(areas: readonly AdministrativeArea[]): AdministrativeArea | undefined {
  const selection = administrativeAreaSelection(areas);
  if (!selection) return;
  const { areas: selectedAreas, level } = selection;
  if (selectedAreas.length === 1) return selectedAreas[0];
  let geometry: AdministrativeArea['geometry'] | undefined;
  if (level === 'municipality') {
    if (selectedAreas.some(({ geometry: candidate }) => candidate.type !== 'Polygon')) return;
    const coordinates = mergeMunicipalityPolygons(selectedAreas as PolygonAdministrativeArea[]);
    if (coordinates) geometry = { type: 'Polygon', coordinates };
  } else {
    geometry = mergeRegionGeometry(selectedAreas);
  }
  if (!geometry) return;
  return {
    countryCode: selectedAreas[0].countryCode,
    id: selectedAreas.map(({ id }) => id).join('+'),
    name: selectedAreas.map(({ name }) => name).join(' + '),
    level,
    source: selectedAreas[0].source,
    geometry,
  };
}

export function mergeAdministrativeAreas(ids: readonly string[]): AdministrativeArea | undefined {
  const areas = ids.map((id) => administrativeAreaById(id));
  if (areas.includes(undefined)) return;
  return mergeAdministrativeAreaRecords(areas as AdministrativeArea[]);
}
