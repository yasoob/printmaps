import { decodeTerrariumPixels, DemTileCache, demTileUrl } from '../../src/terrain/demTiles';
import { loadElevationGrid, terrainGridDimensions } from '../../src/terrain/elevationGrid';
import { terrainFrame, type TerrainFootprint } from '../../src/terrain/terrainFootprint';

const footprint: TerrainFootprint = { corners: [[0, 0.01], [0.01, 0.01], [0.01, 0], [0, 0]], widthPx: 100, heightPx: 100, bearing: 0, pitch: 0 };
const tile = (value: number) => new Float32Array(256 * 256).fill(value);

it('decodes positive, negative, fractional and missing Terrarium samples without inventing heights', () => {
  const pixels = new Uint8Array(256 * 256 * 4).fill(255);
  pixels.set([128, 1, 128, 255], 0);
  pixels.set([127, 255, 0, 255], 4);
  pixels.set([128, 0, 0, 0], 8);
  pixels.set([0, 0, 0, 255], 12);
  const heights = decodeTerrariumPixels(pixels, 256, 256);
  expect(heights[0]).toBe(1.5);
  expect(heights[1]).toBe(-1);
  expect(heights[2]).toBeNaN();
  expect(heights[3]).toBeNaN();
  expect(() => decodeTerrariumPixels(pixels, 512, 512)).toThrow('dimensions');
});

it('bounds tile addressing and wraps the dateline', () => {
  expect(demTileUrl(2, -1, 0)).toContain('/2/3/0.png');
  expect(() => demTileUrl(2, 0, -1)).toThrow('coverage');
  expect(() => demTileUrl(13, 0, 0)).toThrow('coverage');
  expect(() => terrainGridDimensions(257, 1)).toThrow('detail');
});

it('shares in-flight tiles while allowing independent cancellation and removes abort listeners', async () => {
  let complete!: (data: Float32Array) => void;
  const loader = vi.fn(() => new Promise<Float32Array>((resolve) => { complete = resolve; }));
  const cache = new DemTileCache(loader);
  const first = new AbortController();
  const second = new AbortController();
  const remove = vi.spyOn(second.signal, 'removeEventListener');
  const cancelled = cache.get(2, 1, 1, first.signal);
  const surviving = cache.get(2, 1, 1, second.signal);
  first.abort();
  await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
  expect(loader.mock.calls).toHaveLength(1);
  complete(tile(123));
  const survived = await surviving;
  expect(survived[0]).toBe(123);
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  const cached = await cache.get(2, 1, 1);
  expect(cached[0]).toBe(123);
  expect(loader.mock.calls).toHaveLength(1);
});

it('times out even a hung loader and retries instead of caching failures', async () => {
  const loader = vi.fn(() => new Promise<Float32Array>(() => {}));
  const cache = new DemTileCache(loader, 5);
  await expect(cache.get(1, 0, 0)).rejects.toThrow('timed out');
  loader.mockResolvedValueOnce(tile(45));
  const retried = await cache.get(1, 0, 0);
  expect(retried[0]).toBe(45);
});

it('bounds the shared decoded tile LRU to 32 entries', async () => {
  const loader = vi.fn(async () => tile(0));
  const cache = new DemTileCache(loader);
  for (let x = 0; x < 33; x++) await cache.get(6, x, 1);
  await cache.get(6, 0, 1);
  expect(loader).toHaveBeenCalledTimes(34);
});

it('samples a constant actual DEM grid, including negative terrain', async () => {
  const progress = vi.fn();
  const grid = await loadElevationGrid(footprint, 32, { cache: new DemTileCache(async () => tile(-30)), onProgress: progress });
  expect(grid.columns).toBe(32);
  expect(grid.rows).toBe(32);
  expect(grid.elevations.every((value) => value === -30)).toBe(true);
  expect(grid.widthMeters).toBeCloseTo(1113.19, 1);
  expect(progress).toHaveBeenLastCalledWith(0.7, 'Elevation grid ready');
});

it('samples an analytic sloping DEM continuously across tile boundaries', async () => {
  const cache = new DemTileCache(async (url) => {
    const parts = new URL(url).pathname.split('/');
    const x = Number(parts.at(-2));
    return Float32Array.from({ length: 256 * 256 }, (_, index) => x * 256 + index % 256);
  });
  const grid = await loadElevationGrid(footprint, 32, { cache });
  expect(grid.elevations[31]).toBeGreaterThan(grid.elevations[0]);
  expect(grid.elevations[32]).toBeCloseTo(grid.elevations[0], 4);
  const step = grid.elevations[1] - grid.elevations[0];
  for (let x = 2; x < 32; x++) expect(grid.elevations[x] - grid.elevations[x - 1]).toBeCloseTo(step, 0);
});

it('rejects cancellation, network failure and missing data without partial grids', async () => {
  const controller = new AbortController();
  controller.abort();
  const loader = vi.fn(async () => tile(0));
  await expect(loadElevationGrid(footprint, 32, { signal: controller.signal, cache: new DemTileCache(loader) })).rejects.toMatchObject({ name: 'AbortError' });
  expect(loader).not.toHaveBeenCalled();
  await expect(loadElevationGrid(footprint, 32, { cache: new DemTileCache(async () => { throw new Error('offline'); }) })).rejects.toThrow('offline');
  await expect(loadElevationGrid(footprint, 32, { cache: new DemTileCache(async () => tile(NaN)) })).rejects.toThrow('missing');
});

it('uses rotated print-frame corners rather than an axis-aligned map bounding box', () => {
  const rotated: TerrainFootprint = { ...footprint, corners: [[0, 0], [0.01, 0.01], [0.02, 0], [0.01, -0.01]], bearing: 45 };
  const frame = terrainFrame(rotated);
  expect(frame.widthMeters).toBeCloseTo(frame.heightMeters, 4);
  expect(frame.projectRoute([0.01, 0]).x).toBeCloseTo(0.5);
  expect(frame.projectRoute([0.01, 0]).y).toBeCloseTo(0.5);
  expect(frame.sample(1, 0).y).toBeLessThan(frame.sample(0, 0).y);
  expect(() => terrainFrame({ ...footprint, pitch: 30 })).toThrow('Pitch');
  expect(() => terrainFrame({ ...footprint, corners: [[0, 90], footprint.corners[1], footprint.corners[2], footprint.corners[3]] })).toThrow('coverage');
});

it('preserves unwrapped antimeridian print-frame coordinates', () => {
  const frame = terrainFrame({ ...footprint, corners: [[179.99, 0.01], [180.01, 0.01], [180.01, 0], [179.99, 0]] });
  expect(frame.projectRoute([-180, 0.005]).x).toBeCloseTo(0.5);
});
