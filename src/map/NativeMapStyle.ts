import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';
import { mapLayerDescriptors } from './MapContentLayerRendering';

type MutableStyleLayer = {
  id?: string;
  type?: string;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
};

const LAYOUT_PIXEL_PROPERTIES = new Set([
  'icon-padding', 'icon-size', 'symbol-spacing', 'text-padding', 'text-size',
]);
const PAINT_PIXEL_PROPERTIES = new Set([
  'circle-radius', 'circle-stroke-width', 'icon-halo-blur', 'icon-halo-width',
  'line-gap-width', 'line-offset', 'line-width', 'text-halo-blur', 'text-halo-width',
]);

function scaledExpressionOutput(value: unknown, scale: number, property: string): unknown {
  if (typeof value === 'number' && Number.isFinite(value)) return value * scale;
  if (!Array.isArray(value)) {
    throw new TypeError(`Native map export cannot scale the ${property} style value safely.`);
  }
  const expression = structuredClone(value) as unknown[];
  if (expression[0] === 'interpolate') {
    for (let index = 4; index < expression.length; index += 2) {
      expression[index] = scaledExpressionOutput(expression[index], scale, property);
    }
    return expression;
  }
  if (expression[0] === 'step') {
    expression[2] = scaledExpressionOutput(expression[2], scale, property);
    for (let index = 4; index < expression.length; index += 2) {
      expression[index] = scaledExpressionOutput(expression[index], scale, property);
    }
    return expression;
  }
  throw new TypeError(`Native map export cannot scale the ${property} style expression safely.`);
}

export function scaleNativeMapStyle<T extends ReturnType<MapLibreMap['getStyle']>>(
  style: T,
  scale: number,
): T {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new TypeError('Native map export requires a finite positive print style scale.');
  }
  const scaled = structuredClone(style);
  const layers = scaled.layers ?? [];
  for (const layer of layers) {
    const mutable = layer as unknown as MutableStyleLayer;
    const layoutEntries = Object.entries(mutable.layout ?? {});
    for (const [property, value] of layoutEntries) {
      if (LAYOUT_PIXEL_PROPERTIES.has(property)) {
        mutable.layout![property] = scaledExpressionOutput(value, scale, property);
      }
    }
    const paintEntries = Object.entries(mutable.paint ?? {});
    for (const [property, value] of paintEntries) {
      if (PAINT_PIXEL_PROPERTIES.has(property)) {
        mutable.paint![property] = scaledExpressionOutput(value, scale, property);
      }
    }
  }
  return scaled;
}

function isStudioContentLayer(layer: MutableStyleLayer): boolean {
  return layer.id?.startsWith('studio-layer-') === true;
}

export function withoutBasemapSymbolLayers<T extends ReturnType<MapLibreMap['getStyle']>>(style: T): T {
  const filtered = structuredClone(style);
  const mutable = filtered as T & { layers?: MutableStyleLayer[] };
  if (mutable.layers) {
    mutable.layers = mutable.layers.filter((layer) => (
      layer.type !== 'symbol' || isStudioContentLayer(layer)
    ));
  }
  return filtered;
}

export function hasVisibleBasemapSymbolLayers(style: ReturnType<MapLibreMap['getStyle']>): boolean {
  const layers = style.layers ?? [];
  return layers.some((layer) => {
    const candidate = layer as unknown as MutableStyleLayer;
    return candidate.type === 'symbol'
      && !isStudioContentLayer(candidate)
      && candidate.layout?.visibility !== 'none';
  });
}

type PaintProperty = Parameters<MapLibreMap['setPaintProperty']>[1];
type PaintValue = Parameters<MapLibreMap['setPaintProperty']>[2];

function printPaintValue(
  layer: ContentLayer,
  property: string,
  value: unknown,
  pixelsPerMillimetre: number,
): unknown {
  if (typeof value !== 'number') return value;
  if (property === 'line-width') {
    return value * pixelsPerMillimetre * (layer.type === 'shape' ? 0.25 : 0.3);
  }
  if (property === 'circle-radius') return value * pixelsPerMillimetre * (2 / 7);
  if (property === 'circle-stroke-width') return value * pixelsPerMillimetre * 0.2;
  if (property === 'text-halo-width' && layer.appearance?.kind === 'route') {
    return value * pixelsPerMillimetre;
  }
  return value;
}

export function updatePrintLayerPaint(
  map: MapLibreMap,
  layer: ContentLayer,
  pixelsPerMillimetre: number,
): void {
  const descriptors = mapLayerDescriptors(layer, { selectedId: null, previewedId: null });
  for (const descriptor of descriptors) {
    const paintEntries = Object.entries(descriptor.paint);
    for (const [property, value] of paintEntries) {
      map.setPaintProperty(
        descriptor.id,
        property as PaintProperty,
        printPaintValue(layer, property, value, pixelsPerMillimetre) as PaintValue,
      );
    }
  }
}
