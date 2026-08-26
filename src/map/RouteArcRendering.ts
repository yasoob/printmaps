import { createDefaultLayerAppearance, type ContentLayer } from '../domain/project';

export type RouteArcDatum = {
  id: string;
  layerId: string;
  source: [number, number];
  target: [number, number];
  color: [number, number, number, number];
  width: number;
};

type HighlightState = {
  selectedId: string | null;
  previewedId: string | null;
};

function rgba(hex: string, opacity: number): [number, number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
    Math.round(opacity * 2.55),
  ];
}

function arcDataForLayer(layer: ContentLayer, highlight: HighlightState): RouteArcDatum[] {
  if (!layer.visible || layer.type !== 'route' || layer.geometry?.type !== 'Arc') return [];
  const appearance = layer.appearance?.kind === 'route'
    ? layer.appearance
    : createDefaultLayerAppearance('route');
  if (appearance?.kind !== 'route') return [];
  const [source, target] = layer.geometry.anchors;
  const isHighlighted = layer.id === highlight.selectedId || layer.id === highlight.previewedId;
  return [{
    id: `${layer.id}:0`,
    layerId: layer.id,
    source: [...source],
    target: [...target],
    color: rgba(appearance.color, layer.opacity),
    width: appearance.width + (isHighlighted ? 2 : 0),
  }];
}

export function routeArcData(layers: readonly ContentLayer[], highlight: HighlightState): RouteArcDatum[] {
  return layers.flatMap((layer) => arcDataForLayer(layer, highlight));
}
