import { DEM_TILE_SIZE, MAX_DEM_ZOOM, sharedDemTileCache, throwIfTerrainAborted, type DemTileCache } from './demTiles';
import { terrainFrame, type TerrainFootprint, type Point2 } from './terrainFootprint';

export type ElevationGrid = Readonly<{
  columns: number;
  rows: number;
  elevations: Float32Array;
  widthMeters: number;
  heightMeters: number;
}>;
export type TerrainProgress = (fraction: number, message: string) => void;
type Pixel = Readonly<{ x: number; y: number }>;
type Tile = Readonly<{ x: number; y: number; key: string }>;

export function terrainGridDimensions(detail: number, aspect: number) {
  if (!Number.isSafeInteger(detail) || detail < 32 || detail > 256 || !Number.isFinite(aspect) || aspect < 0.05 || aspect > 20) {
    throw new Error('Terrain detail must be 32 to 256 samples with a print aspect ratio between 1:20 and 20:1.');
  }
  return { columns: Math.max(2, Math.round(detail * Math.min(1, aspect))), rows: Math.max(2, Math.round(detail / Math.max(1, aspect))) };
}

function tileAt(pixel: Pixel, zoom: number): Tile {
  const count = 2 ** zoom;
  const x = ((Math.floor(pixel.x / DEM_TILE_SIZE) % count) + count) % count;
  const y = Math.floor(pixel.y / DEM_TILE_SIZE);
  if (y < 0 || y >= count) throw new Error('The print area extends beyond elevation coverage.');
  return { x, y, key: `${x}/${y}` };
}

function surroundingPixels(point: Point2, zoom: number): readonly Pixel[] {
  const scale = 2 ** zoom * DEM_TILE_SIZE;
  const x = Math.floor(point.x * scale - 0.5);
  const y = Math.floor(point.y * scale - 0.5);
  return [{ x, y }, { x: x + 1, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }];
}

function sampleElevation(point: Point2, zoom: number, tiles: ReadonlyMap<string, Float32Array>): number {
  const pixels = surroundingPixels(point, zoom);
  const values = pixels.map((pixel) => {
    const tile = tiles.get(tileAt(pixel, zoom).key);
    if (!tile) throw new Error('A required elevation tile is missing.');
    const x = ((pixel.x % DEM_TILE_SIZE) + DEM_TILE_SIZE) % DEM_TILE_SIZE;
    const y = ((pixel.y % DEM_TILE_SIZE) + DEM_TILE_SIZE) % DEM_TILE_SIZE;
    return tile[y * DEM_TILE_SIZE + x];
  });
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error('Elevation data is missing in this print area. No STL was generated; choose another area.');
  }
  const scale = 2 ** zoom * DEM_TILE_SIZE;
  const u = point.x * scale - 0.5 - pixels[0].x;
  const v = point.y * scale - 0.5 - pixels[0].y;
  return (values[0] * (1 - u) + values[1] * u) * (1 - v) + (values[2] * (1 - u) + values[3] * u) * v;
}

async function loadTiles(tiles: readonly Tile[], zoom: number, options: {
  cache: DemTileCache;
  signal: AbortSignal;
  onProgress?: TerrainProgress;
}) {
  const loaded = new Map<string, Float32Array>();
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, tiles.length) }, async () => {
    while (next < tiles.length) {
      throwIfTerrainAborted(options.signal);
      const tile = tiles[next++];
      // This loop is one worker of a bounded four-way Promise.all pool.
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      loaded.set(tile.key, await options.cache.get(zoom, tile.x, tile.y, options.signal));
      options.onProgress?.(loaded.size / tiles.length * 0.65, `Loading elevation tiles (${loaded.size}/${tiles.length})`);
    }
  }));
  return loaded;
}

export async function loadElevationGrid(footprint: TerrainFootprint, detail: number, options: {
  cache?: DemTileCache;
  signal?: AbortSignal;
  onProgress?: TerrainProgress;
} = {}): Promise<ElevationGrid> {
  throwIfTerrainAborted(options.signal);
  const frame = terrainFrame(footprint);
  const { columns, rows } = terrainGridDimensions(detail, frame.widthMeters / frame.heightMeters);
  const span = Math.max(
    Math.hypot(frame.sample(1, 0).x - frame.sample(0, 0).x, frame.sample(1, 0).y - frame.sample(0, 0).y),
    Math.hypot(frame.sample(0, 1).x - frame.sample(0, 0).x, frame.sample(0, 1).y - frame.sample(0, 0).y),
  );
  const requestedZoom = Math.ceil(Math.log2(detail / (span * DEM_TILE_SIZE)));
  const zoom = Math.max(0, Math.min(MAX_DEM_ZOOM, requestedZoom));
  const points = Array.from({ length: rows * columns }, (_, index) => frame.sample((index % columns) / (columns - 1), Math.floor(index / columns) / (rows - 1)));
  const needed = new Map<string, Tile>();
  for (const point of points) {
    for (const pixel of surroundingPixels(point, zoom)) {
      const tile = tileAt(pixel, zoom);
      needed.set(tile.key, tile);
    }
  }
  if (needed.size > 64) throw new Error('This print area needs too many elevation tiles. Reduce detail or choose a smaller area.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  try {
    const tiles = await loadTiles([...needed.values()], zoom, { ...options, cache: options.cache ?? sharedDemTileCache, signal: controller.signal });
    throwIfTerrainAborted(controller.signal);
    const elevations = Float32Array.from(points, (point) => sampleElevation(point, zoom, tiles));
    options.onProgress?.(0.7, 'Elevation grid ready');
    return { columns, rows, elevations, widthMeters: frame.widthMeters, heightMeters: frame.heightMeters };
  } finally {
    controller.abort();
    options.signal?.removeEventListener('abort', abort);
  }
}
