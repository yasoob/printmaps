import type { Feature } from '@maplibre/maplibre-gl-style-spec';
import type { CompiledVectorLayer } from './style';
import { vectorUnsupported, type VectorPath, type VectorPoint } from './scene';

export function vectorCircle(center: VectorPoint, radius: number): readonly VectorPoint[] {
  if (radius < 0 || radius > 256) vectorUnsupported('Circle radii must be between 0 and 256 pixels for bounded vector approximation.');
  // Circles are polygonized at sub-pixel tolerance, not rasterized.
  const requested = Math.ceil(Math.PI * Math.sqrt(Math.max(1, radius) / 0.02));
  const count = Math.max(16, Math.min(256, requested));
  return Array.from({ length: count }, (_, index) => ({
    x: center.x + radius * Math.cos(index / count * Math.PI * 2),
    y: center.y + radius * Math.sin(index / count * Math.PI * 2),
  }));
}

function fillPath(
  compiled: CompiledVectorLayer,
  feature: Feature,
  rings: readonly (readonly VectorPoint[])[],
  bearing: number,
): VectorPath {
  const { layer, color, number, read } = compiled;
    if (feature.type !== 3 && feature.type !== 'Polygon') vectorUnsupported(`Fill "${layer.id}" contains non-polygon geometry.`);
    const opacity = number('fill-opacity', feature);
    const translate = read('fill-translate', feature);
    if (!Array.isArray(translate) || translate.length !== 2 || translate.some((value) => typeof value !== 'number')) {
      vectorUnsupported(`"${layer.id}" has invalid fill translation.`);
    }
    if (translate.some((value) => value !== 0)) vectorUnsupported(`"${layer.id}" translates geometry across source tile boundaries.`);
    const angle = read('fill-translate-anchor', feature) === 'map' ? bearing * Math.PI / 180 : 0;
    const dx = translate[0] * Math.cos(angle) + translate[1] * Math.sin(angle);
    const dy = -translate[0] * Math.sin(angle) + translate[1] * Math.cos(angle);
    const antialias = read('fill-antialias', feature);
    const hasOutline = Object.hasOwn(layer.paint ?? {}, 'fill-outline-color') && antialias !== false;
    return {
      rings: rings.map((ring) => ring.map(({ x, y }) => ({ x: x + dx, y: y + dy }))), closed: true,
      fill: color('fill-color', feature, opacity),
      ...(hasOutline && { stroke: color('fill-outline-color', feature, opacity), width: 1 }),
    };
}

function validateLine(width: number, dash: unknown): void {
  if (width < 0 || (dash !== undefined && (!Array.isArray(dash) || dash.some((value) => typeof value !== 'number' || value < 0)))) {
    vectorUnsupported('A layer has an invalid line width or dash pattern.');
  }
}

function linePaths(compiled: CompiledVectorLayer, feature: Feature, rings: readonly (readonly VectorPoint[])[]): VectorPath[] {
    const { layer, color, number, read } = compiled;
    const width = number('line-width', feature);
    const dash = read('line-dasharray', feature);
    validateLine(width, dash);
    const cap = read('line-cap', feature), join = read('line-join', feature);
    if (cap !== 'butt' && cap !== 'round' && cap !== 'square') vectorUnsupported(`"${layer.id}" has an unsupported line cap.`);
    if (join !== 'miter' && join !== 'round' && join !== 'bevel') vectorUnsupported(`"${layer.id}" has an unsupported line join.`);
    if (width === 0) return [];
    return [{
      rings, closed: feature.type === 3 || feature.type === 'Polygon',
      stroke: color('line-color', feature, number('line-opacity', feature)), width, cap, join,
      miterLimit: number('line-miter-limit', feature),
      dash: Array.isArray(dash) ? dash.map((value: number) => value * width) : undefined,
    }];
}

function circlePaths(compiled: CompiledVectorLayer, feature: Feature, rings: readonly (readonly VectorPoint[])[]): VectorPath[] {
    const { layer, color, number } = compiled;
    if (feature.type !== 1 && feature.type !== 'Point') vectorUnsupported(`Circle "${layer.id}" contains non-point geometry.`);
    const radius = number('circle-radius', feature), width = number('circle-stroke-width', feature);
    if (radius < 0 || width < 0) vectorUnsupported(`"${layer.id}" has an invalid circle radius or stroke.`);
    return rings.flatMap((ring) => ring.map((center) => ({
      rings: [vectorCircle(center, radius)], closed: true,
      fill: color('circle-color', feature, number('circle-opacity', feature)),
      stroke: color('circle-stroke-color', feature, number('circle-stroke-opacity', feature)), width,
    })));
}

export function vectorFeaturePaths(compiled: CompiledVectorLayer, feature: Feature, rings: readonly (readonly VectorPoint[])[], bearing: number): VectorPath[] {
  switch (compiled.layer.type) {
    case 'fill': { return [fillPath(compiled, feature, rings, bearing)];
    }
    case 'line': { return linePaths(compiled, feature, rings);
    }
    case 'circle': { return circlePaths(compiled, feature, rings);
    }
    default: { throw new Error(`Cannot create geometry for ${compiled.layer.type}.`);
    }
  }
}
