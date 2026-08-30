import type { ContentLayer } from '../domain/project';

export type ResolvedPrintLayerStyle = Readonly<{
  fill: string;
  stroke: string;
  strokeWidthMm: number;
  pointRadiusMm: number;
}>;

type Fail = (message: string) => never;

const SAFE_PAINT = /^(?:none|[a-zA-Z]+|#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\([0-9.,%+\-\s]+\))$/;

function positive(value: number, label: string, fail: Fail): number {
  if (!Number.isFinite(value) || value <= 0) fail(`${label} must be a finite positive number.`);
  return value;
}

function strokeWidth(value: number, label: string, canBeZero: boolean, fail: Fail): number {
  if (!Number.isFinite(value) || value < 0 || (!canBeZero && value === 0)) {
    fail(`${label} must be ${canBeZero ? 'a finite non-negative' : 'a finite positive'} number.`);
  }
  return value;
}

export function resolvePrintLayerStyle(
  layer: ContentLayer,
  fail: Fail,
): ResolvedPrintLayerStyle {
  if (layer.type === 'basemap') fail('Basemap layers do not accept vector styles.');
  let style: ResolvedPrintLayerStyle;
  if (layer.type === 'route') {
    const appearance = layer.appearance?.kind === 'route'
      ? layer.appearance
      : { color: '#d9363e', width: 4 };
    style = {
      fill: 'none',
      stroke: appearance.color,
      strokeWidthMm: appearance.width * 0.3,
      pointRadiusMm: 2,
    };
  } else if (layer.type === 'poi') {
    const appearance = layer.appearance?.kind === 'poi'
      ? layer.appearance
      : { color: '#0d78b5', size: 14 };
    style = {
      fill: appearance.color,
      stroke: '#ffffff',
      strokeWidthMm: 0.4,
      pointRadiusMm: appearance.size / 7,
    };
  } else {
    const appearance = layer.appearance?.kind === 'shape'
      ? layer.appearance
      : { fillColor: '#d18b25', strokeColor: '#d18b25', strokeWidth: 2, invert: false };
    style = {
      fill: appearance.fillColor,
      stroke: appearance.strokeColor,
      strokeWidthMm: appearance.strokeWidth * 0.25,
      pointRadiusMm: 2,
    };
  }
  if (!SAFE_PAINT.test(style.fill) || !SAFE_PAINT.test(style.stroke)) {
    fail(`Layer "${layer.id}" contains an unsafe SVG paint value.`);
  }
  strokeWidth(style.strokeWidthMm, `Layer "${layer.id}" stroke width`, layer.type === 'route', fail);
  positive(style.pointRadiusMm, `Layer "${layer.id}" point radius`, fail);
  return style;
}
