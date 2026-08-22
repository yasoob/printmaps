import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';

export type RenderedMapContent = {
  mapLayerIds: string[];
  sourceIds: string[];
  structure: string;
};

type PaintProperty = Parameters<MapLibreMap['setPaintProperty']>[1];

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

const routeLayerDescriptor = (layer: ContentLayer, isHighlighted: boolean) => ({
  id: layerId(layer.id),
  type: 'line' as const,
  paint: {
    'line-color': isHighlighted ? HIGHLIGHT_COLOR : ROUTE_COLOR,
    'line-opacity': layer.opacity / 100,
    'line-width': isHighlighted ? 6 : 4,
  },
  layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const },
});

const poiLayerDescriptor = (layer: ContentLayer, isHighlighted: boolean) => ({
  id: layerId(layer.id),
  type: 'circle' as const,
  paint: {
    'circle-color': isHighlighted ? HIGHLIGHT_COLOR : POI_COLOR,
    'circle-opacity': layer.opacity / 100,
    'circle-radius': isHighlighted ? 9 : 7,
    'circle-stroke-color': POI_STROKE,
    'circle-stroke-width': 2,
  },
});

const shapeLayerDescriptors = (layer: ContentLayer, isHighlighted: boolean) => [{
  id: layerId(layer.id, 'fill'),
  type: 'fill' as const,
  paint: {
    'fill-color': isHighlighted ? HIGHLIGHT_COLOR : SHAPE_COLOR,
    'fill-opacity': layer.opacity / 100,
  },
}, {
  id: layerId(layer.id, 'line'),
  type: 'line' as const,
  paint: {
    'line-color': isHighlighted ? HIGHLIGHT_COLOR : SHAPE_COLOR,
    'line-opacity': layer.opacity / 100,
    'line-width': isHighlighted ? 3 : 2,
  },
}];

type MapLayerDescriptor =
  | ReturnType<typeof routeLayerDescriptor>
  | ReturnType<typeof poiLayerDescriptor>
  | ReturnType<typeof shapeLayerDescriptors>[number];

function mapLayerDescriptors(
  layer: ContentLayer,
  highlight: HighlightState,
): MapLayerDescriptor[] {
  const isHighlighted = isLayerHighlighted(layer, highlight);
  switch (layer.type) {
    case 'route': {
      return [routeLayerDescriptor(layer, isHighlighted)];
    }
    case 'poi': {
      return [poiLayerDescriptor(layer, isHighlighted)];
    }
    case 'shape': {
      return shapeLayerDescriptors(layer, isHighlighted);
    }
    default: {
      return [];
    }
  }
}

export function updateLayerPaint(
  map: MapLibreMap,
  layer: ContentLayer,
  highlight: HighlightState,
) {
  for (const descriptor of mapLayerDescriptors(layer, highlight)) {
    for (const [property, value] of Object.entries(descriptor.paint)) {
      map.setPaintProperty(descriptor.id, property as PaintProperty, value);
    }
  }
}

function addMapLayers(
  map: MapLibreMap,
  source: string,
  descriptors: MapLayerDescriptor[],
) {
  for (const descriptor of descriptors) map.addLayer({ ...descriptor, source });
  return descriptors.map(({ id }) => id);
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

  const descriptors = mapLayerDescriptors(layer, highlight);
  rendered.mapLayerIds.push(...descriptors.map(({ id }) => id));
  return addMapLayers(map, source, descriptors);
}
