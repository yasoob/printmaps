import {
  canonicalLayerAppearance,
  createDefaultLayerAppearance,
  type PoiAppearance,
  type RouteAppearance,
  type ShapeAppearance,
} from '../domain/layerAppearance';
import { cloneContentLayer, type ContentLayer } from '../domain/project';
import type { PoiMarkerShape } from '../domain/poiMarkers';

export type MapDataBatchAppearance = {
  route: { color: string; width: string };
  poi: { color: string; size: string; markerShape: PoiMarkerShape };
  shape: { fillColor: string; strokeColor: string; strokeWidth: string };
};

function appearanceFor<T extends RouteAppearance | PoiAppearance | ShapeAppearance>(
  layers: readonly ContentLayer[],
  kind: T['kind'],
): T {
  const appearance = layers.find((layer) => layer.appearance?.kind === kind)?.appearance;
  return (appearance?.kind === kind ? appearance : createDefaultLayerAppearance(kind)) as T;
}

export function createMapDataBatchAppearance(
  layers: readonly ContentLayer[],
): MapDataBatchAppearance {
  const route = appearanceFor<RouteAppearance>(layers, 'route');
  const poi = appearanceFor<PoiAppearance>(layers, 'poi');
  const shape = appearanceFor<ShapeAppearance>(layers, 'shape');
  return {
    route: { color: route.color, width: String(route.width) },
    poi: { color: poi.color, size: String(poi.size), markerShape: poi.markerShape },
    shape: {
      fillColor: shape.fillColor,
      strokeColor: shape.strokeColor,
      strokeWidth: String(shape.strokeWidth),
    },
  };
}

function styledAppearance(
  layer: ContentLayer,
  settings: MapDataBatchAppearance,
) {
  const current = layer.appearance ?? createDefaultLayerAppearance(layer.type);
  if (!current) return;
  let candidate;
  if (current.kind === 'route') {
    candidate = { ...current, color: settings.route.color, width: Number(settings.route.width) };
  } else if (current.kind === 'poi') {
    candidate = {
      ...current,
      color: settings.poi.color,
      size: Number(settings.poi.size),
      markerShape: settings.poi.markerShape,
    };
  } else {
    candidate = {
      ...current,
      fillColor: settings.shape.fillColor,
      strokeColor: settings.shape.strokeColor,
      strokeWidth: Number(settings.shape.strokeWidth),
    };
  }
  return canonicalLayerAppearance(layer.type, candidate);
}

export function applyMapDataBatchAppearance(
  layers: readonly ContentLayer[],
  settings: MapDataBatchAppearance,
): ContentLayer[] {
  return layers.map((layer) => {
    const appearance = styledAppearance(layer, settings);
    if (!appearance && layer.type !== 'basemap') {
      throw new Error('Choose valid import styling values before adding this batch.');
    }
    return { ...cloneContentLayer(layer), ...(appearance && { appearance }) };
  });
}

export function isMapDataBatchAppearanceValid(
  layers: readonly ContentLayer[],
  settings: MapDataBatchAppearance,
): boolean {
  return layers.every((layer) => (
    layer.type === 'basemap' || Boolean(styledAppearance(layer, settings))
  ));
}
