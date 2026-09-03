import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer, PoiAppearance } from '../domain/project';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';
import { POI_MARKER_SYMBOL_GLYPHS } from '../domain/poiMarkers';
import { addMapContentSource, mapContentSourceId, mapGeometryForLayer } from './MapContentGeometry';
import { customMarkerImageId, encodedContentId, mapContentLayerId } from './MapContentLayerIds';
import { shapeLayerDescriptors } from './MapShapeLayerRendering';

export { customMarkerImageId } from './MapContentLayerIds';

export type RenderedMapContent = {
  mapLayerIds: string[];
  hitTestLayerIds: string[];
  sourceIds: string[];
  structure: string;
};

type PaintProperty = Parameters<MapLibreMap['setPaintProperty']>[1];
type PaintValue = Parameters<MapLibreMap['setPaintProperty']>[2];

type HighlightState = {
  selectedId: string | null;
  previewedId: string | null;
};

const ROUTE_APPEARANCE = {
  kind: 'route',
  color: '#d9363e',
  width: 4,
  strokeStyle: 'solid',
  marker: null,
  segmentStyles: [],
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
const HIGHLIGHT_COLOR = '#006fc9';
const POI_STROKE = '#ffffff';
const isLayerHighlighted = (layer: ContentLayer, highlight: HighlightState) => (
  layer.id === highlight.selectedId || layer.id === highlight.previewedId
);
const isLayerSelected = (layer: ContentLayer, highlight: HighlightState) => layer.id === highlight.selectedId;
const isLayerPreviewed = (layer: ContentLayer, highlight: HighlightState) => layer.id === highlight.previewedId;

export const visibleContentLayers = (layers: ContentLayer[]) => (
  layers.filter((layer) => layer.visible && layer.geometry)
);

export const contentStructure = (layers: ContentLayer[]) => layers
  .map((layer) => {
    const routeMarker = layer.appearance?.kind === 'route'
      ? `:${layer.appearance.marker !== null}`
      : '';
    const poiMarker = layer.appearance?.kind === 'poi'
      ? `:${layer.appearance.markerShape}:${layer.appearance.markerSymbol}:${layer.appearance.label}:${layer.appearance.size}:${layer.appearance.customAssetId ?? ''}`
      : '';
    const shapeMask = layer.appearance?.kind === 'shape' ? `:${layer.appearance.invert}` : '';
    return `${encodedContentId(layer.id)}:${layer.type}:${layer.geometry?.type}${routeMarker}${poiMarker}${shapeMask}`;
  })
  .join('|');

const routeLayerDescriptor = (layer: ContentLayer, isHighlighted: boolean) => {
  const appearance = layer.appearance?.kind === 'route' ? layer.appearance : ROUTE_APPEARANCE;
  const segmentFilter = ['==', ['get', 'featureKind'], 'segment'];
  const casing: MapLayerDescriptor = {
    id: mapContentLayerId(layer.id, 'casing'),
    type: 'line' as const,
    filter: segmentFilter,
    paint: {
      'line-color': HIGHLIGHT_COLOR,
      'line-opacity': isHighlighted ? layer.opacity / 100 : 0,
      'line-width': ['+', ['get', 'width'], 4] as PaintValue,
    },
    layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const },
  };
  const line = (strokeStyle: 'solid' | 'dashed'): MapLayerDescriptor => ({
    id: mapContentLayerId(layer.id, strokeStyle),
    type: 'line' as const,
    filter: ['all', segmentFilter, ['==', ['get', 'strokeStyle'], strokeStyle]],
    paint: {
      'line-color': ['get', 'color'] as PaintValue,
      'line-opacity': layer.opacity / 100,
      'line-width': ['get', 'width'] as PaintValue,
      ...(strokeStyle === 'dashed' && { 'line-dasharray': [2, 1.5] }),
    },
    layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const },
  });
  if (!appearance.marker) return [casing, line('solid'), line('dashed')];
  const marker: MapLayerDescriptor = {
    id: mapContentLayerId(layer.id, 'travel-mode'),
    type: 'symbol' as const,
    hitTest: false,
    filter: ['==', ['get', 'featureKind'], 'marker'],
    layout: {
      'icon-image': ['get', 'iconImage'],
      'icon-size': 1,
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'icon-opacity': layer.opacity / 100,
    },
  };
  return [casing, line('solid'), line('dashed'), marker];
};

