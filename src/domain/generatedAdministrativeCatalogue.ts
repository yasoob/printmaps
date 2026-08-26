import type { AdministrativeArea, AdministrativeCountryCode } from './administrativeAreas';
import { MAX_MERCATOR_LATITUDE, type LayerGeometry } from './project';

const CATALOGUE_ROOT = '/data/administrative';
const MAX_INDEX_BYTES = 256_000;
const MAX_SHARD_BYTES = 20_000_000;
const MAX_COUNTRIES = 300;
const MAX_REGIONS_PER_COUNTRY = 500;
const MAX_POSITIONS_PER_SHARD = 500_000;

export type GeneratedAdministrativeCountry = Readonly<{
  id: AdministrativeCountryCode;
  name: string;
  bounds: readonly [number, number, number, number];
  levels: readonly ('country' | 'region')[];
  shard: string;
}>;

export type GeneratedAdministrativeIndex = Readonly<{
  sourceVersion: string;
  countries: readonly GeneratedAdministrativeCountry[];
}>;

type JsonObject = Record<string, unknown>;

type GeneratedBoundaryRecord = Readonly<{
  id: string;
  name: string;
  sourceId: string;
  geometry: Extract<LayerGeometry, { type: 'Polygon' | 'MultiPolygon' }>;
}>;

export type GeneratedAdministrativeShard = Readonly<{
  country: AdministrativeArea;
  regions: readonly AdministrativeArea[];
}>;

export class GeneratedAdministrativeCatalogueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeneratedAdministrativeCatalogueError';
  }
}

function fail(message: string): never {
  throw new GeneratedAdministrativeCatalogueError(message);
}

