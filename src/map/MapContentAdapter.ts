import type { Map as MapLibreMap, PointLike } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';

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

const SOURCE_PREFIX = 'studio-source-';
const LAYER_PREFIX = 'studio-layer-';
const ROUTE_COLOR = '#d9363e';
const POI_COLOR = '#0d78b5';
const SHAPE_COLOR = '#d18b25';
const HIGHLIGHT_COLOR = '#006fc9';
const POI_STROKE = '#ffffff';

const encodedContentId = (id: string) => `${id.length}:${id}`;
const sourceId = (id: string) => `${SOURCE_PREFIX}${encodedContentId(id)}`;
const layerId = (id: string, role = 'main') => `${LAYER_PREFIX}${encodedContentId(id)}:${role}`;

export function createMapLibreContentAdapter(
  map: MapLibreMap,
  container: HTMLElement,
): MapContentAdapter {
  let renderedMapLayerIds: string[] = [];
  let renderedSourceIds: string[] = [];
  let renderedStructure = '';
  let isCleanupPending = false;

  const removeRenderedContent = () => {
    renderedMapLayerIds = renderedMapLayerIds.filter((id) => {
      try {
        if (map.getLayer(id)) map.removeLayer(id);
        return false;
      } catch {
        return true;
      }
    });
    renderedSourceIds = renderedSourceIds.filter((id) => {
      try {
        if (map.getSource(id)) map.removeSource(id);
        return false;
      } catch {
        return true;
      }
    });
    isCleanupPending = renderedMapLayerIds.length > 0 || renderedSourceIds.length > 0;
    if (!isCleanupPending) renderedStructure = '';
    return !isCleanupPending;
  };

  const updateLayerPaint = (layer: ContentLayer, selectedId: string | null, previewedId: string | null) => {
    const isHighlighted = layer.id === selectedId || layer.id === previewedId;
    const opacity = layer.opacity / 100;
    switch (layer.type) {
      case 'route': {
        map.setPaintProperty(layerId(layer.id), 'line-color', isHighlighted ? HIGHLIGHT_COLOR : ROUTE_COLOR);
        map.setPaintProperty(layerId(layer.id), 'line-opacity', opacity);
        map.setPaintProperty(layerId(layer.id), 'line-width', isHighlighted ? 6 : 4);
        break;
      }
      case 'poi': {
        map.setPaintProperty(layerId(layer.id), 'circle-color', isHighlighted ? HIGHLIGHT_COLOR : POI_COLOR);
        map.setPaintProperty(layerId(layer.id), 'circle-opacity', opacity);
        map.setPaintProperty(layerId(layer.id), 'circle-radius', isHighlighted ? 9 : 7);
        break;
      }
      case 'shape': {
        map.setPaintProperty(layerId(layer.id, 'fill'), 'fill-color', isHighlighted ? HIGHLIGHT_COLOR : SHAPE_COLOR);
        map.setPaintProperty(layerId(layer.id, 'fill'), 'fill-opacity', opacity);
        map.setPaintProperty(layerId(layer.id, 'line'), 'line-color', isHighlighted ? HIGHLIGHT_COLOR : SHAPE_COLOR);
        map.setPaintProperty(layerId(layer.id, 'line'), 'line-opacity', opacity);
        map.setPaintProperty(layerId(layer.id, 'line'), 'line-width', isHighlighted ? 3 : 2);
        break;
      }
      // No default
    }
  };

  const sync = ({ layers, selectedId, previewedId }: MapContentState) => {
    try {
      if (!map.isStyleLoaded()) return 'deferred';
      const visibleLayers = layers.filter((layer) => layer.visible && layer.geometry);
      const nextStructure = visibleLayers
        .map((layer) => `${encodedContentId(layer.id)}:${layer.type}:${JSON.stringify(layer.geometry)}`)
        .join('|');
      if (!isCleanupPending && nextStructure === renderedStructure) {
        visibleLayers.forEach((layer) => updateLayerPaint(layer, selectedId, previewedId));
        container.dataset.mapLayerOrder = visibleLayers.map((layer) => layer.id).join(',');
        container.dataset.selectedLayer = selectedId ?? '';
        container.dataset.previewedLayer = previewedId ?? '';
        delete container.dataset.mapContentError;
        return 'synced';
      }

      if (!removeRenderedContent()) throw new Error('Map content cleanup incomplete');
      for (const layer of [...visibleLayers].reverse()) {
        const source = sourceId(layer.id);
        const isHighlighted = layer.id === selectedId || layer.id === previewedId;
        const opacity = layer.opacity / 100;
        map.addSource(source, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: { layerId: layer.id },
            geometry: layer.geometry!,
          },
        });
        renderedSourceIds.push(source);

        switch (layer.type) {
          case 'route': {
            const id = layerId(layer.id);
            map.addLayer({
              id,
              source,
              type: 'line',
              paint: {
                'line-color': isHighlighted ? HIGHLIGHT_COLOR : ROUTE_COLOR,
                'line-opacity': opacity,
                'line-width': isHighlighted ? 6 : 4,
              },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            });
            renderedMapLayerIds.push(id);
            break;
          }
          case 'poi': {
            const id = layerId(layer.id);
            map.addLayer({
              id,
              source,
              type: 'circle',
              paint: {
                'circle-color': isHighlighted ? HIGHLIGHT_COLOR : POI_COLOR,
                'circle-opacity': opacity,
                'circle-radius': isHighlighted ? 9 : 7,
                'circle-stroke-color': POI_STROKE,
                'circle-stroke-width': 2,
              },
            });
            renderedMapLayerIds.push(id);
            break;
          }
          case 'shape': {
            const fillId = layerId(layer.id, 'fill');
            const lineId = layerId(layer.id, 'line');
            map.addLayer({
              id: fillId,
              source,
              type: 'fill',
              paint: {
                'fill-color': isHighlighted ? HIGHLIGHT_COLOR : SHAPE_COLOR,
                'fill-opacity': opacity,
              },
            });
            renderedMapLayerIds.push(fillId);
            map.addLayer({
              id: lineId,
              source,
              type: 'line',
              paint: {
                'line-color': isHighlighted ? HIGHLIGHT_COLOR : SHAPE_COLOR,
                'line-opacity': opacity,
                'line-width': isHighlighted ? 3 : 2,
              },
            });
            renderedMapLayerIds.push(lineId);
            break;
          }
          // No default
        }
      }
      renderedStructure = nextStructure;
      container.dataset.mapLayerOrder = visibleLayers.map((layer) => layer.id).join(',');
      container.dataset.selectedLayer = selectedId ?? '';
      container.dataset.previewedLayer = previewedId ?? '';
      delete container.dataset.mapContentError;
      return 'synced';
    } catch {
      removeRenderedContent();
      container.dataset.mapLayerOrder = '';
      container.dataset.selectedLayer = '';
      container.dataset.previewedLayer = '';
      container.dataset.mapContentError = 'true';
      return 'failed';
    }
  };

  return {
    sync,
    hitTest: (point) => {
      if (renderedMapLayerIds.length === 0) return null;
      try {
        const feature = map.queryRenderedFeatures(point, { layers: renderedMapLayerIds })[0];
        const hitLayerId = typeof feature?.properties?.layerId === 'string' ? feature.properties.layerId : null;
        delete container.dataset.mapContentError;
        return hitLayerId;
      } catch {
        container.dataset.mapContentError = 'true';
        return;
      }
    },
    destroy: removeRenderedContent,
  };
}
