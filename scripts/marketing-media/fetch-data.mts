/**
 * Refreshes the cached geodata used by the marketing demo projects.
 * Routes come from the public OSRM demo servers, travel-time polygons from the
 * FOSSGIS Valhalla server and coordinates from Nominatim (all OpenStreetMap data).
 * Run rarely: `node scripts/marketing-media/fetch-data.mts`.
 */
import { writeFile } from 'node:fs/promises';

type Position = [number, number];
const userAgent = 'PrintMapStudioMarketingMedia/1.0 (https://printmaps.yasoob.me)';
const dataDirectory = new URL('../../tests/marketing-media/data/', import.meta.url);

async function json(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { 'User-Agent': userAgent, ...init?.headers } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

const round = (value: number) => Number(value.toFixed(5));

function simplify(points: Position[], tolerance: number): Position[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    const [ax, ay] = points[start];
    const [bx, by] = points[end];
    let maxDistance = 0;
    let index = -1;
    for (let cursor = start + 1; cursor < end; cursor += 1) {
      const [px, py] = points[cursor];
      const length = Math.hypot(bx - ax, by - ay) || 1e-12;
      const distance = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
      if (distance > maxDistance) {
        maxDistance = distance;
        index = cursor;
      }
    }
    if (maxDistance > tolerance && index > 0) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, index) => keep[index]).map(([x, y]) => [round(x), round(y)]);
}

async function osrmRoute(server: string, waypoints: Position[], tolerance: number) {
  const path = waypoints.map(([x, y]) => `${x},${y}`).join(';');
  const result = await json(`${server}/route/v1/driving/${path}?overview=full&geometries=geojson`);
  const route = result.routes[0];
  return {
    waypoints,
    distanceMeters: Math.round(route.distance),
    durationSeconds: Math.round(route.duration),
    geometry: simplify(route.geometry.coordinates, tolerance),
  };
}

async function valhallaIsochrone(center: Position, costing: 'bicycle' | 'pedestrian', minutes: number) {
  const body = { locations: [{ lon: center[0], lat: center[1] }], costing, contours: [{ time: minutes }], polygons: true, denoise: 0.5, generalize: 30 };
  const result = await json(`https://valhalla1.openstreetmap.de/isochrone?json=${encodeURIComponent(JSON.stringify(body))}`);
  const geometry = result.features[0].geometry;
  const rings = geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates[0];
  return { center, costing, minutes, coordinates: rings.map((ring: Position[]) => ring.map(([x, y]) => [round(x), round(y)])) };
}

async function nominatim(query: string): Promise<Position> {
  const [result] = await json(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`);
  if (!result) throw new Error(`No Nominatim result for ${query}`);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  return [round(Number(result.lon)), round(Number(result.lat))];
}

const utah = await osrmRoute('https://router.project-osrm.org', [
  [-112.9866, 37.2002], [-112.166, 37.6227], [-111.2475, 38.2836], [-109.6198, 38.6166],
], 0.002);
const ventoux = await osrmRoute('https://routing.openstreetmap.de/routed-bike', [
  [5.1786, 44.1243], [5.2786, 44.1741],
], 0.00004);
const thames = await osrmRoute('https://routing.openstreetmap.de/routed-foot', [
  [-0.0754, 51.5055], [-0.1243, 51.5085], [-0.17, 51.484], [-0.2133, 51.4669], [-0.225, 51.49], [-0.231, 51.487],
  [-0.229, 51.47], [-0.157, 51.4791], [-0.115, 51.507], [-0.0754, 51.504], [-0.03, 51.5], [-0.0098, 51.4828],
], 0.00011);
const lisbonWalk = await osrmRoute('https://routing.openstreetmap.de/routed-foot', [
  [-9.15, 38.7253], [-9.1393, 38.7139], [-9.1365, 38.7077], [-9.1334, 38.7098], [-9.1334, 38.7139], [-9.1316, 38.7163],
], 0.00003);
const amsterdam: Position = [4.8932, 52.3731];
const amsterdamIsochrones = [];
for (const minutes of [10, 20, 30]) amsterdamIsochrones.push(await valhallaIsochrone(amsterdam, 'pedestrian', minutes));

const cliftonQueries = {
  home: 'Royal York Crescent, Bristol',
  bridge: 'Clifton Suspension Bridge, Bristol',
  station: 'Clifton Down railway station, Bristol',
  school: 'Christ Church Primary School, Clifton',
  park: 'Brandon Hill, Bristol',
  market: 'Whiteladies Road, Bristol',
};
const clifton: Record<string, Position> = {};
for (const [key, query] of Object.entries(cliftonQueries)) clifton[key] = await nominatim(query);
const cliftonWalk = await valhallaIsochrone(clifton.home, 'pedestrian', 15);

await writeFile(new URL('routes.json', dataDirectory), `${JSON.stringify({ utah, ventoux, thames, lisbonWalk }, null, 1)}\n`);
await writeFile(new URL('isochrones.json', dataDirectory), `${JSON.stringify({ amsterdam: amsterdamIsochrones, cliftonWalk }, null, 1)}\n`);
await writeFile(new URL('places.json', dataDirectory), `${JSON.stringify({ clifton }, null, 1)}\n`);
console.log('utah', utah.geometry.length, 'ventoux', ventoux.geometry.length, 'thames', thames.geometry.length, thames.distanceMeters);
