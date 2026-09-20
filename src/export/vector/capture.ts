import type { MapRenderSnapshot } from '../../map/MapRenderSnapshot';
import type { VectorTileFeature, VectorTileLayer } from '@mapbox/vector-tile';
import { snapshotVectorProjection } from './projection';
import { activeVectorLayers, compileVectorLayer, type CompiledVectorLayer } from './style';
import { captureVectorTiles, type CapturedVectorTile, type VectorBudget } from './tiles';
import { vectorFeaturePaths } from './geometry';
import { layoutVectorLabels, loadVectorFont, vectorLabelCandidate } from './labels';
import { checkVectorSignal, VECTOR_LIMITS, vectorUnsupported, type VectorBasemapCapture, type VectorBasemapScene, type VectorPath, type VectorPoint } from './scene';

type CaptureContext = {
  projection: ReturnType<typeof snapshotVectorProjection>;
  budget: VectorBudget;
  signal: AbortSignal;
  bearing: number;
  labels: NonNullable<ReturnType<typeof vectorLabelCandidate>>[];
};

async function filteredFeatures(data: VectorTileLayer, compiled: CompiledVectorLayer, context: CaptureContext) {
  const features: { feature: VectorTileFeature; order: number }[] = [];
  for (let index = 0; index < data.length; index++) {
    if (++context.budget.features > VECTOR_LIMITS.features) vectorUnsupported('The vector export exceeds the 100,000-feature evaluation budget. Zoom in.');
    if (context.budget.features % 256 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      checkVectorSignal(context.signal);
    }
    const feature = data.feature(index);
    if (!compiled.matches(feature)) continue;
    const order = compiled.number(`${compiled.layer.type}-sort-key`, feature, 0);
    features.push({ feature, order });
  }
  features.sort((a, b) => a.order - b.order);
  return features;
}

function isOwnedPoint(feature: VectorTileFeature, geometry: readonly (readonly VectorPoint[])[]): boolean {
  const point = geometry[0]?.[0];
  return feature.type !== 1 || !point || (point.x >= 0 && point.y >= 0 && point.x < feature.extent && point.y < feature.extent);
}

function countPoints(rings: readonly (readonly VectorPoint[])[], budget: VectorBudget): void {
  for (const ring of rings) budget.points += ring.length;
  if (budget.points > VECTOR_LIMITS.points) vectorUnsupported('The vector export exceeds the one-million-point budget. Zoom in.');
}

async function captureLayerTile(tile: CapturedVectorTile, compiled: CompiledVectorLayer, context: CaptureContext): Promise<VectorBasemapScene['groups'][number] | undefined> {
  const { layer } = compiled;
  if (layer.type === 'background') throw new Error('A background does not have source tiles.');
  const sourceLayer = layer['source-layer'];
  if (!sourceLayer) vectorUnsupported(`"${layer.id}" has no vector source-layer.`);
  const data = tile.tile.layers[sourceLayer];
  if (!data) return;
  const { x, y, z } = tile, count = 2 ** z;
  const tilePoint = (point: VectorPoint) => context.projection.projectWorld({
    x: (x + point.x / data.extent) / count, y: (y + point.y / data.extent) / count,
  });
  const clip = [{ x, y }, { x: x + 1, y }, { x: x + 1, y: y + 1 }, { x, y: y + 1 }]
    .map((point) => context.projection.projectWorld({ x: point.x / count, y: point.y / count }));
  const paths: VectorPath[] = [];
  const features = await filteredFeatures(data, compiled, context);
  for (const { feature } of features) {
    const geometry = feature.loadGeometry();
    countPoints(geometry, context.budget);
    const rings = geometry.map((ring) => ring.map((point) => tilePoint(point)));
    if (layer.type === 'symbol') {
      if (!isOwnedPoint(feature, geometry)) continue;
      const label = vectorLabelCandidate(compiled, feature, rings);
      if (label) {
        label.key += `/world-${Math.floor(x / count)}`;
        context.labels.push(label);
      }
    } else {
      const output = vectorFeaturePaths(compiled, feature, rings, context.bearing);
      for (const path of output) countPoints(path.rings, context.budget);
      paths.push(...output);
    }
  }
  return { layerId: layer.id, clip, paths };
}

