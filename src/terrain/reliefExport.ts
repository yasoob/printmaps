import type { ReliefSettings } from '../domain/studio';
import { deriveRenderedRoute } from '../domain/renderedRoute';
import type { MapRenderSnapshot } from '../map/MapRenderSnapshot';
import { loadElevationGrid, type TerrainProgress } from './elevationGrid';
import { createReliefMesh, encodeBinaryStl } from './reliefMesh';
import { terrainFrame } from './terrainFootprint';
import { TERRAIN_ATTRIBUTION, throwIfTerrainAborted } from './demTiles';

const DETAIL_SAMPLES = { low: 64, medium: 128, high: 256 } as const;

export async function exportTerrainRelief(snapshot: MapRenderSnapshot, settings: ReliefSettings, options: {
  signal?: AbortSignal;
  onProgress?: TerrainProgress;
} = {}): Promise<Blob> {
  throwIfTerrainAborted(options.signal);
  const frame = terrainFrame(snapshot.footprint);
  const layer = snapshot.layers.find(({ id }) => id === settings.routeRidge.layerId);
  if (settings.routeRidge.enabled && (!layer || layer.type !== 'route' || !layer.visible)) {
    throw new Error('Choose a visible route layer for the raised ridge.');
  }
  const route = layer && settings.routeRidge.enabled
    ? deriveRenderedRoute(layer)?.path.map((coordinate) => frame.projectRoute(coordinate))
    : undefined;
  const grid = await loadElevationGrid(snapshot.footprint, DETAIL_SAMPLES[settings.detail], options);
  const mesh = await createReliefMesh(grid, { ...options, settings, route });
  const bytes = await encodeBinaryStl(mesh, options);
  throwIfTerrainAborted(options.signal);
  options.onProgress?.(1, 'STL ready');
  return new Blob([bytes], { type: 'model/stl' });
}

export function reliefAttributionNotice(): string {
  return `${TERRAIN_ATTRIBUTION}. See https://github.com/tilezen/joerd/blob/master/docs/attribution.md for regional data credits. Terrain and one optional route ridge only; no buildings. STL has no unit metadata: import as millimeters.`;
}
