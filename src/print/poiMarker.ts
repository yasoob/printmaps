import type { PoiAppearance } from '../domain/project';
import { POI_MARKER_SYMBOL_GLYPHS } from '../domain/poiMarkers';

export type PoiMarkerPoint = Readonly<{ x: number; y: number }>;
export type PoiMarkerStyle = Readonly<{
  fill: string;
  stroke: string;
  strokeWidthMm: number;
  pointRadiusMm: number;
}>;

type PoiMarkerOptions = Readonly<{
  appearance?: PoiAppearance;
  point: PoiMarkerPoint;
  style: PoiMarkerStyle;
}>;

function escapeXml(value: string): string {
  return value.replaceAll(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[character] ?? character);
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

export function serializePoiMarker({ appearance, point, style }: PoiMarkerOptions): string {
  const markerShape = appearance?.markerShape ?? 'circle';
  const radius = style.pointRadiusMm;
  const markerAttributes = `fill="${escapeXml(style.fill)}" stroke="${escapeXml(style.stroke)}" stroke-width="${formatNumber(style.strokeWidthMm)}"`;
  let marker: string;
  if (markerShape === 'square') {
    marker = `<rect x="${formatNumber(point.x - radius)}" y="${formatNumber(point.y - radius)}" width="${formatNumber(radius * 2)}" height="${formatNumber(radius * 2)}" ${markerAttributes}/>`;
  } else if (markerShape === 'diamond') {
    marker = `<path d="M ${formatNumber(point.x)} ${formatNumber(point.y - radius)} L ${formatNumber(point.x + radius)} ${formatNumber(point.y)} L ${formatNumber(point.x)} ${formatNumber(point.y + radius)} L ${formatNumber(point.x - radius)} ${formatNumber(point.y)} Z" ${markerAttributes}/>`;
  } else {
    marker = `<circle cx="${formatNumber(point.x)}" cy="${formatNumber(point.y)}" r="${formatNumber(radius)}" ${markerAttributes}/>`;
  }
  const symbol = appearance ? POI_MARKER_SYMBOL_GLYPHS[appearance.markerSymbol] : '';
  const symbolElement = symbol
    ? `<text data-poi-marker-symbol="${appearance?.markerSymbol}" x="${formatNumber(point.x)}" y="${formatNumber(point.y)}" fill="#ffffff" font-family="sans-serif" font-size="${formatNumber(Math.max(2.4, radius))}" font-weight="700" text-anchor="middle" dominant-baseline="middle">${escapeXml(symbol)}</text>`
    : '';
  const labelElement = appearance?.label
    ? `<text data-poi-label="true" x="${formatNumber(point.x)}" y="${formatNumber(point.y + radius + 4)}" fill="#1e1e1e" stroke="#ffffff" stroke-width="0.8" paint-order="stroke" font-family="sans-serif" font-size="3.5" text-anchor="middle">${escapeXml(appearance.label)}</text>`
    : '';
  return `<g data-poi-marker-shape="${markerShape}">${marker}${symbolElement}</g>${labelElement}`;
}