async function captureScene(snapshot: MapRenderSnapshot, signal: AbortSignal): Promise<VectorBasemapCapture> {
  const projection = snapshotVectorProjection(snapshot);
  const layers = activeVectorLayers(snapshot.style, projection.zoom);
  const budget: VectorBudget = { bytes: 0, tiles: 0, features: 0, points: 0 };
  const context: CaptureContext = { projection, budget, signal, bearing: snapshot.camera.bearing, labels: [] };
  const pageClip = [{ x: 0, y: 0 }, { x: projection.width, y: 0 }, { x: projection.width, y: projection.height }, { x: 0, y: projection.height }];
  const groups: VectorBasemapScene['groups'][number][] = [];
  const tilesBySource = new Map<string, CapturedVectorTile[]>();
  for (const layer of layers) {
    checkVectorSignal(signal);
    const compiled = compileVectorLayer(layer, projection.zoom);
    if (layer.type === 'background') {
      groups.push({ layerId: layer.id, clip: pageClip, paths: [{
        rings: [pageClip], closed: true, fill: compiled.color('background-color', undefined, compiled.number('background-opacity')),
      }] });
      continue;
    }
    const source = snapshot.style.sources[layer.source];
    if (source?.type !== 'vector') vectorUnsupported(`Source "${layer.source}" is not a supported vector tile source.`);
    if (source.promoteId) vectorUnsupported(`Source "${layer.source}" uses promoted feature IDs.`);
    let tiles = tilesBySource.get(layer.source);
    if (!tiles) {
      tiles = await captureVectorTiles(source, projection, signal, budget);
      tilesBySource.set(layer.source, tiles);
    }
    const tileGroups = await captureLayerTiles(tiles, compiled, context);
    if (layer.type === 'symbol') groups.push({ layerId: layer.id, clip: pageClip, paths: [] });
    else groups.push(...tileGroups);
  }
  const scene = await finishScene(groups, context);
  return { scene, referenceLongitude: projection.referenceLongitude, projectToFrame: projection.projectToFrame };
}

async function captureLayerTiles(tiles: readonly CapturedVectorTile[], compiled: CompiledVectorLayer, context: CaptureContext) {
  const groups: VectorBasemapScene['groups'][number][] = [];
  for (const tile of tiles) {
    const group = await captureLayerTile(tile, compiled, context);
    if (group) groups.push(group);
  }
  return groups;
}

async function finishScene(groups: VectorBasemapScene['groups'], context: CaptureContext): Promise<VectorBasemapScene> {
  const { labels, signal, budget, projection } = context;
  const font = labels.length > 0 ? await loadVectorFont(signal, budget) : undefined;
  const labelGroups = font ? layoutVectorLabels(labels, font.font, projection) : new Map();
  const scene: VectorBasemapScene = {
    kind: 'vector', width: projection.width, height: projection.height,
    groups: groups.map((group) => {
      const labelGroup = labelGroups.get(group.layerId);
      return labelGroup ? { ...group, paths: labelGroup.paths, texts: labelGroup.texts } : group;
    }),
    font: font?.asset,
  };
  checkVectorSignal(signal);
  return scene;
}

export async function captureVectorBasemap(
  snapshot: MapRenderSnapshot,
  options: Readonly<{ signal?: AbortSignal }> = {},
): Promise<VectorBasemapCapture> {
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timeout = setTimeout(() => controller.abort(new Error('Vector export exceeded the 30-second time budget. Zoom in or choose Hybrid mode.')), VECTOR_LIMITS.timeMs);
  const signal = controller.signal;
  try {
    checkVectorSignal(signal);
    return await captureScene(snapshot, signal);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}
