import type { PoiAppearance } from '../domain/project';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';
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
  assets: Record<string, CustomMarkerAsset>;
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

function customMarkerImage(asset: CustomMarkerAsset, point: PoiMarkerPoint, radius: number): string {
  const scale = radius * 2 / Math.max(asset.width, asset.height);
  const width = asset.width * scale;
  const height = asset.height * scale;
  return `<image data-poi-custom-marker="${escapeXml(asset.id)}" href="${escapeXml(asset.dataUri)}" x="${formatNumber(point.x - width / 2)}" y="${formatNumber(point.y - height / 2)}" width="${formatNumber(width)}" height="${formatNumber(height)}" preserveAspectRatio="xMidYMid meet"/>`;
}

function standardMarker(shape: PoiAppearance['markerShape'], point: PoiMarkerPoint, radius: number, attributes: string): string {
  if (shape === 'square') {
    return `<rect x="${formatNumber(point.x - radius)}" y="${formatNumber(point.y - radius)}" width="${formatNumber(radius * 2)}" height="${formatNumber(radius * 2)}" ${attributes}/>`;
  }
  if (shape === 'diamond') {
    return `<path d="M ${formatNumber(point.x)} ${formatNumber(point.y - radius)} L ${formatNumber(point.x + radius)} ${formatNumber(point.y)} L ${formatNumber(point.x)} ${formatNumber(point.y + radius)} L ${formatNumber(point.x - radius)} ${formatNumber(point.y)} Z" ${attributes}/>`;
  }
  return `<circle cx="${formatNumber(point.x)}" cy="${formatNumber(point.y)}" r="${formatNumber(radius)}" ${attributes}/>`;
}

function poiLabel(appearance: PoiAppearance | undefined, point: PoiMarkerPoint, radius: number): string {
  if (!appearance?.label) return '';
  return `<text data-poi-label="true" x="${formatNumber(point.x)}" y="${formatNumber(point.y + radius + 4)}" fill="#1e1e1e" stroke="#ffffff" stroke-width="0.8" paint-order="stroke" font-family="sans-serif" font-size="3.5" text-anchor="middle">${escapeXml(appearance.label)}</text>`;
}

function resolveCustomAsset(appearance: PoiAppearance | undefined, assets: Record<string, CustomMarkerAsset>): CustomMarkerAsset | undefined {
  const assetId = appearance?.customAssetId;
  if (!assetId) return;
  const asset = assets[assetId];
  if (!asset) throw new Error('The POI references a missing custom marker asset.');
  return asset;
}

export function serializePoiMarker({ appearance, assets, point, style }: PoiMarkerOptions): string {
  const customAsset = resolveCustomAsset(appearance, assets);
  const markerShape = appearance?.markerShape ?? 'circle';
  const radius = style.pointRadiusMm;
  const markerAttributes = `fill="${escapeXml(style.fill)}" stroke="${escapeXml(style.stroke)}" stroke-width="${formatNumber(style.strokeWidthMm)}"`;
  const marker = customAsset
    ? customMarkerImage(customAsset, point, radius)
    : standardMarker(markerShape, point, radius, markerAttributes);
  const symbol = appearance && !customAsset ? POI_MARKER_SYMBOL_GLYPHS[appearance.markerSymbol] : '';
  const symbolElement = symbol
    ? `<text data-poi-marker-symbol="${appearance?.markerSymbol}" x="${formatNumber(point.x)}" y="${formatNumber(point.y)}" fill="#ffffff" font-family="sans-serif" font-size="${formatNumber(Math.max(2.4, radius))}" font-weight="700" text-anchor="middle" dominant-baseline="middle">${escapeXml(symbol)}</text>`
    : '';
  const labelElement = poiLabel(appearance, point, radius);
  const markerGroup = customAsset
    ? marker
    : `<g data-poi-marker-shape="${markerShape}">${marker}${symbolElement}</g>`;
  return `${markerGroup}${labelElement}`;
}
