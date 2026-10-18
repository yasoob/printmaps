import {
  Color, convertFunction, convertFilter, createExpression, expression, isFunction, isExpression, latest,
  type Feature, type LayerSpecification, type StylePropertySpecification, type StyleSpecification,
} from '@maplibre/maplibre-gl-style-spec';
import { vectorUnsupported, type VectorColor } from './scene';

type SupportedLayer = Extract<LayerSpecification, { type: 'background' | 'fill' | 'line' | 'circle' | 'symbol' }>;
const supported = {
  background: new Set(['background-color', 'background-opacity']),
  fill: new Set(['fill-color', 'fill-opacity', 'fill-outline-color', 'fill-antialias', 'fill-translate', 'fill-translate-anchor', 'fill-sort-key']),
  line: new Set(['line-color', 'line-opacity', 'line-width', 'line-dasharray', 'line-cap', 'line-join', 'line-miter-limit', 'line-round-limit', 'line-sort-key']),
  circle: new Set(['circle-color', 'circle-opacity', 'circle-radius', 'circle-stroke-color', 'circle-stroke-opacity', 'circle-stroke-width', 'circle-sort-key']),
  symbol: new Set([
    'text-field', 'text-size', 'text-color', 'text-opacity', 'text-halo-color', 'text-halo-width',
    'text-halo-blur', 'text-font', 'text-letter-spacing', 'text-max-width', 'text-line-height',
    'text-anchor', 'text-offset', 'text-padding', 'text-transform', 'text-rotate',
    'text-rotation-alignment', 'text-pitch-alignment', 'text-optional', 'text-allow-overlap',
    'text-ignore-placement', 'text-keep-upright', 'text-max-angle', 'text-justify',
    'symbol-placement', 'symbol-spacing', 'symbol-sort-key', 'symbol-z-order',
    'icon-image', 'icon-size', 'icon-padding', 'icon-rotate', 'icon-opacity', 'icon-color',
    'icon-halo-color', 'icon-halo-width', 'icon-halo-blur', 'icon-rotation-alignment',
    'icon-allow-overlap', 'icon-optional', 'icon-ignore-placement',
  ]),
};
const forbiddenExpressions = new Set([
  'feature-state', 'global-state', 'line-progress', 'heatmap-density', 'within', 'distance',
  'raster-value', 'elevation', 'accumulated',
]);

function checkExpression(value: unknown, label: string): void {
  if (!Array.isArray(value)) return;
  if (value[0] === 'literal') return;
  if (forbiddenExpressions.has(value[0])) vectorUnsupported(`${label} uses ${value[0]}, which cannot be captured independently.`);
  for (const part of value) checkExpression(part, label);
}

function validateProperties(layer: SupportedLayer): void {
  for (const [key, value] of [...Object.entries(layer.paint ?? {}), ...Object.entries(layer.layout ?? {})]) {
    if (key === 'visibility' && value === 'visible') continue;
    if (value === 0 && ['line-gap-width', 'line-offset', 'line-blur', 'circle-blur'].includes(key)) continue;
    if (key.endsWith('-transition')) vectorUnsupported(`Layer "${layer.id}" has animated paint transitions.`);
    if (!supported[layer.type].has(key)) vectorUnsupported(`Layer "${layer.id}" uses unsupported "${key}".`);
    checkExpression(value, `"${layer.id}/${key}"`);
  }
  if ('filter' in layer) checkExpression(layer.filter, `"${layer.id}" filter`);
}

function isActiveVectorLayer(layer: StyleSpecification['layers'][number], zoom: number) {
  return !layer.id.startsWith('studio-') && layer.layout?.visibility !== 'none'
    && zoom >= (layer.minzoom ?? 0) && zoom < (layer.maxzoom ?? 24);
}

export function activeVectorLayers(style: StyleSpecification, zoom: number): SupportedLayer[] {
  return style.layers.flatMap((layer) => {
    if (!isActiveVectorLayer(layer, zoom)) return [];
    if (layer.type !== 'background' && layer.type !== 'fill' && layer.type !== 'line' && layer.type !== 'circle' && layer.type !== 'symbol') {
      vectorUnsupported(`Layer "${layer.id}" uses ${layer.type}. Use a flat vector style without raster, relief, or 3D layers.`);
    }
    validateProperties(layer);
    return [layer];
  });
}

function compileValue(value: unknown, label: string, specification: StylePropertySpecification) {
  const compiled = createExpression(value, label, specification);
  if (compiled.result === 'error') {
    vectorUnsupported(`${label}: ${compiled.value.map((error) => error.message).join('; ')}`);
  }
  return compiled.value;
}

function propertyValue(layer: SupportedLayer, name: string, fallback?: unknown) {
  const isLayout = Object.hasOwn(latest[`layout_${layer.type}`], name);
  const properties = isLayout ? layer.layout : layer.paint;
  const specifications = latest[`${isLayout ? 'layout' : 'paint'}_${layer.type}`];
  const specification = (specifications as Record<string, StylePropertySpecification>)[name];
  if (!specification) throw new Error(`Unknown vector style property ${name}.`);
  const raw = (properties as Record<string, unknown> | undefined)?.[name] ?? fallback ?? specification.default;
  if (isFunction(raw)) return { value: convertFunction(raw, specification), specification };
  return { value: Array.isArray(raw) && !isExpression(raw) ? ['literal', raw] : raw, specification };
}

function compileFilter(layer: SupportedLayer) {
  const filter = 'filter' in layer ? layer.filter : undefined;
  const value = filter === undefined ? true : (expression.isExpressionFilter(filter) ? filter : convertFilter(filter));
  return compileValue(value, `${layer.id}/filter`, {
    type: 'boolean', default: false, transition: false, 'property-type': 'data-driven',
    expression: { interpolated: false, parameters: ['zoom', 'feature'] },
  });
}

export function compileVectorLayer(layer: SupportedLayer, zoom: number) {
  const expressions = new Map<string, ReturnType<typeof compileValue>>();
  const filter = compileFilter(layer);
  const read = (name: string, feature?: Feature, fallback?: unknown): unknown => {
    const { value, specification } = propertyValue(layer, name, fallback);
    if (value === undefined) return undefined;
    let expression = expressions.get(name);
    if (!expression) {
      expression = compileValue(value, `${layer.id}/${name}`, specification);
      expressions.set(name, expression);
    }
    try {
      return expression.evaluateWithoutErrorHandling({ zoom }, feature);
    } catch (error) {
      vectorUnsupported(`Layer "${layer.id}", ${name}: ${error instanceof Error ? error.message : 'invalid expression result'}.`);
    }
  };
  return {
    layer,
    matches: (feature: Feature) => filter.evaluateWithoutErrorHandling({ zoom }, feature) === true,
    read,
    number: (name: string, feature?: Feature, fallback?: number): number => {
      const value = read(name, feature, fallback);
      if (typeof value !== 'number' || !Number.isFinite(value)) vectorUnsupported(`"${layer.id}/${name}" must evaluate to a finite number.`);
      return value;
    },
    color: (name: string, feature?: Feature, opacity = 1): VectorColor => {
      const value = read(name, feature);
      if (!(value instanceof Color) || opacity < 0 || opacity > 1) vectorUnsupported(`"${layer.id}/${name}" has an invalid color or opacity.`);
      const [r, g, b, a] = value.rgb;
      return [r, g, b, a * opacity];
    },
  };
}

export type CompiledVectorLayer = ReturnType<typeof compileVectorLayer>;
