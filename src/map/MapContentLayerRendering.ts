import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';
import { ROUTE_TRAVEL_PROFILE_MARKERS } from '../domain/routeProfiles';

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
const ROUTE_APPEARANCE = {
  kind: 'route',
  color: '#d9363e',
  width: 4,
  travelProfile: 'car',
  showTravelModeIcon: false,
} as const;
const POI_APPEARANCE = { kind: 'poi', color: '#0d78b5', size: 14 } as const;
const SHAPE_APPEARANCE = {
  kind: 'shape', fillColor: '#d18b25', strokeColor: '#d18b25', strokeWidth: 2,
} as const;
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
  .map((layer) => {
    const routeMarker = layer.appearance?.kind === 'route'
      ? `:${layer.appearance.travelProfile}:${layer.appearance.showTravelModeIcon}`
      : '';
    return `${encodedContentId(layer.id)}:${layer.type}:${JSON.stringify(layer.geometry)}${routeMarker}`;
  })
  .join('|');

const routeLayerDescriptor = (layer: ContentLayer, isHighlighted: boolean) => {
  const appearance = layer.appearance?.kind === 'route' ? layer.appearance : ROUTE_APPEARANCE;
  const line = {
    id: layerId(layer.id),
    type: 'line' as const,
    paint: {
      'line-color': isHighlighted ? HIGHLIGHT_COLOR : appearance.color,
      'line-opacity': layer.opacity / 100,
      'line-width': isHighlighted ? appearance.width + 2 : appearance.width,
    },
    layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const },
  };
  if (!appearance.showTravelModeIcon) return [line];
  return [line, {
    id: layerId(layer.id, 'travel-mode'),
    type: 'symbol' as const,
    layout: {
      'symbol-placement': 'line-center' as const,
      'text-field': ROUTE_TRAVEL_PROFILE_MARKERS[appearance.travelProfile],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': '#ffffff',
      'text-opacity': layer.opacity / 100,
      'text-halo-color': isHighlighted ? HIGHLIGHT_COLOR : appearance.color,
      'text-halo-width': 4,
    },
  }];
};

const poiLayerDescriptor = (layer: ContentLayer, isHighlighted: boolean) => {
  const appearance = layer.appearance?.kind === 'poi' ? layer.appearance : POI_APPEARANCE;
  const radius = appearance.size / 2;
  return {
    id: layerId(layer.id),
    type: 'circle' as const,
    paint: {
      'circle-color': isHighlighted ? HIGHLIGHT_COLOR : appearance.color,
      'circle-opacity': layer.opacity / 100,
      'circle-radius': isHighlighted ? radius + 2 : radius,
      'circle-stroke-color': POI_STROKE,
      'circle-stroke-width': 2,
    },
  };
};

const shapeLayerDescriptors = (layer: ContentLayer, isHighlighted: boolean) => {
  const appearance = layer.appearance?.kind === 'shape' ? layer.appearance : SHAPE_APPEARANCE;
  return [{
    id: layerId(layer.id, 'fill'),
    type: 'fill' as const,
    paint: {
      'fill-color': isHighlighted ? HIGHLIGHT_COLOR : appearance.fillColor,
      'fill-opacity': layer.opacity / 100,
    },
  }, {
    id: layerId(layer.id, 'line'),
    type: 'line' as const,
    paint: {
      'line-color': isHighlighted ? HIGHLIGHT_COLOR : appearance.strokeColor,
      'line-opacity': layer.opacity / 100,
      'line-width': isHighlighted ? appearance.strokeWidth + 1 : appearance.strokeWidth,
    },
  }];
};

type MapLayerDescriptor =
  | ReturnType<typeof routeLayerDescriptor>[number]
  | ReturnType<typeof poiLayerDescriptor>
  | ReturnType<typeof shapeLayerDescriptors>[number];

export function mapLayerDescriptors(
  layer: ContentLayer,
  highlight: HighlightState,
): MapLayerDescriptor[] {
  const isHighlighted = isLayerHighlighted(layer, highlight);
  switch (layer.type) {
    case 'route': {
      return routeLayerDescriptor(layer, isHighlighted);
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
