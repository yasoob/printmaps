import { union as unionPolygons, type Polygon as ClippingPolygon } from 'polygon-clipping';
import type { LayerGeometry } from './project';
import { AUSTRIA_ADMIN_1_REGIONS } from '../data/austriaAdmin1';
import { AUSTRIA_TYROL_REGION } from '../data/austriaTyrol';
import { SLOVAKIA_ADMIN_1_REGIONS } from '../data/slovakiaAdmin1';
import { VIENNA_DISTRICTS } from '../data/viennaDistricts';
import { BELGIUM_COUNTRY_AREA, BELGIUM_REGION_AREAS } from './belgiumAdministrativeAreas';
import { BULGARIA_COUNTRY_AREA, BULGARIA_REGION_AREAS } from './bulgariaAdministrativeAreas';
import { CZECHIA_COUNTRY_AREA, CZECHIA_REGION_AREAS } from './czechiaAdministrativeAreas';
import { DENMARK_COUNTRY_AREA, DENMARK_REGION_AREAS } from './denmarkAdministrativeAreas';
import { ESTONIA_COUNTRY_AREA, ESTONIA_REGION_AREAS } from './estoniaAdministrativeAreas';
import { FINLAND_COUNTRY_AREA, FINLAND_REGION_AREAS } from './finlandAdministrativeAreas';
import { GERMANY_COUNTRY_AREA, GERMANY_REGION_AREAS } from './germanyAdministrativeAreas'; import { GREECE_COUNTRY_AREA, GREECE_REGION_AREAS } from './greeceAdministrativeAreas';
import { HUNGARY_REGION_AREAS } from './hungaryAdministrativeAreas';
import { ITALY_COUNTRY_AREA, ITALY_REGION_AREAS } from './italyAdministrativeAreas';
import { LITHUANIA_COUNTRY_AREA, LITHUANIA_REGION_AREAS } from './lithuaniaAdministrativeAreas';
import { NETHERLANDS_COUNTRY_AREA, NETHERLANDS_REGION_AREAS } from './netherlandsAdministrativeAreas';
import { POLAND_COUNTRY_AREA, POLAND_REGION_AREAS } from './polandAdministrativeAreas';
import { PORTUGAL_COUNTRY_AREA, PORTUGAL_REGION_AREAS } from './portugalAdministrativeAreas';
import { SPAIN_COUNTRY_AREA, SPAIN_REGION_AREAS } from './spainAdministrativeAreas';
import { SWITZERLAND_COUNTRY_AREA, SWITZERLAND_REGION_AREAS } from './switzerlandAdministrativeAreas';
import { SWEDEN_COUNTRY_AREA, SWEDEN_REGION_AREAS } from './swedenAdministrativeAreas';
// Generated catalogue IDs are runtime-validated so world coverage does not become a compiler-heavy union.
export type AdministrativeCountryCode = string;
export type AdministrativeAreaId = string;

export type AdministrativeArea = Readonly<{
  countryCode: AdministrativeCountryCode; id: string;
  name: string;
  level: 'country' | 'region' | 'municipality';
  source: string;
  geometry: Extract<LayerGeometry, { type: 'Polygon' | 'MultiPolygon' }>;
}>;
type PolygonAdministrativeArea = AdministrativeArea & { geometry: Extract<LayerGeometry, { type: 'Polygon' }> };

const SOURCE = 'Natural Earth 1:110m Admin 0 Countries (public domain), downloaded 2026-08-23', AUSTRIA_REGION_SOURCE = 'Natural Earth 1:10m Admin 1 States/Provinces (public domain), downloaded 2026-08-23';
const SLOVAKIA_REGION_SOURCE = 'Natural Earth 1:10m Admin 1 States/Provinces (public domain), downloaded 2026-08-26';
const MUNICIPALITY_SOURCE = 'City of Vienna Open Government Data district boundaries (CC BY 3.0 AT), downloaded 2026-08-24 and simplified at 0.00008° tolerance';
const MUNICIPALITY_SLIVER_AREA_LIMIT = 1e-6, MUNICIPALITY_SLIVER_AREA_RATIO = 1e-4;
export const VIENNA_DISTRICT_SOURCE_URL = 'https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.1.0&typeName=ogdwien:BEZIRKSGRENZEOGD&srsName=EPSG:4326&outputFormat=json',
  VIENNA_DISTRICT_LICENSE_URL = 'https://creativecommons.org/licenses/by/3.0/at/';
