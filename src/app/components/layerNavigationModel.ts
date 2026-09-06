import type { ContentLayer } from '../../domain/project';

export function hasSameLayerRowView(previous: ContentLayer, next: ContentLayer) {
  return previous.id === next.id
    && previous.type === next.type
    && previous.name === next.name
    && previous.visible === next.visible
    && previous.locked === next.locked;
}

export function filterLayers(layers: readonly ContentLayer[], query: string) {
  const search = query.trim().toLocaleLowerCase();
  return search ? layers.filter((layer) => layer.name.toLocaleLowerCase().includes(search)) : layers;
}

export function layerReorderDestination(
  layers: readonly ContentLayer[],
  visibleIds: readonly string[],
  sourceId: string,
  visibleIndex: number,
): number | null {
  const source = layers.find((layer) => layer.id === sourceId);
  if (!source || source.type === 'basemap' || !visibleIds.includes(sourceId) || !Number.isSafeInteger(visibleIndex)) return null;
  const basemapId = layers.find((layer) => layer.type === 'basemap')?.id;
  const movableIds = visibleIds.filter((id) => id !== basemapId);
  const targetId = movableIds[Math.max(0, Math.min(visibleIndex, movableIds.length - 1))];
  const target = layers.findIndex((layer) => layer.id === targetId);
  // moveLayer takes the final canonical index, not the filtered sortable index.
  return target === -1 ? null : target;
}

export type LayerReorderOwner = {
  epoch: number;
  layers: readonly ContentLayer[];
  query: string;
  visibleIds: readonly string[];
  sourceId: string;
};

export function captureLayerReorder(layers: readonly ContentLayer[], epoch: number, query: string, sourceId: string): LayerReorderOwner {
  return { layers, epoch, query, sourceId, visibleIds: filterLayers(layers, query).map((layer) => layer.id) };
}

export function isLayerReorderCurrent(owner: LayerReorderOwner, layers: readonly ContentLayer[], epoch: number, query: string) {
  return owner.layers === layers && owner.epoch === epoch && owner.query === query;
}

export function layerFocusIndex(key: string, index: number, length: number): number | null {
  switch (key) {
    case 'ArrowUp': { return Math.max(0, index - 1); }
    case 'ArrowDown': { return Math.min(length - 1, index + 1); }
    case 'Home': { return 0; }
    case 'End': { return length - 1; }
    default: { return null; }
  }
}
