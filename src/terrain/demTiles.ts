export const TERRAIN_TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const TERRAIN_ATTRIBUTION = 'Elevation: AWS Terrain Tiles (Mapzen), data from USGS, SRTM and other sources';
export const TERRAIN_ATTRIBUTION_HTML = '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Elevation: AWS Terrain Tiles (Mapzen), USGS, SRTM and other sources</a>';
export const DEM_TILE_SIZE = 256;
export const MAX_DEM_ZOOM = 12;
const MAX_TILE_BYTES = 1024 * 1024;

export function throwIfTerrainAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Terrain export cancelled.', 'AbortError');
}

export function decodeTerrariumPixels(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Float32Array {
  if (width !== DEM_TILE_SIZE || height !== DEM_TILE_SIZE || rgba.length !== width * height * 4) {
    throw new Error('Elevation tile has unexpected dimensions. Expected a 256 by 256 RGBA image.');
  }
  const elevations = new Float32Array(width * height);
  for (let index = 0; index < elevations.length; index++) {
    const offset = index * 4;
    const elevation = rgba[offset] * 256 + rgba[offset + 1] + rgba[offset + 2] / 256 - 32_768;
    elevations[index] = rgba[offset + 3] === 255 && elevation > -12_000 && elevation < 10_000 ? elevation : NaN;
  }
  return elevations;
}

export async function decodeTerrariumBlob(blob: Blob, signal?: AbortSignal): Promise<Float32Array> {
  throwIfTerrainAborted(signal);
  const header = new DataView(await blob.slice(0, 24).arrayBuffer());
  if (header.byteLength !== 24 || header.getUint32(0) !== 0x89_50_4E_47 || header.getUint32(4) !== 0x0D_0A_1A_0A || header.getUint32(12) !== 0x49_48_44_52 || header.getUint32(16) !== DEM_TILE_SIZE || header.getUint32(20) !== DEM_TILE_SIZE) {
    throw new Error('Elevation response is not a 256 by 256 PNG tile.');
  }
  throwIfTerrainAborted(signal);
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  try {
    throwIfTerrainAborted(signal);
    if (bitmap.width !== DEM_TILE_SIZE || bitmap.height !== DEM_TILE_SIZE) {
      throw new Error('Elevation provider returned an oversized or invalid tile.');
    }
    const canvas = new OffscreenCanvas(DEM_TILE_SIZE, DEM_TILE_SIZE);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('This browser cannot decode elevation tiles.');
    context.drawImage(bitmap, 0, 0);
    return decodeTerrariumPixels(context.getImageData(0, 0, DEM_TILE_SIZE, DEM_TILE_SIZE).data, DEM_TILE_SIZE, DEM_TILE_SIZE);
  } finally {
    bitmap.close();
  }
}

export async function fetchDemBlob(url: string, signal: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal, credentials: 'omit', mode: 'cors' });
  if (!response.ok) throw new Error(`Elevation tile request failed (HTTP ${response.status}). Retry or choose another area.`);
  if (Number(response.headers.get('content-length')) > MAX_TILE_BYTES) throw new Error('Elevation tile exceeds the download limit.');
  if (!response.body) throw new Error('The elevation provider returned an empty response.');
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    for (;;) {
      throwIfTerrainAborted(signal);
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_TILE_BYTES) throw new Error('Elevation tile exceeds the download limit.');
      chunks.push(new Uint8Array(value));
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  if (size === 0) throw new Error('The elevation provider returned an empty tile.');
  return new Blob(chunks, { type: 'image/png' });
}

export function demTileUrl(z: number, x: number, y: number): string {
  const tiles = 2 ** z;
  if (!Number.isSafeInteger(z) || z < 0 || z > MAX_DEM_ZOOM || !Number.isSafeInteger(x) || !Number.isSafeInteger(y) || y < 0 || y >= tiles) {
    throw new Error('Elevation tile is outside supported coverage.');
  }
  return TERRAIN_TILE_URL.replace('{z}', () => String(z)).replace('{x}', () => String(((x % tiles) + tiles) % tiles)).replace('{y}', () => String(y));
}

type TileLoader = (url: string, signal: AbortSignal) => Promise<Float32Array>;
type PendingTile = { controller: AbortController; promise: Promise<Float32Array>; users: number };

async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason ?? new DOMException('Terrain export cancelled.', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}

export class DemTileCache {
  private readonly tiles = new Map<string, Float32Array>();
  private readonly pending = new Map<string, PendingTile>();

  constructor(
    private readonly load: TileLoader = async (url, signal) => decodeTerrariumBlob(await fetchDemBlob(url, signal), signal),
    private readonly timeoutMs = 15_000,
  ) {}

  private async loadTile(url: string, controller: AbortController): Promise<Float32Array> {
    const timeout = setTimeout(() => controller.abort(new Error('Elevation download timed out. Check your connection and retry.')), this.timeoutMs);
    try {
      const tile = await abortable(this.load(url, controller.signal), controller.signal);
      if (tile.length !== DEM_TILE_SIZE * DEM_TILE_SIZE) throw new Error('Elevation tile has an invalid decoded size.');
      throwIfTerrainAborted(controller.signal);
      this.tiles.set(url, tile);
      if (this.tiles.size > 32) this.tiles.delete(this.tiles.keys().next().value!);
      return tile;
    } finally {
      clearTimeout(timeout);
      if (this.pending.get(url)?.controller === controller) this.pending.delete(url);
    }
  }

  private start(url: string): PendingTile {
    const controller = new AbortController();
    const entry = { controller, promise: this.loadTile(url, controller), users: 0 };
    this.pending.set(url, entry);
    return entry;
  }

  async get(z: number, x: number, y: number, signal?: AbortSignal): Promise<Float32Array> {
    throwIfTerrainAborted(signal);
    const url = demTileUrl(z, x, y);
    const cached = this.tiles.get(url);
    if (cached) {
      this.tiles.delete(url);
      this.tiles.set(url, cached);
      return cached;
    }
    const current = this.pending.get(url);
    const entry = current && !current.controller.signal.aborted ? current : this.start(url);
    entry.users++;
    try {
      return await (signal ? abortable(entry.promise, signal) : entry.promise);
    } finally {
      // Every consumer owns its cancellation; another export may still need the tile.
      entry.users--;
      if (entry.users === 0 && this.pending.get(url) === entry) entry.controller.abort();
    }
  }
}

export const sharedDemTileCache = new DemTileCache();