const polygonRegionAreas = AUSTRIA_ADMIN_1_REGIONS.map((region): AdministrativeArea => ({
  countryCode: 'AUT',
  id: region.id,
  name: region.name,
  level: 'region',
  source: AUSTRIA_REGION_SOURCE,
  geometry: {
    type: 'Polygon',
    coordinates: region.coordinates.map((ring) => ring.map(([longitude, latitude]) => (
      [longitude, latitude] as [number, number]
    ))),
  },
}));
const tyrolArea: AdministrativeArea = {
  countryCode: 'AUT',
  id: AUSTRIA_TYROL_REGION.id,
  name: AUSTRIA_TYROL_REGION.name,
  level: 'region',
  source: AUSTRIA_REGION_SOURCE,
  geometry: {
    type: 'MultiPolygon',
    coordinates: AUSTRIA_TYROL_REGION.coordinates.map((polygon) => polygon.map((ring) => ring.map(([longitude, latitude]) => (
      [longitude, latitude] as [number, number]
    )))),
  },
};
const austriaRegionAreas = [
  ...polygonRegionAreas.slice(0, 6),
  tyrolArea,
  ...polygonRegionAreas.slice(6),
];
const slovakiaRegionAreas = SLOVAKIA_ADMIN_1_REGIONS.map((region): AdministrativeArea => ({
  countryCode: 'SVK',
  id: region.id,
  name: region.name,
  level: 'region',
  source: SLOVAKIA_REGION_SOURCE,
  geometry: {
    type: 'Polygon',
    coordinates: region.coordinates.map((ring) => ring.map(([longitude, latitude]) => (
      [longitude, latitude] as [number, number]
    ))),
  },
}));
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

