import type { Map as MapLibreMap, PointLike } from 'maplibre-gl';
import { queryMapContentFeature } from './MapContentHitTesting';
import type { ContentLayer } from '../domain/project';
import { decodeCustomMarkerImage, type CustomMarkerAsset, type DecodedCustomMarkerImage } from '../domain/customMarkerAssets';
import {
  addContentLayer,
  contentStructure,
  updateLayerPaint,
  visibleContentLayers,
  type RenderedMapContent,
} from './MapContentLayerRendering';

export type MapContentState = {
  layers: ContentLayer[];
  assets?: Record<string, CustomMarkerAsset>;
  selectedId: string | null;
  previewedId: string | null;
  /*
   * Provide only when every layer object and nested value remains immutable for this revision.
   */
  contentRevision?: object;
};

export type MapContentSyncResult = 'synced' | 'deferred' | 'failed';

export type MapContentAdapter = {
  sync: (state: MapContentState) => MapContentSyncResult;
  hitTest: (point: PointLike) => string | null | undefined;
  setExportVisibility: (isVisible: boolean) => boolean;
  destroy: () => void;
};

function updateContainerState(
  container: HTMLElement,
  state: MapContentState,
  visibleLayers: ContentLayer[],
  geometry: string,
) {
  container.dataset.mapLayerOrder = visibleLayers.map((layer) => layer.id).join(',');
  container.dataset.mapLayerAppearance = visibleLayers.flatMap((layer) => {
    const { appearance } = layer;
    if (appearance?.kind === 'route') {
      return [`${layer.id}:${appearance.color}:${appearance.width}:${appearance.travelProfile}:${appearance.showTravelModeIcon}`];
    }
    if (appearance?.kind === 'poi') {
      return [
        `${layer.id}:${appearance.color}:${appearance.size}:${appearance.markerShape}:${appearance.markerSymbol}:${appearance.label}${appearance.customAssetId ? `:custom:${appearance.customAssetId}` : ''}`,
      ];
    }
    if (appearance?.kind === 'shape') {
      return [
        `${layer.id}:${appearance.fillColor}:${appearance.strokeColor}:${appearance.strokeWidth}:${appearance.invert}`,
      ];
    }
    return [];
  }).join('|');
  container.dataset.mapLayerGeometry = geometry;
  container.dataset.selectedLayer = state.selectedId ?? '';
  container.dataset.previewedLayer = state.previewedId ?? '';
  delete container.dataset.mapContentError;
  delete container.dataset.mapContentErrorReason;
}

function markContainerFailure(container: HTMLElement, error?: unknown) {
  container.dataset.mapLayerOrder = '';
  container.dataset.mapLayerAppearance = '';
  container.dataset.mapLayerGeometry = '';
  container.dataset.selectedLayer = '';
  container.dataset.previewedLayer = '';
  container.dataset.mapContentError = 'true';
  container.dataset.mapContentErrorReason = error instanceof Error ? error.message : 'Unknown content synchronization failure.';
}

function removeRenderedContent(map: MapLibreMap, rendered: RenderedMapContent) {
  rendered.mapLayerIds = rendered.mapLayerIds.filter((id) => {
    try {
      if (map.getLayer(id)) map.removeLayer(id);
      return false;
    } catch {
      return true;
    }
  });
  const remainingLayerIds = new Set(rendered.mapLayerIds);
  rendered.hitTestLayerIds = rendered.hitTestLayerIds.filter((id) => remainingLayerIds.has(id));
  rendered.sourceIds = rendered.sourceIds.filter((id) => {
    try {
      if (map.getSource(id)) map.removeSource(id);
      return false;
    } catch {
      return true;
    }
  });
  const isCleanupPending = rendered.mapLayerIds.length > 0 || rendered.sourceIds.length > 0;
  if (!isCleanupPending) rendered.structure = '';
  return !isCleanupPending;
}

function updateRenderedContent(
  map: MapLibreMap,
  visibleLayers: ContentLayer[],
  state: MapContentState,
) {
  const highlight = { selectedId: state.selectedId, previewedId: state.previewedId };
  for (const layer of visibleLayers) updateLayerPaint(map, layer, highlight, state.assets ?? {});
}

function addRenderedContent(
  map: MapLibreMap,
  visibleLayers: ContentLayer[],
  state: MapContentState,
  rendered: RenderedMapContent,
) {
  const highlight = { selectedId: state.selectedId, previewedId: state.previewedId };
  let index = visibleLayers.length;
  while (index > 0) {
    index -= 1;
    const layer = visibleLayers[index];
    addContentLayer(map, layer, { assets: state.assets ?? {}, highlight, rendered });
  }
}

type MapContentAdapterOptions = Readonly<{
  decodeImage?: (asset: CustomMarkerAsset) => Promise<DecodedCustomMarkerImage>;
}>;

