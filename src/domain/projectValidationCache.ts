import type { ContentLayer, LayerGeometry, ProjectDocument } from './project';
import type { CustomMarkerAsset } from './customMarkerAssets';
import { parseLayerGeometry } from './projectGeometry';
import { ProjectFileError } from './projectFileError';
import { MAX_PROJECT_COORDINATES } from './projectLimits';
import { CompactJsonByteCache } from './projectSerialization';

// Only immutable canonical references use this cache. Untrusted file parsing
// always validates fresh input without sharing a cache.
export class ProjectValidationCache {
  readonly compactBytes = new CompactJsonByteCache();
  readonly snapshots = new WeakMap<object, ProjectDocument>();
  readonly geometries = new WeakMap<object, { parsed: LayerGeometry; positions: number }>();
  readonly layers = new WeakMap<object, { parsed: ContentLayer; positions: number }>();
  readonly layerArrays = new WeakMap<object, ContentLayer[]>();
  readonly assets = new WeakMap<object, Record<string, CustomMarkerAsset>>();
  readonly references = new WeakMap<object, WeakSet<object>>();
}

export function countCachedPositions(coordinateCount: { value: number }, positions: number) {
  coordinateCount.value += positions;
  if (coordinateCount.value > MAX_PROJECT_COORDINATES) {
    throw new ProjectFileError(`Projects may contain at most ${MAX_PROJECT_COORDINATES.toLocaleString()} positions.`);
  }
}

export function geometryAt(value: unknown, label: string, coordinateCount: { value: number }, cache?: ProjectValidationCache): LayerGeometry {
  const key = typeof value === 'object' && value !== null ? value : null;
  const cached = key && cache?.geometries.get(key);
  if (cached) {
    countCachedPositions(coordinateCount, cached.positions);
    return cached.parsed;
  }
  const initialCount = coordinateCount.value;
  const parsed = parseLayerGeometry(value, label, coordinateCount, {
    maximumCoordinates: MAX_PROJECT_COORDINATES,
    fail: (message) => { throw new ProjectFileError(message); },
  });
  if (key) cache?.geometries.set(key, { parsed, positions: coordinateCount.value - initialCount });
  return parsed;
}

export function validateAssetReferences(layers: ContentLayer[], assets: Record<string, CustomMarkerAsset>, cache?: ProjectValidationCache) {
  const checked = cache?.references.get(layers);
  if (checked?.has(assets)) return;
  const referenced = new Set(layers.flatMap(({ appearance }) => (
    appearance?.kind === 'poi' && appearance.customAssetId ? [appearance.customAssetId] : []
  )));
  for (const assetId of referenced) {
    if (!Object.hasOwn(assets, assetId)) throw new ProjectFileError('A layer references a missing custom marker asset.');
  }
  for (const assetId of Object.keys(assets)) {
    if (!referenced.has(assetId)) throw new ProjectFileError(`Custom marker asset ${assetId} is not referenced by a POI layer.`);
  }
  const references = checked ?? new WeakSet<object>();
  references.add(assets);
  cache?.references.set(layers, references);
}
