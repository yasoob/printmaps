import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';
import type { MapContentState } from './MapContentAdapter';
import {
  contentStructure,
  updateLayerPaint,
  visibleContentLayers,
} from './MapContentLayerRendering';
import {
  mapContentDataForLayer,
  mapContentSourceId,
} from './MapContentGeometry';
import {
  hasMapContentSourceData,
  mapContentDataSignature,
  mapContentPaintSignature,
  markMapContentSourceData,
} from './MapContentSourceState';

type MapContentSnapshot = {
  geometry: string;
  structure: string;
  visibleLayers: ContentLayer[];
};

type MutableGeoJsonSource = {
  setData: (data: ReturnType<typeof mapContentDataForLayer>) => void;
};

function hasSetData(source: unknown): source is MutableGeoJsonSource {
  return source !== null
    && typeof source === 'object'
    && 'setData' in source
    && typeof source.setData === 'function';
}

function updateOutlineSourceData(map: MapLibreMap, layer: ContentLayer) {
  if (
    layer.appearance?.kind !== 'shape'
    || !layer.appearance.invert
  ) {
    return 'unchanged' as const;
  }
  if (
    layer.geometry?.type !== 'Polygon'
    && layer.geometry?.type !== 'MultiPolygon'
  ) {
    return 'failed' as const;
  }
  const outlineSource = map.getSource(mapContentSourceId(layer.id, 'outline'));
  if (!hasSetData(outlineSource)) return 'failed' as const;
  if (hasMapContentSourceData(outlineSource, layer)) {
    return 'unchanged' as const;
  }
  outlineSource.setData(mapContentDataForLayer(layer, layer.geometry));
  markMapContentSourceData(outlineSource, layer);
  return 'updated' as const;
}

function updateLayerSourceData(map: MapLibreMap, layer: ContentLayer) {
  const source = map.getSource(mapContentSourceId(layer.id));
  if (!hasSetData(source)) return 'failed' as const;
  let didMutate = false;
  if (!hasMapContentSourceData(source, layer)) {
    source.setData(mapContentDataForLayer(layer));
    markMapContentSourceData(source, layer);
    didMutate = true;
  }
  const outlineUpdate = updateOutlineSourceData(map, layer);
  if (outlineUpdate === 'failed') return outlineUpdate;
  return didMutate || outlineUpdate === 'updated'
    ? 'updated' as const
    : 'unchanged' as const;
}

function geometrySignature(layers: readonly ContentLayer[]) {
  return layers.map((layer) => {
    const positions = layer.geometry?.type === 'Arc'
      ? layer.geometry.anchors
      : layer.geometry?.coordinates;
    return `${layer.id}:${JSON.stringify(positions)}`;
  }).join('|');
}

function updateChangedLayerSources(
  map: MapLibreMap,
  visibleLayers: ContentLayer[],
  cachedDataSignatures: ReadonlyMap<string, string>,
  cachedPaintSignatures: ReadonlyMap<string, string>,
) {
  const changedPaintIds = new Set<string>();
  let didUpdateSource = false;
  for (const layer of visibleLayers) {
    if (cachedDataSignatures.get(layer.id) !== mapContentDataSignature(layer)) {
      const update = updateLayerSourceData(map, layer);
      if (update === 'failed') return null;
      if (update === 'updated') didUpdateSource = true;
    }
    if (
      cachedPaintSignatures.get(layer.id)
      !== mapContentPaintSignature(layer)
    ) {
      changedPaintIds.add(layer.id);
    }
  }
  return { changedPaintIds, didUpdateSource };
}

function addChangedIds(
  changedLayerIds: Set<string>,
  previousId: string | null,
  nextId: string | null,
) {
  if (previousId === nextId) return;
  if (previousId) changedLayerIds.add(previousId);
  if (nextId) changedLayerIds.add(nextId);
}

export function createMapContentIncrementalState(map: MapLibreMap) {
  let cachedContentRevision: object | undefined;
  let cachedSnapshot: MapContentSnapshot = {
    geometry: '',
    structure: '',
    visibleLayers: [],
  };
  let cachedAssets: MapContentState['assets'];
  let cachedSelectedId: string | null = null;
  let cachedPreviewedId: string | null = null;
  let cachedDataSignatures = new Map<string, string>();
  let cachedPaintSignatures = new Map<string, string>();

  const cache = (
    visibleLayers: ContentLayer[],
    state: MapContentState,
    shouldCacheLayerSignatures = true,
  ) => {
    cachedAssets = state.assets;
    cachedSelectedId = state.selectedId;
    cachedPreviewedId = state.previewedId;
    if (shouldCacheLayerSignatures) {
      cachedDataSignatures = new Map(
        visibleLayers.map((layer) => [
          layer.id,
          mapContentDataSignature(layer),
        ]),
      );
      cachedPaintSignatures = new Map(
        visibleLayers.map((layer) => [
          layer.id,
          mapContentPaintSignature(layer),
        ]),
      );
    }
  };

  const snapshot = (
    layers: ContentLayer[],
    contentRevision?: object,
  ): { isSameRevision: boolean; value: MapContentSnapshot } => {
    const isSameRevision = contentRevision !== undefined
      && contentRevision === cachedContentRevision;
    if (isSameRevision) return { isSameRevision, value: cachedSnapshot };
    const visibleLayers = visibleContentLayers(layers);
    const value = {
      geometry: geometrySignature(visibleLayers),
      structure: contentStructure(visibleLayers),
      visibleLayers,
    };
    if (contentRevision !== undefined) {
      cachedContentRevision = contentRevision;
      cachedSnapshot = value;
    }
    return { isSameRevision, value };
  };

  const update = (
    visibleLayers: ContentLayer[],
    state: MapContentState,
    isSameRevision: boolean,
  ) => {
    const changes = isSameRevision
      ? { changedPaintIds: new Set<string>(), didUpdateSource: false }
      : updateChangedLayerSources(
        map,
        visibleLayers,
        cachedDataSignatures,
        cachedPaintSignatures,
      );
    if (!changes) return false;
    addChangedIds(changes.changedPaintIds, cachedSelectedId, state.selectedId);
    addChangedIds(changes.changedPaintIds, cachedPreviewedId, state.previewedId);
    const highlight = {
      previewedId: state.previewedId,
      selectedId: state.selectedId,
    };
    for (const layer of visibleLayers) {
      if (changes.changedPaintIds.has(layer.id)) {
        updateLayerPaint(map, layer, highlight, state.assets ?? {});
      }
    }
    cache(visibleLayers, state, !isSameRevision);
    return {
      didMutate:
        changes.didUpdateSource || changes.changedPaintIds.size > 0,
    };
  };

  return {
    cache,
    canUpdate: (
      assets: MapContentState['assets'],
      nextStructure: string,
      renderedStructure: string,
      isCleanupPending: boolean,
    ) => !isCleanupPending
      && nextStructure === renderedStructure
      && cachedAssets === assets,
    snapshot,
    update,
  };
}