function createMarkerImageRegistry(map: MapLibreMap, decodeImage: NonNullable<MapContentAdapterOptions['decodeImage']>) {
  let isDestroyed = false;
  const pending = new Map<string, Promise<void>>();
  const failed = new Set<string>();
  const registered = new Set<string>();
  let desiredAssetIds = new Set<string>();
  const load = (asset: CustomMarkerAsset, imageId: string) => {
    const task = (async () => {
      try {
        const image = await decodeImage(asset);
        try {
          if (isDestroyed || !desiredAssetIds.has(asset.id)) return;
          map.addImage(imageId, image);
          registered.add(imageId);
        } finally {
          if ('close' in image && typeof image.close === 'function') image.close();
        }
      } catch {
        failed.add(asset.id);
      } finally {
        pending.delete(asset.id);
        if (!isDestroyed) map.triggerRepaint();
      }
    })();
    pending.set(asset.id, task);
  };
  return {
    destroy: () => {
      isDestroyed = true;
      for (const imageId of registered) {
        try {
          if (map.hasImage(imageId)) map.removeImage(imageId);
        } catch {
          // Map teardown owns any image that cannot be removed here.
        }
      }
      registered.clear();
    },
    ensure: (state: MapContentState, layers: ContentLayer[]) => {
      const assetIds = new Set(layers.flatMap(({ appearance }) => (
        appearance?.kind === 'poi' && appearance.customAssetId ? [appearance.customAssetId] : []
      )));
      desiredAssetIds = assetIds;
      for (const assetId of assetIds) {
        const imageId = `studio-marker-${assetId}`;
        if (map.hasImage(imageId)) continue;
        if (failed.has(assetId)) throw new Error('A custom marker image could not be decoded.');
        if (pending.has(assetId)) return false;
        const asset = state.assets?.[assetId];
        if (!asset) throw new Error('A custom marker asset is missing.');
        load(asset, imageId);
        return false;
      }
      return true;
    },
    prune: (layers: ContentLayer[]) => {
      const referenced = new Set(layers.flatMap(({ appearance }) => (
        appearance?.kind === 'poi' && appearance.customAssetId ? [`studio-marker-${appearance.customAssetId}`] : []
      )));
      for (const imageId of registered) {
        if (referenced.has(imageId)) continue;
        try {
          if (map.hasImage(imageId)) map.removeImage(imageId);
        } finally {
          registered.delete(imageId);
        }
      }
    },
  };
}

export function createMapLibreContentAdapter(
  map: MapLibreMap,
  container: HTMLElement,
  options: MapContentAdapterOptions = {},
): MapContentAdapter {
  const rendered: RenderedMapContent = { mapLayerIds: [], hitTestLayerIds: [], sourceIds: [], structure: '' };
  let cachedContentRevision: object | undefined;
  let cachedVisibleLayers: ContentLayer[] = [];
  let cachedStructure = '';
  let cachedGeometry = '';
  let isCleanupPending = false;
  const markerImages = createMarkerImageRegistry(map, options.decodeImage ?? decodeCustomMarkerImage);

  const layerSnapshot = (layers: ContentLayer[], contentRevision?: object) => {
    if (contentRevision !== undefined && contentRevision === cachedContentRevision) {
      return { geometry: cachedGeometry, structure: cachedStructure, visibleLayers: cachedVisibleLayers };
    }
    const visibleLayers = visibleContentLayers(layers);
    const structure = contentStructure(visibleLayers);
    const geometry = visibleLayers.map((layer) => {
      const positions = layer.geometry?.type === 'Arc' ? layer.geometry.anchors : layer.geometry?.coordinates;
      return `${layer.id}:${JSON.stringify(positions)}`;
    }).join('|');
    if (contentRevision !== undefined) {
      cachedContentRevision = contentRevision;
      cachedVisibleLayers = visibleLayers;
      cachedStructure = structure;
      cachedGeometry = geometry;
    }
    return { geometry, structure, visibleLayers };
  };

  const cleanup = () => {
    const isComplete = removeRenderedContent(map, rendered);
    isCleanupPending = !isComplete;
    return isComplete;
  };

  const sync = ({ layers, assets, selectedId, previewedId, contentRevision }: MapContentState) => {
    const state = { layers, assets, selectedId, previewedId, contentRevision };
    try {
      if (!map.isStyleLoaded()) return 'deferred';
      const { geometry, structure: nextStructure, visibleLayers } = layerSnapshot(layers, contentRevision);
      if (!markerImages.ensure(state, visibleLayers)) return 'deferred';
      if (!isCleanupPending && nextStructure === rendered.structure) {
        markerImages.prune(visibleLayers);
        updateRenderedContent(map, visibleLayers, state);
        updateContainerState(container, state, visibleLayers, geometry);
        return 'synced';
      }

      if (!cleanup()) throw new Error('Map content cleanup incomplete');
      markerImages.prune(visibleLayers);
      addRenderedContent(map, visibleLayers, state, rendered);
      rendered.structure = nextStructure;
      updateContainerState(container, state, visibleLayers, geometry);
      return 'synced';
    } catch (error) {
      cleanup();
      markContainerFailure(container, error);
      return 'failed';
    }
  };

  return {
    sync,
    hitTest: (point) => {
      if (rendered.hitTestLayerIds.length === 0) return null;
      try {
        const feature = queryMapContentFeature(map, rendered.hitTestLayerIds, point);
        const hitLayerId = typeof feature?.properties?.layerId === 'string' ? feature.properties.layerId : null;
        delete container.dataset.mapContentError;
        return hitLayerId;
      } catch {
        container.dataset.mapContentError = 'true';
        return;
      }
    },
    setExportVisibility: (isVisible) => {
      const changed: string[] = [];
      const visibility = isVisible ? 'visible' : 'none';
      try {
        for (const id of rendered.mapLayerIds) {
          map.setLayoutProperty(id, 'visibility', visibility);
          changed.push(id);
        }
        return true;
      } catch {
        const rollbackVisibility = isVisible ? 'none' : 'visible';
        for (const id of changed) {
          try {
            map.setLayoutProperty(id, 'visibility', rollbackVisibility);
          } catch {
            // The caller treats a failed visibility transition as an unavailable export.
          }
        }
        return false;
      }
    },
    destroy: () => {
      const cleaned = cleanup();
      markerImages.destroy();
      return cleaned;
    },
  };
}