function customPoiMarkerDescriptor(layer: ContentLayer, appearance: PoiAppearance, asset: CustomMarkerAsset): MapLayerDescriptor {
  return {
    id: mapContentLayerId(layer.id),
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
      id: mapContentLayerId(layer.id),
      type: 'circle',
      paint: {
        'circle-color': appearance.color,
        'circle-opacity': layer.opacity / 100,
        'circle-radius': isHighlighted ? radius + 2 : radius,
        'circle-stroke-color': isHighlighted ? HIGHLIGHT_COLOR : POI_STROKE,
        'circle-stroke-width': isHighlighted ? 3 : 2,
      },
    };
  }
  return {
    id: mapContentLayerId(layer.id),
    type: 'symbol',
    layout: {
      'text-field': appearance.markerShape === 'square' ? '■' : '◆',
      'text-font': ['Noto Sans Regular'],
      'text-size': appearance.size * 1.25,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': appearance.color,
      'text-opacity': layer.opacity / 100,
      'text-halo-color': isHighlighted ? HIGHLIGHT_COLOR : POI_STROKE,
      'text-halo-width': isHighlighted ? 2.5 : 1.5,
    },
  };
}

function poiSymbolDescriptor(layer: ContentLayer, appearance: PoiAppearance, hasCustomAsset: boolean): MapLayerDescriptor | undefined {
  const symbol = hasCustomAsset ? '' : POI_MARKER_SYMBOL_GLYPHS[appearance.markerSymbol];
  if (!symbol) return;
  return {
    id: mapContentLayerId(layer.id, 'symbol'),
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
    id: mapContentLayerId(layer.id, 'label'),
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

export type MapLayerDescriptor = {
  id: string;
  type: 'circle' | 'fill' | 'line' | 'symbol';
  hitTest?: boolean;
  sourceRole?: 'outline';
  filter?: unknown[];
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
      return shapeLayerDescriptors(
        layer,
        isLayerSelected(layer, highlight),
        isLayerPreviewed(layer, highlight),
      );
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
  outlineSource?: string,
) {
  for (const descriptor of descriptors) {
    const { sourceRole, ...mapDescriptor } = descriptor;
    delete mapDescriptor.hitTest;
    map.addLayer({
      ...mapDescriptor,
      source: sourceRole === 'outline' ? outlineSource : source,
    } as Parameters<MapLibreMap['addLayer']>[0]);
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
  const source = mapContentSourceId(layer.id);
  const geometry = mapGeometryForLayer(layer);
  addMapContentSource(map, source, layer, geometry);
  options.rendered.sourceIds.push(source);

  const descriptors = mapLayerDescriptors(layer, options.highlight, options.assets);
  const needsOutlineSource = descriptors.some(({ sourceRole }) => sourceRole === 'outline');
  const outlineSource = needsOutlineSource ? mapContentSourceId(layer.id, 'outline') : undefined;
  if (outlineSource) {
    if (layer.geometry?.type !== 'Polygon' && layer.geometry?.type !== 'MultiPolygon') {
      throw new Error('Only shape geometry may create an outline source.');
    }
    addMapContentSource(map, outlineSource, layer, layer.geometry);
    options.rendered.sourceIds.push(outlineSource);
  }
  for (const { hitTest, id } of descriptors) {
    options.rendered.mapLayerIds.push(id);
    if (hitTest !== false) options.rendered.hitTestLayerIds.push(id);
  }
  return addMapLayers(map, source, descriptors, outlineSource);
}
