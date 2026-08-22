import type { Map as MapLibreMap, PointLike } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';
import {
  addContentLayer,
  contentStructure,
  updateLayerPaint,
  visibleContentLayers,
  type RenderedMapContent,
} from './MapContentLayerRendering';

export type MapContentState = {
  layers: ContentLayer[];
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
) {
  container.dataset.mapLayerOrder = visibleLayers.map((layer) => layer.id).join(',');
  container.dataset.selectedLayer = state.selectedId ?? '';
  container.dataset.previewedLayer = state.previewedId ?? '';
  delete container.dataset.mapContentError;
}

function markContainerFailure(container: HTMLElement) {
  container.dataset.mapLayerOrder = '';
  container.dataset.selectedLayer = '';
  container.dataset.previewedLayer = '';
  container.dataset.mapContentError = 'true';
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
  for (const layer of visibleLayers) updateLayerPaint(map, layer, highlight);
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
    addContentLayer(map, layer, highlight, rendered);
  }
}

export function createMapLibreContentAdapter(
  map: MapLibreMap,
  container: HTMLElement,
): MapContentAdapter {
  const rendered: RenderedMapContent = { mapLayerIds: [], sourceIds: [], structure: '' };
  let cachedContentRevision: object | undefined;
  let cachedVisibleLayers: ContentLayer[] = [];
  let cachedStructure = '';
  let isCleanupPending = false;

  const layerSnapshot = (layers: ContentLayer[], contentRevision?: object) => {
    if (contentRevision !== undefined && contentRevision === cachedContentRevision) {
      return { structure: cachedStructure, visibleLayers: cachedVisibleLayers };
    }
    const visibleLayers = visibleContentLayers(layers);
    const structure = contentStructure(visibleLayers);
    if (contentRevision !== undefined) {
      cachedContentRevision = contentRevision;
      cachedVisibleLayers = visibleLayers;
      cachedStructure = structure;
    }
    return { structure, visibleLayers };
  };

  const cleanup = () => {
    const isComplete = removeRenderedContent(map, rendered);
    isCleanupPending = !isComplete;
    return isComplete;
  };

  const sync = ({ layers, selectedId, previewedId, contentRevision }: MapContentState) => {
    const state = { layers, selectedId, previewedId, contentRevision };
    try {
      if (!map.isStyleLoaded()) return 'deferred';
      const { structure: nextStructure, visibleLayers } = layerSnapshot(layers, contentRevision);
      if (!isCleanupPending && nextStructure === rendered.structure) {
        updateRenderedContent(map, visibleLayers, state);
        updateContainerState(container, state, visibleLayers);
        return 'synced';
      }

      if (!cleanup()) throw new Error('Map content cleanup incomplete');
      addRenderedContent(map, visibleLayers, state, rendered);
      rendered.structure = nextStructure;
      updateContainerState(container, state, visibleLayers);
      return 'synced';
    } catch {
      cleanup();
      markContainerFailure(container);
      return 'failed';
    }
  };

  return {
    sync,
    hitTest: (point) => {
      if (rendered.mapLayerIds.length === 0) return null;
      try {
        const feature = map.queryRenderedFeatures(point, { layers: rendered.mapLayerIds })[0];
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
    destroy: cleanup,
  };
}
