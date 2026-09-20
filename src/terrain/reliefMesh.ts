import type { ReliefSettings } from '../domain/studio';
import { throwIfTerrainAborted } from './demTiles';
import type { ElevationGrid, TerrainProgress } from './elevationGrid';
import type { Point2 } from './terrainFootprint';
import { addRouteRidge } from './routeRidge';

export type ReliefMesh = Readonly<{ vertices: Float32Array; triangles: Uint32Array }>;
export type ReliefMeshOptions = Readonly<{
  settings: ReliefSettings;
  route?: readonly Point2[];
  signal?: AbortSignal;
  onProgress?: TerrainProgress;
}>;

export function validateReliefGrid(grid: ElevationGrid, settings: ReliefSettings): void {
  if ([grid.rows, grid.columns].some((value) => !Number.isSafeInteger(value) || value < 2 || value > 256) || grid.elevations.length !== grid.rows * grid.columns) {
    throw new Error('Terrain grid dimensions must be between 2 and 256 samples per side.');
  }
  const dimensions = [settings.widthMm, settings.heightMm, settings.baseMm, settings.exaggeration, grid.widthMeters, grid.heightMeters];
  if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error('Relief dimensions, base thickness and exaggeration must be finite and positive.');
  if (settings.widthMm > 1000 || settings.heightMm > 1000 || settings.baseMm > 100 || settings.exaggeration > 50) throw new Error('Relief dimensions exceed the supported limits.');
  const aspect = grid.widthMeters / grid.heightMeters;
  if (Math.abs(settings.widthMm / settings.heightMm / aspect - 1) > 0.01) throw new Error('Model proportions must match the print frame. Use Fit dimensions to print frame before exporting.');
  if (grid.elevations.some((value) => !Number.isFinite(value))) throw new Error('Terrain includes missing elevation data; no partial STL can be generated.');
}

export const yieldTerrainTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function perimeter(columns: number, rows: number): number[] {
  const ring: number[] = [];
  // Counter-clockwise in model XY: screen top-left -> bottom-left -> bottom-right -> top-right.
  for (let y = 0; y < rows - 1; y++) ring.push(y * columns);
  for (let x = 0; x < columns - 1; x++) ring.push((rows - 1) * columns + x);
  for (let y = rows - 1; y > 0; y--) ring.push(y * columns + columns - 1);
  for (let x = columns - 1; x > 0; x--) ring.push(x);
  return ring;
}

function closeMesh(grid: ElevationGrid, top: Float32Array): ReliefMesh {
  const { columns, rows } = grid;
  const ring = perimeter(columns, rows);
  const topCount = rows * columns;
  const center = topCount + ring.length;
  const vertices = new Float32Array((center + 1) * 3);
  vertices.set(top);
  for (const [offset, index] of ring.entries()) {
    vertices[(topCount + offset) * 3] = top[index * 3];
    vertices[(topCount + offset) * 3 + 1] = top[index * 3 + 1];
  }
  vertices[center * 3] = top[(columns - 1) * 3] / 2;
  vertices[center * 3 + 1] = top[1] / 2;
  const triangles = new Uint32Array(((rows - 1) * (columns - 1) * 2 + ring.length * 3) * 3);
  let offset = 0;
  const face = (a: number, b: number, c: number) => { triangles.set([a, b, c], offset); offset += 3; };
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < columns - 1; x++) {
      const a = y * columns + x;
      face(a, a + columns, a + 1);
      face(a + 1, a + columns, a + columns + 1);
    }
  }
  for (const [index, a] of ring.entries()) {
    const next = (index + 1) % ring.length;
    const b = ring[next];
    const bottomA = topCount + index;
    const bottomB = topCount + next;
    face(a, bottomA, b);
    face(b, bottomA, bottomB);
    face(center, bottomB, bottomA);
  }
  return { vertices, triangles };
}

export async function createReliefMesh(grid: ElevationGrid, options: ReliefMeshOptions): Promise<ReliefMesh> {
  const { settings, signal, onProgress } = options;
  validateReliefGrid(grid, settings);
  throwIfTerrainAborted(signal);
  let minimum = Infinity;
  for (const value of grid.elevations) minimum = Math.min(minimum, value);
  const top = new Float32Array(grid.rows * grid.columns * 3);
  const scale = settings.widthMm / grid.widthMeters * settings.exaggeration;
  for (let row = 0; row < grid.rows; row++) {
    if (row % 16 === 0) {
      await yieldTerrainTask();
      throwIfTerrainAborted(signal);
    }
    for (let column = 0; column < grid.columns; column++) {
      const index = row * grid.columns + column;
      const height = settings.baseMm + (grid.elevations[index] - minimum) * scale;
      if (height > 2000) throw new Error('The relief would exceed 2000 mm in height. Reduce exaggeration or model size.');
      top.set([column / (grid.columns - 1) * settings.widthMm, (1 - row / (grid.rows - 1)) * settings.heightMm, height], index * 3);
    }
  }
  if (settings.routeRidge.enabled) await addRouteRidge(top, grid, options);
  throwIfTerrainAborted(signal);
  onProgress?.(0.85, 'Closing solid terrain mesh');
  return closeMesh(grid, top);
}

export async function encodeBinaryStl(mesh: ReliefMesh, options: Pick<ReliefMeshOptions, 'signal' | 'onProgress'> = {}): Promise<ArrayBuffer> {
  const count = mesh.triangles.length / 3;
  const buffer = new ArrayBuffer(84 + count * 50);
  const output = new DataView(buffer);
  new Uint8Array(buffer, 0, 80).set(new TextEncoder().encode('Print Map Studio; millimeters; AWS Terrain Tiles (Mapzen)/USGS/SRTM'));
  output.setUint32(80, count, true);
  const { vertices, triangles } = mesh;
  for (let face = 0; face < count; face++) {
    if (face % 4096 === 0) {
      await yieldTerrainTask();
      throwIfTerrainAborted(options.signal);
      options.onProgress?.(0.85 + 0.15 * face / count, 'Encoding binary STL');
    }
    const [a, b, c] = [triangles[face * 3], triangles[face * 3 + 1], triangles[face * 3 + 2]].map((index) => vertices.subarray(index * 3, index * 3 + 3));
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...normal);
    if (length === 0 || !Number.isFinite(length)) throw new Error('The terrain mesh contains a degenerate triangle.');
    const values = [...normal.map((value) => value / length), ...a, ...b, ...c];
    for (const [index, value] of values.entries()) output.setFloat32(84 + face * 50 + index * 4, value, true);
  }
  throwIfTerrainAborted(options.signal);
  return buffer;
}