function objectValue(value: unknown, label: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${label} must be an object.`);
  return value as JsonObject;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be a non-empty string.`);
  if (value.length > 200) fail(`${label} must be 200 characters or fewer.`);
  return value;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be finite.`);
  return value;
}

function parseBounds(value: unknown, label: string): [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4) fail(`${label} must contain four values.`);
  const bounds = value.map((entry, index) => finiteNumber(entry, `${label} value ${index + 1}`)) as [number, number, number, number];
  if (bounds[0] < -180 || bounds[2] > 180 || bounds[1] < -90 || bounds[3] > 90
    || bounds[0] > bounds[2] || bounds[1] > bounds[3]) fail(`${label} is outside valid geographic bounds.`);
  return bounds;
}

function parsePosition(value: unknown, label: string, count: { value: number }): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) fail(`${label} must contain longitude and latitude.`);
  const longitude = finiteNumber(value[0], `${label} longitude`);
  const latitude = finiteNumber(value[1], `${label} latitude`);
  if (Math.abs(longitude) > 180) fail(`${label} longitude must be between -180 and 180.`);
  if (Math.abs(latitude) > MAX_MERCATOR_LATITUDE) {
    fail(`${label} latitude must be between -${MAX_MERCATOR_LATITUDE} and ${MAX_MERCATOR_LATITUDE}.`);
  }
  count.value += 1;
  if (count.value > MAX_POSITIONS_PER_SHARD) fail('The administrative boundary shard contains too many positions.');
  return [longitude, latitude];
}

function parsePolygon(value: unknown, label: string, count: { value: number }): [number, number][][] {
  if (!Array.isArray(value) || value.length === 0) fail(`${label} needs at least one ring.`);
  return value.map((ringValue, ringIndex) => {
    if (!Array.isArray(ringValue) || ringValue.length < 4) fail(`${label} ring ${ringIndex + 1} needs at least four positions.`);
    const ring = ringValue.map((position, positionIndex) => parsePosition(
      position,
      `${label} ring ${ringIndex + 1} position ${positionIndex + 1}`,
      count,
    ));
    const last = ring.at(-1);
    if (!last || ring[0][0] !== last[0] || ring[0][1] !== last[1]) fail(`${label} ring ${ringIndex + 1} must be closed.`);
    return ring;
  });
}

function parseGeometry(value: unknown, label: string, count: { value: number }): GeneratedBoundaryRecord['geometry'] {
  const geometry = objectValue(value, `${label} geometry`);
  if (geometry.type === 'Polygon') return { type: 'Polygon', coordinates: parsePolygon(geometry.coordinates, label, count) };
  if (geometry.type === 'MultiPolygon') {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) fail(`${label} needs at least one polygon.`);
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((polygon, index) => parsePolygon(polygon, `${label} polygon ${index + 1}`, count)),
    };
  }
  return fail(`${label} must use Polygon or MultiPolygon geometry.`);
}

function parseBoundary(value: unknown, label: string, count: { value: number }): GeneratedBoundaryRecord {
  const record = objectValue(value, label);
  return {
    id: stringValue(record.id, `${label} id`),
    name: stringValue(record.name, `${label} name`),
    sourceId: stringValue(record.sourceId, `${label} source id`),
    geometry: parseGeometry(record.geometry, label, count),
  };
}

async function cancelSafely(stream: { cancel: () => Promise<void> }): Promise<void> {
  try {
    await stream.cancel();
  } catch {
    return;
  }
}

async function responseTextWithinLimit(response: Response, maximumBytes: number): Promise<string> {
  const contentLength = response.headers.get('content-length')?.trim();
  if (contentLength && /^\d+$/.test(contentLength) && BigInt(contentLength) > BigInt(maximumBytes)) {
    if (response.body) await cancelSafely(response.body);
    return fail('Boundary data exceeds the safe size limit.');
  }
  if (!response.body) return fail('Boundary data response has no readable body.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maximumBytes) {
        await cancelSafely(reader);
        return fail('Boundary data exceeds the safe size limit.');
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function fetchJson(url: string, maximumBytes: number, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  signal?.throwIfAborted();
  if (!response.ok) fail(`Boundary data could not be loaded (${response.status}).`);
  const text = await responseTextWithinLimit(response, maximumBytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return fail('Boundary data is not valid JSON.');
  }
}

export async function loadGeneratedAdministrativeIndex(signal?: AbortSignal): Promise<GeneratedAdministrativeIndex> {
  const root = objectValue(await fetchJson(`${CATALOGUE_ROOT}/index.json`, MAX_INDEX_BYTES, signal), 'Administrative catalogue');
  if (root.schemaVersion !== 1) fail('Administrative catalogue version is unsupported.');
  const sourceVersion = stringValue(root.sourceVersion, 'Administrative catalogue source version');
  if (!Array.isArray(root.countries) || root.countries.length === 0 || root.countries.length > MAX_COUNTRIES) {
    fail('Administrative catalogue has an invalid country count.');
  }
  const seen = new Set<string>();
  const countries = root.countries.map((value, index): GeneratedAdministrativeCountry => {
    const country = objectValue(value, `Country ${index + 1}`);
    const id = stringValue(country.id, `Country ${index + 1} id`);
    if (!/^[A-Z0-9]{3}$/.test(id) || seen.has(id)) fail(`Country ${index + 1} has an invalid or duplicate id.`);
    seen.add(id);
    if (!Array.isArray(country.levels) || country.levels[0] !== 'country'
      || country.levels.some((level) => level !== 'country' && level !== 'region')) fail(`Country ${id} has invalid levels.`);
    const shard = stringValue(country.shard, `Country ${id} shard`);
    if (shard !== `countries/${id}.json`) fail(`Country ${id} has an invalid shard path.`);
    return {
      id,
      name: stringValue(country.name, `Country ${id} name`),
      bounds: parseBounds(country.bounds, `Country ${id} bounds`),
      levels: [...country.levels] as ('country' | 'region')[],
      shard,
    };
  });
  return { countries, sourceVersion };
}

export async function loadGeneratedAdministrativeShard(
  country: GeneratedAdministrativeCountry,
  sourceVersion: string,
  signal?: AbortSignal,
): Promise<GeneratedAdministrativeShard> {
  const root = objectValue(
    await fetchJson(`${CATALOGUE_ROOT}/${country.shard}`, MAX_SHARD_BYTES, signal),
    `${country.name} boundary shard`,
  );
  if (root.schemaVersion !== 1) fail(`${country.name} boundary data version is unsupported.`);
  if (!Array.isArray(root.regions) || root.regions.length > MAX_REGIONS_PER_COUNTRY) fail(`${country.name} has an invalid region count.`);
  const count = { value: 0 };
  const countryBoundary = parseBoundary(root.country, `${country.name} country boundary`, count);
  if (countryBoundary.id !== country.id || countryBoundary.name !== country.name) fail(`${country.name} country metadata does not match the catalogue.`);
  const seen = new Set([countryBoundary.id]);
  const regions = root.regions.map((value, index): AdministrativeArea => {
    const boundary = parseBoundary(value, `${country.name} region ${index + 1}`, count);
    if (seen.has(boundary.id)) fail(`${country.name} contains a duplicate boundary id.`);
    seen.add(boundary.id);
    return {
      countryCode: country.id,
      id: boundary.id,
      name: boundary.name,
      level: 'region',
      source: `${sourceVersion} Admin 1 States/Provinces (public domain)`,
      geometry: boundary.geometry,
    };
  });
  return {
    country: {
      countryCode: country.id,
      id: countryBoundary.id,
      name: countryBoundary.name,
      level: 'country',
      source: `${sourceVersion} Admin 0 Countries (public domain)`,
      geometry: countryBoundary.geometry,
    },
    regions,
  };
}
