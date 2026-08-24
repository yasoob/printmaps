import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SOURCE_URL = 'https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.1.0&typeName=ogdwien:BEZIRKSGRENZEOGD&srsName=EPSG:4326&outputFormat=json';
const SOURCE_FEATURES_SHA256 = 'dc08d94a2581d4dd70d57e5b010827cd211ea851fe6598c9325a603f739ba35f';
const SIMPLIFICATION_TOLERANCE_DEGREES = 0.00008;
const MAX_SIMPLIFIED_RING_POSITIONS = 500;
const MAX_RELATIVE_AREA_CHANGE = 0.003;

type Position = [number, number];
type SourceFeature = {
  geometry: { type: string; coordinates: Position[][] };
  properties: { BEZNR: number; NAMEK: string };
};
type SourceCollection = { type: string; features: SourceFeature[] };

function squaredSegmentDistance(point: Position, start: Position, end: Position): number {
  let [x, y] = start;
  const deltaX = end[0] - x;
  const deltaY = end[1] - y;
  if (deltaX !== 0 || deltaY !== 0) {
    const distance = ((point[0] - x) * deltaX + (point[1] - y) * deltaY) / (deltaX ** 2 + deltaY ** 2);
    if (distance > 1) [x, y] = end;
    else if (distance > 0) {
      x += deltaX * distance;
      y += deltaY * distance;
    }
  }
  return (point[0] - x) ** 2 + (point[1] - y) ** 2;
}

function simplifyLine(points: Position[], squaredTolerance: number): Position[] {
  if (points.length <= 2) return points;
  let farthestIndex = 0;
  let farthestDistance = squaredTolerance;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = squaredSegmentDistance(points[index], points[0], points.at(-1)!);
    if (distance > farthestDistance) {
      farthestDistance = distance;
      farthestIndex = index;
    }
  }
  if (farthestIndex === 0) return [points[0], points.at(-1)!];
  return [
    ...simplifyLine(points.slice(0, farthestIndex + 1), squaredTolerance).slice(0, -1),
    ...simplifyLine(points.slice(farthestIndex), squaredTolerance),
  ];
}

function ringArea(ring: Position[]): number {
  let area = 0;
  for (let index = 1; index < ring.length; index += 1) {
    area += ring[index - 1][0] * ring[index][1] - ring[index][0] * ring[index - 1][1];
  }
  return Math.abs(area / 2);
}

function simplifyRing(sourceRing: Position[]): Position[] {
  if (sourceRing.some(([longitude, latitude]) => (
    !Number.isFinite(longitude) || !Number.isFinite(latitude)
    || Math.abs(longitude) > 180 || Math.abs(latitude) > 90
  ))) {
    throw new Error('Vienna district source contains an invalid coordinate.');
  }
  const positions = sourceRing.slice(0, -1);
  if (positions.length < 3 || sourceRing[0].join(',') !== sourceRing.at(-1)?.join(',')) {
    throw new Error('Vienna district source contains an invalid ring.');
  }
  const pivot = positions.reduce((current, position, index) => {
    const candidate = positions[current];
    return position[0] < candidate[0] || (position[0] === candidate[0] && position[1] < candidate[1]) ? index : current;
  }, 0);
  const rotated = [...positions.slice(pivot), ...positions.slice(0, pivot), positions[pivot]];
  const simplified = simplifyLine(rotated, SIMPLIFICATION_TOLERANCE_DEGREES ** 2)
    .map(([longitude, latitude]): Position => [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))]);
  if (simplified.length < 4 || simplified[0].join() !== simplified.at(-1)?.join()) {
    throw new Error('Vienna district simplification produced an invalid ring.');
  }
  if (simplified.length > MAX_SIMPLIFIED_RING_POSITIONS) {
    throw new Error('Vienna district simplification exceeded its position budget.');
  }
  const sourceArea = ringArea(sourceRing);
  const relativeAreaChange = sourceArea === 0 ? Number.POSITIVE_INFINITY : Math.abs(ringArea(simplified) - sourceArea) / sourceArea;
  if (relativeAreaChange > MAX_RELATIVE_AREA_CHANGE) {
    throw new Error('Vienna district simplification exceeded its area-change budget.');
  }
  return simplified;
}

async function sourceBytes(): Promise<Uint8Array> {
  const sourcePath = process.argv[2];
  if (sourcePath) return readFile(resolve(sourcePath));
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Vienna district source returned HTTP ${response.status}.`);
  return new Uint8Array(await response.arrayBuffer());
}

const bytes = await sourceBytes();
const collection = JSON.parse(new TextDecoder().decode(bytes)) as SourceCollection;
if (
  collection.type !== 'FeatureCollection'
  || collection.features.length !== 23
  || collection.features.some((feature) => (
    feature.geometry?.type !== 'Polygon'
    || !Array.isArray(feature.geometry.coordinates)
    || !Number.isInteger(feature.properties?.BEZNR)
    || typeof feature.properties.NAMEK !== 'string'
    || feature.properties.NAMEK.trim() === ''
  ))
) {
  throw new Error('Vienna district source must contain exactly 23 features.');
}
const sortedFeatures = [...collection.features].sort((left, right) => left.properties.BEZNR - right.properties.BEZNR);
const canonicalFeatures = sortedFeatures.map((feature) => [
  feature.properties.BEZNR,
  feature.properties.NAMEK,
  feature.geometry.type,
  feature.geometry.coordinates,
]);
const sourceFeaturesHash = createHash('sha256').update(JSON.stringify(canonicalFeatures)).digest('hex');
if (sourceFeaturesHash !== SOURCE_FEATURES_SHA256) {
  throw new Error(`Vienna district source geometry changed: expected ${SOURCE_FEATURES_SHA256}, received ${sourceFeaturesHash}. Review provenance before regenerating.`);
}
const districts = sortedFeatures
  .map((feature) => {
    return {
      id: `AT-9-${String(feature.properties.BEZNR).padStart(2, '0')}`,
      name: feature.properties.NAMEK,
      coordinates: feature.geometry.coordinates.map(simplifyRing),
    };
  })
  .sort((left, right) => left.id.localeCompare(right.id));
if (new Set(districts.map(({ id }) => id)).size !== 23) {
  throw new Error('Vienna district source contains duplicate district identifiers.');
}
const output = `// Generated by scripts/generate-vienna-districts.mts.\n// Source: ${SOURCE_URL}\n// Retrieved 2026-08-24; canonical feature SHA-256: ${SOURCE_FEATURES_SHA256}.\n// License: CC BY 3.0 AT; geometry simplified at ${SIMPLIFICATION_TOLERANCE_DEGREES}° tolerance.\nexport const VIENNA_DISTRICTS = ${JSON.stringify(districts)} as const;\n`;
await writeFile(resolve(import.meta.dirname, '../src/data/viennaDistricts.ts'), output);
