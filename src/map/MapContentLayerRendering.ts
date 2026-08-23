import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer, PoiAppearance } from '../domain/project';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';
import { POI_MARKER_SYMBOL_GLYPHS } from '../domain/poiMarkers';
import { ROUTE_TRAVEL_PROFILE_MARKERS } from '../domain/routeProfiles';

export type RenderedMapContent = {
  mapLayerIds: string[];
  sourceIds: string[];
  structure: string;
};

type PaintProperty = Parameters<MapLibreMap['setPaintProperty']>[1];
type PaintValue = Parameters<MapLibreMap['setPaintProperty']>[2];

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
const POI_APPEARANCE = {
  kind: 'poi',
  color: '#0d78b5',
  size: 14,
  markerShape: 'circle',
  markerSymbol: 'none',
  label: '',
  customAssetId: null,
} as const;
const SHAPE_APPEARANCE = {
  kind: 'shape', fillColor: '#d18b25', strokeColor: '#d18b25', strokeWidth: 2,
} as const;
const HIGHLIGHT_COLOR = '#006fc9';
const POI_STROKE = '#ffffff';

const encodedContentId = (id: string) => `${id.length}:${id}`;
const sourceId = (id: string) => `${SOURCE_PREFIX}${encodedContentId(id)}`;
const layerId = (id: string, role = 'main') => `${LAYER_PREFIX}${encodedContentId(id)}:${role}`;
export const customMarkerImageId = (assetId: string) => `studio-marker-${assetId}`;
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
    const poiMarker = layer.appearance?.kind === 'poi'
      ? `:${layer.appearance.markerShape}:${layer.appearance.markerSymbol}:${layer.appearance.label}:${layer.appearance.size}:${layer.appearance.customAssetId ?? ''}`
      : '';
    return `${encodedContentId(layer.id)}:${layer.type}:${JSON.stringify(layer.geometry)}${routeMarker}${poiMarker}`;
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

function customPoiMarkerDescriptor(layer: ContentLayer, appearance: PoiAppearance, asset: CustomMarkerAsset): MapLayerDescriptor {
  return {
    id: layerId(layer.id),
    type: 'symbol',
    layout: {
      'icon-image': customMarkerImageId(asset.id),
      'icon-size': appearance.size / Math.max(asset.width, asset.height),
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity': layer.opacity / 100 },
  };
}

function standardPoiMarkerDescriptor(layer: ContentLayer, appearance: PoiAppearance, isHighlighted: boolean): MapLayerDescriptor {
  const radius = appearance.size / 2;
  if (appearance.markerShape === 'circle') {
    return {
      id: layerId(layer.id),
      type: 'circle',
      paint: {
        'circle-color': isHighlighted ? HIGHLIGHT_COLOR : appearance.color,
        'circle-opacity': layer.opacity / 100,
        'circle-radius': isHighlighted ? radius + 2 : radius,
        'circle-stroke-color': POI_STROKE,
        'circle-stroke-width': 2,
      },
    };
  }
  return {
    id: layerId(layer.id),
    type: 'symbol',
    layout: {
      'text-field': appearance.markerShape === 'square' ? '■' : '◆',
      'text-font': ['Noto Sans Regular'],
      'text-size': appearance.size * 1.25,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': isHighlighted ? HIGHLIGHT_COLOR : appearance.color,
      'text-opacity': layer.opacity / 100,
      'text-halo-color': POI_STROKE,
      'text-halo-width': 1.5,
    },
  };
}

function poiSymbolDescriptor(layer: ContentLayer, appearance: PoiAppearance, hasCustomAsset: boolean): MapLayerDescriptor | undefined {
  const symbol = hasCustomAsset ? '' : POI_MARKER_SYMBOL_GLYPHS[appearance.markerSymbol];
  if (!symbol) return;
  return {
    id: layerId(layer.id, 'symbol'),
    type: 'symbol',
    layout: {
      'text-field': symbol,
      'text-font': ['Noto Sans Regular'],
      'text-size': Math.max(10, appearance.size / 2),
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': '#ffffff',
      'text-opacity': layer.opacity / 100,
      'text-halo-color': 'rgba(0,0,0,0.28)',
      'text-halo-width': 0.5,
    },
  };
}

function poiLabelDescriptor(layer: ContentLayer, appearance: PoiAppearance): MapLayerDescriptor | undefined {
  if (!appearance.label) return;
  return {
    id: layerId(layer.id, 'label'),
    type: 'symbol',
    layout: {
      'text-field': appearance.label,
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
      'text-anchor': 'top',
      'text-offset': [0, (appearance.size / 2 + 6) / 12],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': '#1e1e1e',
      'text-opacity': layer.opacity / 100,
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
    },
  };
}

const poiLayerDescriptors = (layer: ContentLayer, isHighlighted: boolean, assets: Record<string, CustomMarkerAsset>) => {
  const appearance = layer.appearance?.kind === 'poi' ? layer.appearance : POI_APPEARANCE;
  const customAsset = appearance.customAssetId ? assets[appearance.customAssetId] : undefined;
  if (!customAsset && appearance.customAssetId) throw new Error(`Layer "${layer.id}" references a missing custom marker asset.`);
  const marker = customAsset
    ? customPoiMarkerDescriptor(layer, appearance, customAsset)
    : standardPoiMarkerDescriptor(layer, appearance, isHighlighted);
  return [marker, poiSymbolDescriptor(layer, appearance, !!customAsset), poiLabelDescriptor(layer, appearance)]
    .filter((descriptor): descriptor is MapLayerDescriptor => descriptor !== undefined);
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

type MapLayerDescriptor = {
  id: string;
  type: 'circle' | 'fill' | 'line' | 'symbol';
  layout?: Record<string, unknown>;
  paint: Record<string, PaintValue>;
};

export function mapLayerDescriptors(
  layer: ContentLayer,
  highlight: HighlightState,
  assets: Record<string, CustomMarkerAsset> = {},
): MapLayerDescriptor[] {
  const isHighlighted = isLayerHighlighted(layer, highlight);
  switch (layer.type) {
    case 'route': {
      return routeLayerDescriptor(layer, isHighlighted);
    }
    case 'poi': {
      return poiLayerDescriptors(layer, isHighlighted, assets);
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
  assets: Record<string, CustomMarkerAsset> = {},
) {
  for (const descriptor of mapLayerDescriptors(layer, highlight, assets)) {
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
  for (const descriptor of descriptors) {
    map.addLayer({ ...descriptor, source } as Parameters<MapLibreMap['addLayer']>[0]);
  }
  return descriptors.map(({ id }) => id);
}

export function addContentLayer(
  map: MapLibreMap,
  layer: ContentLayer,
  options: Readonly<{
    assets: Record<string, CustomMarkerAsset>;
    highlight: HighlightState;
    rendered: RenderedMapContent;
  }>,
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
  options.rendered.sourceIds.push(source);

  const descriptors = mapLayerDescriptors(layer, options.highlight, options.assets);
  options.rendered.mapLayerIds.push(...descriptors.map(({ id }) => id));
  return addMapLayers(map, source, descriptors);
}
