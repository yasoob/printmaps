import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';

export type RenderedMapContent = {
  mapLayerIds: string[];
  sourceIds: string[];
  structure: string;
};

type HighlightState = {
  selectedId: string | null;
  previewedId: string | null;
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
const isLayerHighlighted = (layer: ContentLayer, highlight: HighlightState) => (
  layer.id === highlight.selectedId || layer.id === highlight.previewedId
);

export const visibleContentLayers = (layers: ContentLayer[]) => (
  layers.filter((layer) => layer.visible && layer.geometry)
);

export const contentStructure = (layers: ContentLayer[]) => layers
  .map((layer) => `${encodedContentId(layer.id)}:${layer.type}:${JSON.stringify(layer.geometry)}`)
  .join('|');

export function updateLayerPaint(
  map: MapLibreMap,
  layer: ContentLayer,
  highlight: HighlightState,
) {
  const isHighlighted = isLayerHighlighted(layer, highlight);
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
}

function addRouteLayer(
  map: MapLibreMap,
  layer: ContentLayer,
  source: string,
  isHighlighted: boolean,
) {
  const id = layerId(layer.id);
  map.addLayer({
    id,
    source,
    type: 'line',
    paint: {
      'line-color': isHighlighted ? HIGHLIGHT_COLOR : ROUTE_COLOR,
      'line-opacity': layer.opacity / 100,
      'line-width': isHighlighted ? 6 : 4,
    },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  });
  return [id];
}

function addPoiLayer(
  map: MapLibreMap,
  layer: ContentLayer,
  source: string,
  isHighlighted: boolean,
) {
  const id = layerId(layer.id);
  map.addLayer({
    id,
    source,
    type: 'circle',
    paint: {
      'circle-color': isHighlighted ? HIGHLIGHT_COLOR : POI_COLOR,
      'circle-opacity': layer.opacity / 100,
      'circle-radius': isHighlighted ? 9 : 7,
      'circle-stroke-color': POI_STROKE,
      'circle-stroke-width': 2,
    },
  });
  return [id];
}

function addShapeLayers(
  map: MapLibreMap,
  layer: ContentLayer,
  source: string,
  state: { isHighlighted: boolean; rendered: RenderedMapContent },
) {
  const { isHighlighted, rendered } = state;
  const fillId = layerId(layer.id, 'fill');
  const lineId = layerId(layer.id, 'line');
  map.addLayer({
    id: fillId,
    source,
    type: 'fill',
    paint: {
      'fill-color': isHighlighted ? HIGHLIGHT_COLOR : SHAPE_COLOR,
      'fill-opacity': layer.opacity / 100,
    },
  });
  rendered.mapLayerIds.push(fillId);
  map.addLayer({
    id: lineId,
    source,
    type: 'line',
    paint: {
      'line-color': isHighlighted ? HIGHLIGHT_COLOR : SHAPE_COLOR,
      'line-opacity': layer.opacity / 100,
      'line-width': isHighlighted ? 3 : 2,
    },
  });
  return [lineId];
}

export function addContentLayer(
  map: MapLibreMap,
  layer: ContentLayer,
  highlight: HighlightState,
  rendered: RenderedMapContent,
) {
  const source = sourceId(layer.id);
  map.addSource(source, {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: { layerId: layer.id },
      geometry: layer.geometry!,
    },
  });
  rendered.sourceIds.push(source);

  const isHighlighted = isLayerHighlighted(layer, highlight);
  let addedLayerIds: string[] = [];
  switch (layer.type) {
    case 'route': {
      addedLayerIds = addRouteLayer(map, layer, source, isHighlighted);
      break;
    }
    case 'poi': {
      addedLayerIds = addPoiLayer(map, layer, source, isHighlighted);
      break;
    }
    case 'shape': {
      addedLayerIds = addShapeLayers(map, layer, source, { isHighlighted, rendered });
      break;
    }
    // No default
  }
  rendered.mapLayerIds.push(...addedLayerIds);
}
