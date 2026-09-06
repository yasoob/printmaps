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

type NumericField = 'routeWidth' | 'poiSize' | 'shapeOutlineWidth';
export type ImportNumberValidation = { ok: true; value: number } | { ok: false; error: string };
export type MapDataBatchValidation = {
  fields: Record<NumericField, ImportNumberValidation>;
  error: string | null;
};

export class MapDataBatchAppearanceError extends Error {}

function validateNumber(value: string, label: string, minimum: number, maximum = Infinity): ImportNumberValidation {
  const range = maximum === Infinity ? `${minimum} px or greater` : `${minimum}–${maximum} px`;
  if (value.trim() === '') return { ok: false, error: `${label} is required. Enter ${range}.` };
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? { ok: true, value: number }
    : { ok: false, error: `${label} must be a finite number: ${range}.` };
}

function numberForLayer(layer: ContentLayer, fields: MapDataBatchValidation['fields']) {
  switch (layer.type) {
    case 'route': { return fields.routeWidth; }
    case 'poi': { return fields.poiSize; }
    case 'shape': { return fields.shapeOutlineWidth; }
    default: { return null; }
  }
}

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
  number: number,
) {
  const current = layer.appearance ?? createDefaultLayerAppearance(layer.type);
  if (!current) return;
  let candidate;
  if (current.kind === 'route') {
    candidate = { ...current, color: settings.route.color, width: number };
  } else if (current.kind === 'poi') {
    candidate = {
      ...current,
      color: settings.poi.color,
      size: number,
      markerShape: settings.poi.markerShape,
    };
  } else {
    candidate = {
      ...current,
      fillColor: settings.shape.fillColor,
      strokeColor: settings.shape.strokeColor,
      strokeWidth: number,
    };
  }
  return canonicalLayerAppearance(layer.type, candidate);
}

export function validateMapDataBatchAppearance(
  layers: readonly ContentLayer[],
  settings: MapDataBatchAppearance,
): MapDataBatchValidation {
  const fields = {
    routeWidth: validateNumber(settings.route.width, 'Route width', 0),
    poiSize: validateNumber(settings.poi.size, 'POI size', 8, 48),
    shapeOutlineWidth: validateNumber(settings.shape.strokeWidth, 'Shape outline width', 0.5, 12),
  };
  for (const layer of layers) {
    const number = numberForLayer(layer, fields);
    if (!number) continue;
    if (!number.ok) return { fields, error: number.error };
    if (!styledAppearance(layer, settings, number.value)) {
      return { fields, error: 'Choose valid import styling values before adding this batch.' };
    }
  }
  return { fields, error: null };
}

export function applyMapDataBatchAppearance(
  layers: readonly ContentLayer[],
  settings: MapDataBatchAppearance,
): ContentLayer[] {
  const validation = validateMapDataBatchAppearance(layers, settings);
  if (validation.error) throw new MapDataBatchAppearanceError(validation.error);
  return layers.map((layer) => {
    const number = numberForLayer(layer, validation.fields);
    const appearance = number?.ok ? styledAppearance(layer, settings, number.value) : undefined;
    return { ...cloneContentLayer(layer), ...(appearance && { appearance }) };
  });
}

export function isMapDataBatchAppearanceValid(
  layers: readonly ContentLayer[],
  settings: MapDataBatchAppearance,
): boolean {
  return validateMapDataBatchAppearance(layers, settings).error === null;
}
