import type { MapStyleTokenRole, MapStyleTokens } from '../domain/mapStylePresets';
import type { Map as MapLibreMap } from 'maplibre-gl';

export type SemanticStyleLayer = {
  id?: string;
  type?: string;
  'source-layer'?: string;
  paint?: Record<string, unknown>;
};

type SemanticPaintAssignment = {
  property: string;
  role: MapStyleTokenRole;
};

function fillRole(layer: SemanticStyleLayer, id: string): MapStyleTokenRole {
  const sourceLayer = layer['source-layer'];
  if (sourceLayer === 'water' || sourceLayer === 'waterway' || id.includes('water')) return 'water';
  if (sourceLayer === 'park' || sourceLayer === 'landcover' || sourceLayer === 'landuse' || id.includes('park')) return 'park';
  return sourceLayer === 'building' ? 'building' : 'land';
}

function lineRole(layer: SemanticStyleLayer, id: string): MapStyleTokenRole {
  const sourceLayer = layer['source-layer'];
  if (sourceLayer === 'water' || sourceLayer === 'waterway' || id.includes('water')) return 'water';
  if (id.includes('rail') || id.includes('transit')) return 'transit';
  if (sourceLayer !== 'transportation') return 'boundary';
  return /motorway|trunk|primary|secondary|major/.test(id) ? 'majorRoad' : 'minorRoad';
}

function assignmentsForLayer(layer: SemanticStyleLayer): SemanticPaintAssignment[] {
  if (layer.id?.startsWith('studio-')) return [];
  const id = layer.id?.toLowerCase() ?? '';
  if (layer.type === 'background') return [{ property: 'background-color', role: 'canvas' }];
  if (layer.type === 'symbol') {
    return [
      { property: 'text-color', role: 'label' },
      { property: 'text-halo-color', role: 'labelHalo' },
      { property: 'icon-color', role: id.includes('rail') ? 'transit' : 'label' },
      { property: 'icon-halo-color', role: 'labelHalo' },
    ];
  }
  if (layer.type === 'fill') {
    const role = fillRole(layer, id);
    return [
      { property: 'fill-color', role },
      { property: 'fill-outline-color', role },
    ];
  }
  if (layer.type !== 'line') return [];
  return [{ property: 'line-color', role: lineRole(layer, id) }];
}

export function applySemanticTokensToStyle<
  T extends { layers?: SemanticStyleLayer[]; metadata?: Record<string, unknown> },
>(style: T, tokens: MapStyleTokens): T {
  const result = structuredClone(style);
  result.metadata = {
    ...result.metadata,
    'print-map-studio:semantic-tokens': tokens,
  };
  const layers = result.layers ?? [];
  for (const layer of layers) {
    const assignments = assignmentsForLayer(layer);
    for (const { property, role } of assignments) {
      if (Object.hasOwn(layer.paint ?? {}, property)) layer.paint![property] = tokens[role];
    }
  }
  return result;
}

function semanticMapAssignments(map: MapLibreMap) {
  const layers = (map.getStyle().layers ?? []) as unknown as SemanticStyleLayer[];
  return layers.flatMap((layer) => {
    const layerId = layer.id;
    if (!layerId) return [];
    return assignmentsForLayer(layer)
      .filter(({ property }) => Object.hasOwn(layer.paint ?? {}, property))
      .map(({ property, role }) => ({ layerId, property, role }));
  });
}

export function createSemanticMapStyleController(map: MapLibreMap) {
  const assignments = semanticMapAssignments(map);
  return {
    apply: (tokens: MapStyleTokens) => {
      for (const assignment of assignments) {
        map.setPaintProperty(
          assignment.layerId,
          assignment.property as Parameters<MapLibreMap['setPaintProperty']>[1],
          tokens[assignment.role],
        );
      }
    }
  };
}

export function applySemanticTokensToMap(map: MapLibreMap, tokens: MapStyleTokens): void {
  createSemanticMapStyleController(map).apply(tokens);
}
