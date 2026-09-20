import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import type { VectorSourceSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { VectorProjection } from './projection';
import { checkVectorSignal, VECTOR_LIMITS, vectorUnsupported } from './scene';

export type CapturedVectorTile = Readonly<{ x: number; y: number; z: number; tile: VectorTile }>;
export type VectorBudget = { bytes: number; tiles: number; features: number; points: number };

export async function boundedVectorFetch(url: string, signal: AbortSignal, budget: VectorBudget): Promise<Uint8Array<ArrayBuffer>> {
  checkVectorSignal(signal);
  const resolved = new URL(url, globalThis.location?.href ?? 'http://localhost');
  if (!['https:', 'http:'].includes(resolved.protocol)) vectorUnsupported(`Source protocol "${resolved.protocol}" cannot be captured as vector tiles.`);
  const response = await fetch(resolved, { signal });
  if (!response.ok) throw new Error(`Vector source request failed (${response.status}): ${resolved.host}. Retry or choose Hybrid mode.`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('This browser cannot stream bounded vector source data.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      budget.bytes += value.byteLength;
      if (length > VECTOR_LIMITS.tileBytes || budget.bytes > VECTOR_LIMITS.totalBytes) {
        vectorUnsupported('Vector data exceeds the 4 MiB per-resource / 32 MiB total safety budget. Zoom in or reduce the frame.');
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

function zoomField(metadata: object, name: string, fallback: number): number {
  if (!Object.hasOwn(metadata, name)) return fallback;
  const value: unknown = Reflect.get(metadata, name);
  if (typeof value !== 'number') vectorUnsupported(`TileJSON "${name}" is not a number.`);
  return value;
}

function parseTileJson(metadata: unknown): { tiles: string[]; minzoom: number; maxzoom: number; scheme: 'xyz' | 'tms' } {
  if (!metadata || typeof metadata !== 'object' || !('tiles' in metadata) || !Array.isArray(metadata.tiles)
    || !metadata.tiles.every((tile): tile is string => typeof tile === 'string')) {
    throw new Error('Vector source TileJSON has no valid tile templates.');
  }
  if ('encoding' in metadata && metadata.encoding !== 'mvt') vectorUnsupported('The vector source does not use supported MVT encoding.');
  return {
    tiles: metadata.tiles as string[],
    minzoom: zoomField(metadata, 'minzoom', 0),
    maxzoom: zoomField(metadata, 'maxzoom', 22),
    scheme: 'scheme' in metadata && metadata.scheme === 'tms' ? 'tms' : 'xyz',
  };
}

async function resolveSource(source: VectorSourceSpecification, signal: AbortSignal, budget: VectorBudget) {
  let resolved = { tiles: source.tiles, minzoom: source.minzoom ?? 0, maxzoom: source.maxzoom ?? 22, scheme: source.scheme ?? 'xyz' };
  if (source.url) {
    const bytes = await boundedVectorFetch(source.url, signal, budget);
    const metadata = parseTileJson(JSON.parse(new TextDecoder().decode(bytes)));
    resolved = metadata;
  }
  const { tiles, minzoom, maxzoom, scheme } = resolved;
  if (!tiles?.length || !Number.isSafeInteger(minzoom) || !Number.isSafeInteger(maxzoom) || minzoom < 0 || maxzoom > 24 || minzoom > maxzoom) {
    vectorUnsupported('The vector source has invalid tile templates or zoom limits.');
  }
  return { tiles, minzoom, maxzoom, scheme };
}

function tileCoordinates(projection: VectorProjection, minzoom: number, maxzoom: number, budget: VectorBudget) {
  if (projection.zoom < minzoom) return [];
  const z = Math.min(maxzoom, Math.floor(projection.zoom)), count = 2 ** z;
  const xs = projection.corners.map(({ x }) => x * count), ys = projection.corners.map(({ y }) => y * count);
  const minX = Math.floor(Math.min(...xs)), maxX = Math.floor(Math.max(...xs));
  const minY = Math.max(0, Math.floor(Math.min(...ys))), maxY = Math.min(count - 1, Math.floor(Math.max(...ys)));
  budget.tiles += (maxX - minX + 1) * (maxY - minY + 1);
  if (budget.tiles > VECTOR_LIMITS.tiles) vectorUnsupported('The frame exceeds the 64-tile vector budget. Zoom in or reduce the frame.');
  const output: { x: number; y: number; z: number }[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) output.push({ x, y, z });
  }
  return output;
}

export async function captureVectorTiles(source: VectorSourceSpecification, projection: VectorProjection, signal: AbortSignal, budget: VectorBudget): Promise<CapturedVectorTile[]> {
  if (source.encoding && source.encoding !== 'mvt') vectorUnsupported('The vector source does not use supported MVT encoding.');
  const { tiles, minzoom, maxzoom, scheme } = await resolveSource(source, signal, budget);
  const coordinates = tileCoordinates(projection, minzoom, maxzoom, budget);
  const output: CapturedVectorTile[] = [];
  for (const { x, y, z } of coordinates) {
    checkVectorSignal(signal);
    const count = 2 ** z, wrappedX = ((x % count) + count) % count;
    const url = tiles[0].replaceAll('{z}', () => String(z)).replaceAll('{x}', () => String(wrappedX))
      .replaceAll('{y}', () => String(scheme === 'tms' ? count - y - 1 : y));
    if (url.includes('{')) vectorUnsupported('The vector source requires an unsupported tile URL parameter.');
    const base = source.url ? new URL(source.url, globalThis.location?.href ?? 'http://localhost') : undefined;
    const absoluteUrl = base ? new URL(url, base).href : url;
    const bytes = await boundedVectorFetch(absoluteUrl, signal, budget);
    output.push({ x, y, z, tile: new VectorTile(new PbfReader(bytes)) });
  }
  return output;
}
