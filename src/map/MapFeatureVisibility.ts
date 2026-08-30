import type { MapFeatureVisibility, MapFeatureVisibilityCategory } from '../domain/project';

type StyleLayer = {
  id: string;
  type?: string;
  'source-layer'?: string;
  layout?: Record<string, unknown>;
};

type FeatureVisibilityMap = {
  getStyle: () => { layers?: readonly StyleLayer[] };
  setLayoutProperty: (layerId: string, property: string, value: 'none' | 'visible') => void;
};

type ControlledLayer = {
  categories: MapFeatureVisibilityCategory[];
  id: string;
  originalVisibility: 'none' | 'visible';
};

const RAIL_LAYER_TOKENS = new Set(['rail', 'railway', 'transit']);

function isRailTransportationLayer(layerId: string) {
  return layerId.split(/[-_]/).some((token) => RAIL_LAYER_TOKENS.has(token));
}

function hasLayerToken(layerId: string, tokens: ReadonlySet<string>) {
  return layerId.split(/[-_]/).some((token) => tokens.has(token));
}

const WATER_LAYER_TOKENS = new Set(['water', 'waterway']);
const PARK_LAYER_TOKENS = new Set(['park', 'parks']);

function categoriesForLayer(layer: StyleLayer): MapFeatureVisibilityCategory[] {
  const categories = [
    layer.type === 'symbol' ? 'labels' : null,
    detailCategoryForLayer(layer),
    transportCategoryForLayer(layer),
    layer['source-layer'] === 'building' ? 'buildings' : null,
  ];
  return categories.filter((category): category is MapFeatureVisibilityCategory => category !== null);
}

function detailCategoryForLayer(layer: StyleLayer): MapFeatureVisibilityCategory | null {
  const sourceLayer = layer['source-layer'];
  if (sourceLayer === 'water' || sourceLayer === 'waterway' || hasLayerToken(layer.id, WATER_LAYER_TOKENS)) return 'water';
  if (sourceLayer === 'park' || hasLayerToken(layer.id, PARK_LAYER_TOKENS)) return 'parks';
  if (sourceLayer === 'landuse' || sourceLayer === 'landcover') return 'landuse';
  return null;
}

function transportCategoryForLayer(layer: StyleLayer): MapFeatureVisibilityCategory | null {
  if (layer['source-layer'] === 'transportation') return isRailTransportationLayer(layer.id) ? 'transit' : 'roads';
  return isRailTransportationLayer(layer.id) ? 'transit' : null;
}

function isCategoryVisible(visibility: MapFeatureVisibility, category: MapFeatureVisibilityCategory) {
  switch (category) {
    case 'roads': { return visibility.roads; }
    case 'buildings': { return visibility.buildings; }
    case 'labels': { return visibility.labels; }
    case 'water': { return visibility.water; }
    case 'parks': { return visibility.parks; }
    case 'landuse': { return visibility.landuse; }
    case 'transit': { return visibility.transit; }
  }
}

function effectiveLayerVisibility(
  layer: ControlledLayer,
  visibility: MapFeatureVisibility,
  isBasemapVisible: boolean,
): 'none' | 'visible' {
  return isBasemapVisible
    && layer.categories.every((category) => isCategoryVisible(visibility, category))
    ? layer.originalVisibility
    : 'none';
}

export function createMapFeatureVisibilityController(map: FeatureVisibilityMap) {
  const controlledLayers: ControlledLayer[] = [];
  const styleLayers = map.getStyle().layers ?? [];
  for (const layer of styleLayers) {
    const categories = categoriesForLayer(layer);
    controlledLayers.push({
      categories,
      id: layer.id,
      originalVisibility: layer.layout?.visibility === 'none' ? 'none' : 'visible',
    });
  }

  return {
    apply(visibility: MapFeatureVisibility, isBasemapVisible = true) {
      for (const layer of controlledLayers) {
        map.setLayoutProperty(
          layer.id,
          'visibility',
          effectiveLayerVisibility(layer, visibility, isBasemapVisible),
        );
      }
    },
    style<T extends ReturnType<FeatureVisibilityMap['getStyle']>>(
      style: T,
      visibility: MapFeatureVisibility,
      isBasemapVisible: boolean,
    ): T {
      const output = structuredClone(style);
      const controlsById = new Map(controlledLayers.map((layer) => [layer.id, layer]));
      const outputLayers = output.layers ?? [];
      for (const layer of outputLayers) {
        const controlled = controlsById.get(layer.id);
        if (!controlled) continue;
        layer.layout = {
          ...layer.layout,
          visibility: effectiveLayerVisibility(controlled, visibility, isBasemapVisible),
        };
      }
      return output;
    },
  };
}
