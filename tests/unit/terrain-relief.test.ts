import { createDefaultStudioSettings } from '../../src/domain/studio';
import type { ElevationGrid } from '../../src/terrain/elevationGrid';
import { createReliefMesh, encodeBinaryStl, type ReliefMesh } from '../../src/terrain/reliefMesh';

const settings = { ...createDefaultStudioSettings().relief, widthMm: 100, heightMm: 100 };
function grid(size = 5, height = (x: number, y: number) => x * 10 + y * 20): ElevationGrid {
  return { columns: size, rows: size, widthMeters: 1000, heightMeters: 1000, elevations: Float32Array.from({ length: size * size }, (_, index) => height(index % size, Math.floor(index / size))) };
}

function inspect(mesh: ReliefMesh) {
  const edges = new Map<string, { count: number; direction: number }>();
  let volume = 0;
  for (let index = 0; index < mesh.triangles.length; index += 3) {
    const indices = [...mesh.triangles.subarray(index, index + 3)];
    const [a, b, c] = indices.map((vertex) => mesh.vertices.subarray(vertex * 3, vertex * 3 + 3));
    const cross = [b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0]];
    volume += (a[0] * cross[0] + a[1] * cross[1] + a[2] * cross[2]) / 6;
    for (let side = 0; side < 3; side++) {
      const start = indices[side];
      const end = indices[(side + 1) % 3];
      const key = `${Math.min(start, end)}-${Math.max(start, end)}`;
      const current = edges.get(key) ?? { count: 0, direction: 0 };
      edges.set(key, { count: current.count + 1, direction: current.direction + (start < end ? 1 : -1) });
    }
  }
  for (const edge of edges.values()) expect(edge).toEqual({ count: 2, direction: 0 });
  return { volume, edges };
}

it('creates an outward oriented, watertight manifold with exact mm dimensions and an analytic volume', async () => {
  const mesh = await createReliefMesh(grid(), { settings });
  const { volume, edges } = inspect(mesh);
  expect(volume).toBeCloseTo(100 * 100 * (settings.baseMm + 6), 1);
  expect(mesh.vertices.length / 3 - edges.size + mesh.triangles.length / 3).toBe(2);
  const xs = [...mesh.vertices].filter((_, index) => index % 3 === 0);
  const ys = [...mesh.vertices].filter((_, index) => index % 3 === 1);
  const zs = [...mesh.vertices].filter((_, index) => index % 3 === 2);
  expect([Math.min(...xs), Math.max(...xs)]).toEqual([0, 100]);
  expect([Math.min(...ys), Math.max(...ys)]).toEqual([0, 100]);
  expect([Math.min(...zs), Math.max(...zs)]).toEqual([0, 14]);
  const stl = await encodeBinaryStl(mesh);
  const view = new DataView(stl);
  const faces = view.getUint32(80, true);
  expect(stl.byteLength).toBe(84 + faces * 50);
  for (let index = 0; index < faces; index++) {
    const offset = 84 + index * 50;
    expect(Math.hypot(view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true))).toBeCloseTo(1);
    expect(view.getUint16(offset + 48, true)).toBe(0);
  }
});

it('shifts all-negative elevations to a positive base and supports flat terrain', async () => {
  for (const height of [() => -50, (x: number, y: number) => x + y - 100]) {
    const mesh = await createReliefMesh(grid(5, height), { settings });
    expect(inspect(mesh).volume).toBeGreaterThanOrEqual(100 * 100 * settings.baseMm - 0.001);
    expect(mesh.vertices[2]).toBe(settings.baseMm);
  }
});

it('exaggerates only topographic relief, never the base', async () => {
  const mesh = await createReliefMesh(grid(), { settings: { ...settings, exaggeration: 3 } });
  expect(mesh.vertices[2]).toBe(settings.baseMm);
  expect(mesh.vertices[24 * 3 + 2]).toBe(settings.baseMm + 36);
});

it('raises a single integrated route ridge, including crossings and edges, without intersections', async () => {
  const terrain = grid(65, () => 0);
  const ridgeSettings = { ...settings, routeRidge: { enabled: true, layerId: 'route', heightMm: 2, widthMm: 8 } };
  const mesh = await createReliefMesh(terrain, { settings: ridgeSettings, route: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 }] });
  const center = (32 * 65 + 32) * 3 + 2;
  expect(mesh.vertices[center]).toBe(settings.baseMm + 2);
  expect(mesh.vertices[2]).toBe(settings.baseMm);
  expect(inspect(mesh).volume).toBeGreaterThan(100 * 100 * settings.baseMm);
});

it('rejects invisible-width, outside-frame and missing ridges rather than exporting a misleading flat route', async () => {
  const terrain = grid(32, () => 0);
  const ridgeSettings = { ...settings, routeRidge: { enabled: true, layerId: 'route', heightMm: 2, widthMm: 1 } };
  await expect(createReliefMesh(terrain, { settings: ridgeSettings, route: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })).rejects.toThrow('too narrow');
  await expect(createReliefMesh(terrain, { settings: { ...ridgeSettings, routeRidge: { ...ridgeSettings.routeRidge, widthMm: 10 } }, route: [{ x: -1, y: -1 }, { x: -2, y: -2 }] })).rejects.toThrow('does not cross');
  await expect(createReliefMesh(terrain, { settings: ridgeSettings })).rejects.toThrow('Choose a route');
});

it('rejects missing elevations, invalid thickness, aspect distortion, excessive detail and cancellation', async () => {
  await expect(createReliefMesh(grid(5, () => NaN), { settings })).rejects.toThrow('missing');
  await expect(createReliefMesh(grid(), { settings: { ...settings, baseMm: 0 } })).rejects.toThrow('positive');
  await expect(createReliefMesh(grid(), { settings: { ...settings, heightMm: 90 } })).rejects.toThrow('proportions');
  await expect(createReliefMesh(grid(257), { settings })).rejects.toThrow('dimensions');
  const controller = new AbortController();
  const promise = createReliefMesh(grid(256), { settings, signal: controller.signal });
  controller.abort();
  await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  const mesh = await createReliefMesh(grid(), { settings });
  await expect(encodeBinaryStl(mesh, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
});
