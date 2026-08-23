import type { LayerGeometry } from './project';
import { AUSTRIA_ADMIN_1_REGIONS } from '../data/austriaAdmin1';
import { AUSTRIA_TYROL_REGION } from '../data/austriaTyrol';

export type AdministrativeAreaId =
  | 'AUT'
  | 'HUN'
  | 'SVK'
  | 'AT-1'
  | 'AT-2'
  | 'AT-3'
  | 'AT-4'
  | 'AT-5'
  | 'AT-6'
  | 'AT-7'
  | 'AT-8'
  | 'AT-9';

export type AdministrativeArea = Readonly<{
  id: string;
  name: string;
  level: 'country' | 'region';
  source: string;
  geometry: Extract<LayerGeometry, { type: 'Polygon' | 'MultiPolygon' }>;
}>;
type PolygonAdministrativeArea = AdministrativeArea & {
  geometry: Extract<LayerGeometry, { type: 'Polygon' }>;
};

const SOURCE = 'Natural Earth 1:110m Admin 0 Countries (public domain), downloaded 2026-08-23';
const REGION_SOURCE = 'Natural Earth 1:10m Admin 1 States/Provinces (public domain), downloaded 2026-08-23';
const polygonRegionAreas = AUSTRIA_ADMIN_1_REGIONS.map((region): AdministrativeArea => ({
  id: region.id,
  name: region.name,
  level: 'region',
  source: REGION_SOURCE,
  geometry: {
    type: 'Polygon',
    coordinates: region.coordinates.map((ring) => ring.map(([longitude, latitude]) => (
      [longitude, latitude] as [number, number]
    ))),
  },
}));
const tyrolArea: AdministrativeArea = {
  id: AUSTRIA_TYROL_REGION.id,
  name: AUSTRIA_TYROL_REGION.name,
  level: 'region',
  source: REGION_SOURCE,
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

export const ADMINISTRATIVE_AREAS: readonly AdministrativeArea[] = [
  {
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
  {
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
  {
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
] as const;

export function administrativeAreaById(id: string): AdministrativeArea | undefined {
  return ADMINISTRATIVE_AREAS.find((area) => area.id === id);
}

const positionKey = ([longitude, latitude]: readonly [number, number]) => `${longitude},${latitude}`;
type BoundaryEdge = readonly [[number, number], [number, number]];

function addRingEdges(edges: Map<string, BoundaryEdge>, ring: readonly (readonly [number, number])[]) {
  for (let index = 1; index < ring.length; index += 1) {
    const start = ring[index - 1];
    const end = ring[index];
    const key = `${positionKey(start)}>${positionKey(end)}`;
    const reverseKey = `${positionKey(end)}>${positionKey(start)}`;
    if (!edges.delete(reverseKey)) edges.set(key, [[...start], [...end]]);
  }
}

function haveSharedBoundary(left: PolygonAdministrativeArea, right: PolygonAdministrativeArea): boolean {
  const leftEdges = new Set<string>();
  for (const ring of left.geometry.coordinates) {
    for (let index = 1; index < ring.length; index += 1) {
      leftEdges.add(`${positionKey(ring[index - 1])}>${positionKey(ring[index])}`);
    }
  }
  return right.geometry.coordinates.some((ring) => ring.some((position, index) => (
    index > 0 && leftEdges.has(`${positionKey(position)}>${positionKey(ring[index - 1])}`)
  )));
}

function isConnectedSelection(areas: readonly PolygonAdministrativeArea[]): boolean {
  const connected = new Set([0]);
  while (connected.size < areas.length) {
    const adjacentIndex = areas.findIndex((area, index) => (
      !connected.has(index)
      && [...connected].some((candidate) => haveSharedBoundary(areas[candidate], area))
    ));
    if (adjacentIndex === -1) return false;
    connected.add(adjacentIndex);
  }
  return true;
}

function edgeStartingAt(edges: Map<string, BoundaryEdge>, startKey: string): [string, BoundaryEdge] | undefined {
  for (const [key, edge] of edges) {
    if (positionKey(edge[0]) === startKey) return [key, edge];
  }
}

function reversedRing(ring: readonly [number, number][]): [number, number][] {
  const reversed: [number, number][] = [];
  for (let index = ring.length - 1; index >= 0; index -= 1) reversed.push(ring[index]);
  return reversed;
}

function mergeAlignedRings(areas: readonly PolygonAdministrativeArea[]): [number, number][][] | undefined {
  const edges = new Map<string, BoundaryEdge>();
  for (const area of areas) {
    for (const ring of area.geometry.coordinates) addRingEdges(edges, ring);
  }

  const remaining = new Map(edges);
  const rings: [number, number][][] = [];
  while (remaining.size > 0) {
    const firstEntry = remaining.entries().next().value;
    if (!firstEntry) return;
    const [firstKey, firstEdge] = firstEntry;
    remaining.delete(firstKey);
    const ring: [number, number][] = [[...firstEdge[0]], [...firstEdge[1]]];
    while (positionKey(ring.at(-1)!) !== positionKey(ring[0])) {
      const currentKey = positionKey(ring.at(-1)!);
      const nextEntry = edgeStartingAt(remaining, currentKey);
      if (!nextEntry) return;
      remaining.delete(nextEntry[0]);
      ring.push([...nextEntry[1][1]]);
      if (ring.length > edges.size + 1) return;
    }
    rings.push(ring);
  }
  rings.sort((left, right) => Math.abs(ringArea(right)) - Math.abs(ringArea(left)));
  return rings.map((ring, index) => {
    const isCounterClockwise = ringArea(ring) > 0;
    const shouldBeCounterClockwise = index === 0;
    return isCounterClockwise === shouldBeCounterClockwise ? ring : reversedRing(ring);
  });
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

export function mergeAdministrativeAreas(ids: readonly string[]): AdministrativeArea | undefined {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0 || uniqueIds.length !== ids.length) return;
  const areas = uniqueIds.map((id) => administrativeAreaById(id));
  if (areas.some((area) => !area || area.level !== 'region')) return;
  const regions = areas as AdministrativeArea[];
  if (regions.length === 1) return regions[0];
  if (regions.some(({ geometry }) => geometry.type !== 'Polygon')) return;
  const polygonRegions = regions as PolygonAdministrativeArea[];
  if (!isConnectedSelection(polygonRegions)) return;
  const coordinates = mergeAlignedRings(polygonRegions);
  if (!coordinates) return;
  return {
    id: regions.map(({ id }) => id).join('+'),
    name: regions.map(({ name }) => name).join(' + '),
    level: 'region',
    source: REGION_SOURCE,
    geometry: { type: 'Polygon', coordinates },
  };
}
