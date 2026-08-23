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

function categoriesForLayer(layer: StyleLayer): MapFeatureVisibilityCategory[] {
  if (layer.type === 'symbol') {
    const categories: MapFeatureVisibilityCategory[] = ['labels'];
    if (
      layer.layout?.['text-field'] === undefined
      && layer['source-layer'] === 'transportation'
      && !isRailTransportationLayer(layer.id)
    ) {
      categories.push('roads');
    }
    return categories;
  }
  if (layer['source-layer'] === 'transportation' && !isRailTransportationLayer(layer.id)) return ['roads'];
  if (layer['source-layer'] === 'building') return ['buildings'];
  return [];
}

function isCategoryVisible(visibility: MapFeatureVisibility, category: MapFeatureVisibilityCategory) {
  switch (category) {
    case 'roads': { return visibility.roads; }
    case 'buildings': { return visibility.buildings; }
    case 'labels': { return visibility.labels; }
  }
}

export function createMapFeatureVisibilityController(map: FeatureVisibilityMap) {
  const controlledLayers: ControlledLayer[] = [];
  const styleLayers = map.getStyle().layers ?? [];
  for (const layer of styleLayers) {
    const categories = categoriesForLayer(layer);
    if (categories.length === 0) continue;
    controlledLayers.push({
      categories,
      id: layer.id,
      originalVisibility: layer.layout?.visibility === 'none' ? 'none' : 'visible',
    });
  }

  return {
    apply(visibility: MapFeatureVisibility) {
      for (const layer of controlledLayers) {
        map.setLayoutProperty(
          layer.id,
          'visibility',
          layer.categories.every((category) => isCategoryVisible(visibility, category))
            ? layer.originalVisibility
            : 'none',
        );
      }
    },
  };
}
