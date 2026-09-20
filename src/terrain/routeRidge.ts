import { throwIfTerrainAborted } from './demTiles';
import type { ElevationGrid } from './elevationGrid';
import type { ReliefMeshOptions } from './reliefMesh';
import type { Point2 } from './terrainFootprint';

function segmentDistance(point: Point2, start: Point2, end: Point2): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const squared = dx * dx + dy * dy;
  const fraction = squared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / squared));
  return Math.hypot(point.x - start.x - fraction * dx, point.y - start.y - fraction * dy);
}

function raiseSegment(heights: Float32Array, grid: ElevationGrid, segment: readonly [Point2, Point2], dimensions: { width: number; height: number; radius: number; ridgeHeight: number; remaining: number }) {
  const [start, end] = segment;
  const dx = dimensions.width / (grid.columns - 1);
  const dy = dimensions.height / (grid.rows - 1);
  const minX = Math.max(0, Math.floor((Math.min(start.x, end.x) - dimensions.radius) / dx));
  const maxX = Math.min(grid.columns - 1, Math.ceil((Math.max(start.x, end.x) + dimensions.radius) / dx));
  const minY = Math.max(0, Math.floor((Math.min(start.y, end.y) - dimensions.radius) / dy));
  const maxY = Math.min(grid.rows - 1, Math.ceil((Math.max(start.y, end.y) + dimensions.radius) / dy));
  const samples = Math.max(0, maxX - minX + 1) * Math.max(0, maxY - minY + 1);
  dimensions.remaining -= samples;
  if (dimensions.remaining < 0) throw new Error('This route is too complex for a relief ridge. Simplify the route or reduce detail.');
  for (let row = minY; row <= maxY; row++) {
    for (let column = minX; column <= maxX; column++) {
      const distance = segmentDistance({ x: column * dx, y: row * dy }, start, end);
      const index = row * grid.columns + column;
      // A maximum (not a sum or intersecting tube) keeps crossings a single-valued solid surface.
      heights[index] = Math.max(heights[index], dimensions.ridgeHeight * Math.max(0, 1 - distance / dimensions.radius));
    }
  }
}

export async function addRouteRidge(top: Float32Array, grid: ElevationGrid, options: ReliefMeshOptions): Promise<void> {
  const { settings, signal, route } = options;
  if (!route || route.length < 2) throw new Error('Choose a route with at least two points for the raised ridge.');
  if (route.length > 100_000 || route.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) throw new Error('The ridge route is invalid or exceeds 100,000 points.');
  const ridge = settings.routeRidge;
  if ([ridge.heightMm, ridge.widthMm].some((value) => !(Number.isFinite(value) && value >= 0.1 && value <= 20))) throw new Error('Route ridge width and height must be between 0.1 and 20 mm.');
  const sampleSpacing = Math.hypot(settings.widthMm / (grid.columns - 1), settings.heightMm / (grid.rows - 1));
  if (ridge.widthMm < sampleSpacing * 2) {
    throw new Error(`Route ridge is too narrow for this detail. Increase width to at least ${(sampleSpacing * 2).toFixed(2)} mm, increase detail, or reduce model size.`);
  }
  const path = route.map((point) => ({ x: point.x * settings.widthMm, y: point.y * settings.heightMm }));
  const heights = new Float32Array(grid.rows * grid.columns);
  const dimensions = { width: settings.widthMm, height: settings.heightMm, radius: ridge.widthMm / 2, ridgeHeight: ridge.heightMm, remaining: 8_000_000 };
  for (let index = 1; index < path.length; index++) {
    if (index % 32 === 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      throwIfTerrainAborted(signal);
    }
    raiseSegment(heights, grid, [path[index - 1], path[index]], dimensions);
  }
  if (heights.every((height) => !(height > 0))) throw new Error('The chosen route does not cross this print frame. No raised route could be generated.');
  for (const [index, height] of heights.entries()) top[index * 3 + 2] += height;
}
