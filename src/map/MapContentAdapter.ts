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
};

export type MapContentSyncResult = 'synced' | 'deferred' | 'failed';

export type MapContentAdapter = {
  sync: (state: MapContentState) => MapContentSyncResult;
  hitTest: (point: PointLike) => string | null | undefined;
  destroy: () => void;
};

function updateContainerState(container: HTMLElement, state: MapContentState) {
  container.dataset.mapLayerOrder = visibleContentLayers(state.layers).map((layer) => layer.id).join(',');
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

function updateRenderedContent(map: MapLibreMap, state: MapContentState) {
  const highlight = { selectedId: state.selectedId, previewedId: state.previewedId };
  for (const layer of visibleContentLayers(state.layers)) updateLayerPaint(map, layer, highlight);
}

function addRenderedContent(
  map: MapLibreMap,
  state: MapContentState,
  rendered: RenderedMapContent,
) {
  const highlight = { selectedId: state.selectedId, previewedId: state.previewedId };
  const visibleLayers = visibleContentLayers(state.layers);
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
  let isCleanupPending = false;

  const cleanup = () => {
    const isComplete = removeRenderedContent(map, rendered);
    isCleanupPending = !isComplete;
    return isComplete;
  };

  const sync = ({ layers, selectedId, previewedId }: MapContentState) => {
    const state = { layers, selectedId, previewedId };
    try {
      if (!map.isStyleLoaded()) return 'deferred';
      const nextStructure = contentStructure(visibleContentLayers(layers));
      if (!isCleanupPending && nextStructure === rendered.structure) {
        updateRenderedContent(map, state);
        updateContainerState(container, state);
        return 'synced';
      }

      if (!cleanup()) throw new Error('Map content cleanup incomplete');
      addRenderedContent(map, state, rendered);
      rendered.structure = nextStructure;
      updateContainerState(container, state);
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
    destroy: cleanup,
  };
}