export const ADMINISTRATIVE_AREAS: readonly AdministrativeArea[] = [
  {
    countryCode: 'AUT',
    id: 'AUT',
    name: 'Austria',
    level: 'country',
    source: SOURCE,
    geometry: { type: 'Polygon', coordinates: [[
      [16.979667, 48.123497], [16.903754, 47.714866], [16.340584, 47.712902], [16.534268, 47.496171],
      [16.202298, 46.852386], [16.011664, 46.683611], [15.137092, 46.658703], [14.632472, 46.431817],
      [13.806475, 46.509306], [12.376485, 46.767559], [12.153088, 47.115393], [11.164828, 46.941579],
      [11.048556, 46.751359], [10.442701, 46.893546], [9.932448, 46.920728], [9.47997, 47.10281],
      [9.632932, 47.347601], [9.594226, 47.525058], [9.896068, 47.580197], [10.402084, 47.302488],
      [10.544504, 47.566399], [11.426414, 47.523766], [12.141357, 47.703083], [12.62076, 47.672388],
      [12.932627, 47.467646], [13.025851, 47.637584], [12.884103, 48.289146], [13.243357, 48.416115],
      [13.595946, 48.877172], [14.338898, 48.555305], [14.901447, 48.964402], [15.253416, 49.039074],
      [16.029647, 48.733899], [16.499283, 48.785808], [16.960288, 48.596982], [16.879983, 48.470013],
      [16.979667, 48.123497],
    ]] },
  },
  BELGIUM_COUNTRY_AREA, BULGARIA_COUNTRY_AREA, NETHERLANDS_COUNTRY_AREA, DENMARK_COUNTRY_AREA, ESTONIA_COUNTRY_AREA, FINLAND_COUNTRY_AREA, ITALY_COUNTRY_AREA, SWEDEN_COUNTRY_AREA, LITHUANIA_COUNTRY_AREA, GERMANY_COUNTRY_AREA, GREECE_COUNTRY_AREA, SWITZERLAND_COUNTRY_AREA,
  {
    countryCode: 'HUN',
    id: 'HUN',
    name: 'Hungary',
    level: 'country',
    source: SOURCE,
    geometry: { type: 'Polygon', coordinates: [[
      [22.085608, 48.422264], [22.64082, 48.15024], [22.710531, 47.882194], [22.099768, 47.672439],
      [21.626515, 46.994238], [21.021952, 46.316088], [20.220192, 46.127469], [19.596045, 46.17173],
      [18.829838, 45.908878], [18.829825, 45.908872], [18.456062, 45.759481], [17.630066, 45.951769],
      [16.882515, 46.380632], [16.564808, 46.503751], [16.370505, 46.841327], [16.202298, 46.852386],
      [16.534268, 47.496171], [16.340584, 47.712902], [16.903754, 47.714866], [16.979667, 48.123497],
      [17.488473, 47.867466], [17.857133, 47.758429], [18.696513, 47.880954], [18.777025, 48.081768],
      [19.174365, 48.111379], [19.661364, 48.266615], [19.769471, 48.202691], [20.239054, 48.327567],
      [20.473562, 48.56285], [20.801294, 48.623854], [21.872236, 48.319971], [22.085608, 48.422264],
    ]] },
  },
  CZECHIA_COUNTRY_AREA,
  POLAND_COUNTRY_AREA,
  PORTUGAL_COUNTRY_AREA,
  SPAIN_COUNTRY_AREA,
  {
    countryCode: 'SVK',
    id: 'SVK',
    name: 'Slovakia',
    level: 'country',
    source: SOURCE,
    geometry: { type: 'Polygon', coordinates: [[
      [22.558138, 49.085738], [22.280842, 48.825392], [22.085608, 48.422264], [21.872236, 48.319971],
      [20.801294, 48.623854], [20.473562, 48.56285], [20.239054, 48.327567], [19.769471, 48.202691],
      [19.661364, 48.266615], [19.174365, 48.111379], [18.777025, 48.081768], [18.696513, 47.880954],
      [17.857133, 47.758429], [17.488473, 47.867466], [16.979667, 48.123497], [16.879983, 48.470013],
      [16.960288, 48.596982], [17.101985, 48.816969], [17.545007, 48.800019], [17.886485, 48.903475],
      [17.913512, 48.996493], [18.104973, 49.043983], [18.170498, 49.271515], [18.399994, 49.315001],
      [18.554971, 49.495015], [18.853144, 49.49623], [18.909575, 49.435846], [19.320713, 49.571574],
      [19.825023, 49.217125], [20.415839, 49.431453], [20.887955, 49.328772], [21.607808, 49.470107],
      [22.558138, 49.085738],
    ]] },
  },
  ...austriaRegionAreas,
  ...BELGIUM_REGION_AREAS, ...BULGARIA_REGION_AREAS, ...CZECHIA_REGION_AREAS,
  ...DENMARK_REGION_AREAS, ...ESTONIA_REGION_AREAS, ...FINLAND_REGION_AREAS,
  ...GERMANY_REGION_AREAS, ...GREECE_REGION_AREAS, ...HUNGARY_REGION_AREAS, ...ITALY_REGION_AREAS, ...LITHUANIA_REGION_AREAS,
  ...NETHERLANDS_REGION_AREAS, ...POLAND_REGION_AREAS, ...PORTUGAL_REGION_AREAS, ...SPAIN_REGION_AREAS,
  ...slovakiaRegionAreas, ...SWEDEN_REGION_AREAS,
  ...SWITZERLAND_REGION_AREAS,
  ...viennaMunicipalAreas,
] as const;

export function administrativeAreaById(id: string): AdministrativeArea | undefined {
  return ADMINISTRATIVE_AREAS.find((area) => area.id === id);
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
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
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

function ringArea(ring: readonly (readonly [number, number])[]): number {
  let area = 0;
  for (let index = 1; index < ring.length; index += 1) {
    const [x1, y1] = ring[index - 1];
    const [x2, y2] = ring[index];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

type MergeableAdministrativeLevel = Extract<AdministrativeArea['level'], 'region' | 'municipality'>;

type AdministrativeAreaSelection = { areas: AdministrativeArea[]; level: MergeableAdministrativeLevel };

function administrativeAreaSelection(areas: readonly AdministrativeArea[]): AdministrativeAreaSelection | undefined {
  const uniqueIds = new Set(areas.map(({ id }) => id));
  if (areas.length === 0 || uniqueIds.size !== areas.length) return;
  const level = areas[0]?.level, countryCode = areas[0]?.countryCode;
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
    countryCode: selectedAreas[0].countryCode, id: selectedAreas.map(({ id }) => id).join('+'), name: selectedAreas.map(({ name }) => name).join(' + '),
    level, source: selectedAreas[0].source, geometry,
  };
}

export function mergeAdministrativeAreas(ids: readonly string[]): AdministrativeArea | undefined {
  const areas = ids.map((id) => administrativeAreaById(id));
  if (areas.includes(undefined)) return;
  return mergeAdministrativeAreaRecords(areas as AdministrativeArea[]);
}
