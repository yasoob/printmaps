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
  category: MapFeatureVisibilityCategory;
  id: string;
  originalVisibility: 'none' | 'visible';
};

const RAIL_LAYER_TOKENS = new Set(['rail', 'railway', 'transit']);

function isRailTransportationLayer(layerId: string) {
  return layerId.split(/[-_]/).some((token) => RAIL_LAYER_TOKENS.has(token));
}

function categoryForLayer(layer: StyleLayer): MapFeatureVisibilityCategory | null {
  if (layer.type === 'symbol' && layer.layout?.['text-field'] !== undefined) return 'labels';
  if (layer['source-layer'] === 'transportation' && !isRailTransportationLayer(layer.id)) return 'roads';
  if (layer['source-layer'] === 'building') return 'buildings';
  return null;
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
    const category = categoryForLayer(layer);
    if (!category) continue;
    controlledLayers.push({
      category,
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
          isCategoryVisible(visibility, layer.category) ? layer.originalVisibility : 'none',
        );
      }
    },
  };
}
