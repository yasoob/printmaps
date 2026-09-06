import type { ElevationProfile } from '../elevation/profile';
import {
  elevationProfileFontStack, formatElevationProfileNumber as number, formatElevationProfileSummary,
  resolveElevationProfileRenderOptions, type ElevationChartPoint, type ElevationProfileRenderOptions,
} from './elevationProfileLayout';
import { createElevationProfileScene, type ElevationProfileScene } from './elevationProfileScene';
import { profileTextWeight, type ProfileText } from './elevationProfileText';
import { embedPngPhysicalResolution } from './pngPhysicalResolution';
import { rasterizeElevationProfile } from './rasterizeElevationProfile';

export * from './elevationProfileLayout';
export { createElevationProfileScene } from './elevationProfileScene';

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function svgPath(points: readonly ElevationChartPoint[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${number(point.x)} ${number(point.y)}`).join(' ');
}

function serializeText(text: ProfileText, scene: ElevationProfileScene): string {
  const isMarker = text.role === 'marker';
  const color = isMarker ? scene.options.markerColor : '#333333';
  const marker = isMarker ? ' class="elevation-marker-label" paint-order="stroke" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"' : '';
  return `<text data-profile-text="${text.role}" x="${number(text.x)}" y="${number(text.y)}" font-family="${elevationProfileFontStack(scene.options.fontFamily)}" font-size="${number(text.fontSize)}" font-weight="${profileTextWeight(text.role)}" fill="${color}" text-anchor="${text.anchor ?? 'start'}" xml:space="preserve"${marker}>${escapeXml(text.text)}</text>`;
}

function serializeGrid(scene: ElevationProfileScene): string {
  const { layout, options } = scene;
  const { plot } = layout;
  const vertical = options.showVerticalGrid ? `<g class="elevation-grid-vertical" data-grid-axis="vertical">${layout.distanceTicks.map((tick) => `<line x1="${number(tick.x)}" y1="${number(plot.top)}" x2="${number(tick.x)}" y2="${number(plot.top + plot.height)}"/>`).join('')}</g>` : '';
  const horizontal = options.showHorizontalGrid ? `<g class="elevation-grid-horizontal" data-grid-axis="horizontal">${layout.elevationTicks.map((tick) => `<line x1="${number(plot.left)}" y1="${number(tick.y)}" x2="${number(plot.left + plot.width)}" y2="${number(tick.y)}"/>`).join('')}</g>` : '';
  return `<g stroke="#e5e5e5" stroke-width="1">${vertical}${horizontal}</g>`;
}

function serializePlot(scene: ElevationProfileScene, id: string): string {
  const { layout, options } = scene;
  const { plot } = layout;
  const line = svgPath(layout.points);
  const area = `${line} L ${number(plot.left + plot.width)} ${number(plot.top + plot.height)} L ${number(plot.left)} ${number(plot.top + plot.height)} Z`;
  const gradient = options.showGradient ? `<defs><linearGradient id="${id}-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${options.fillColor}"/><stop offset="1" stop-color="${options.gradientColor}"/></linearGradient></defs>` : '';
  const fill = options.showFill ? `${gradient}<path class="elevation-area" data-profile-fill="true" d="${area}" fill="${options.showGradient ? `url(#${id}-gradient)` : options.fillColor}"/>` : '';
  const curve = options.showCurve ? `<path class="elevation-line" d="${line}" fill="none" stroke="${options.curveColor}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>` : '';
  const markers = options.showElevationMarkers ? `<g class="elevation-markers" data-elevation-markers="true" fill="${options.markerColor}">${scene.markers.map((marker) => `<circle cx="${number(marker.point.x)}" cy="${number(marker.point.y)}" r="8" stroke="#ffffff" stroke-width="3"/>`).join('')}${scene.texts.filter((text) => text.role === 'marker').map((text) => serializeText(text, scene)).join('')}</g>` : '';
  return `${fill}${curve}${markers}`;
}

export function serializeElevationProfileSvg(profile: ElevationProfile, title: string, options: ElevationProfileRenderOptions = {}, id = 'elevation-profile'): string {
  if (!/^[a-zA-Z][\w-]*$/.test(id)) throw new Error('The elevation profile identifier is invalid.');
  const scene = createElevationProfileScene(profile, title, options);
  const { layout, options: resolved } = scene;
  const summary = formatElevationProfileSummary(profile, resolved.units);
  const description = `${summary.distance} route with an elevation range of ${summary.elevationRange}. ${profile.sourceLabel}.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="elevation-chart" width="${resolved.printWidthMm}mm" height="${resolved.printWidthMm / 2}mm" viewBox="0 0 ${layout.width} ${layout.height}" data-elevation-profile="true" data-print-width-mm="${resolved.printWidthMm}" font-family="${elevationProfileFontStack(resolved.fontFamily)}" role="img" aria-labelledby="${id}-title" aria-describedby="${id}-description"><title id="${id}-title">${escapeXml(title)} elevation profile</title><desc id="${id}-description">${escapeXml(description)}</desc><rect width="${layout.width}" height="${layout.height}" fill="#ffffff"/>${serializeGrid(scene)}${serializePlot(scene, id)}${scene.texts.filter((text) => text.role !== 'marker').map((text) => serializeText(text, scene)).join('')}</svg>`;
}

type ElevationPngOptions = ElevationProfileRenderOptions & Readonly<{
  rasterize?: (svg: string, width: number, height: number) => Promise<Blob>;
}>;
export const ELEVATION_PROFILE_PIXELS_PER_MM = 12;

export async function createElevationProfilePng(profile: ElevationProfile, title: string, options: ElevationPngOptions = {}): Promise<Blob> {
  const resolved = resolveElevationProfileRenderOptions(options);
  const svg = serializeElevationProfileSvg(profile, title, options);
  const blob = await (options.rasterize ?? rasterizeElevationProfile)(
    svg, resolved.printWidthMm * ELEVATION_PROFILE_PIXELS_PER_MM,
    resolved.printWidthMm / 2 * ELEVATION_PROFILE_PIXELS_PER_MM,
  );
  return embedPngPhysicalResolution(blob, ELEVATION_PROFILE_PIXELS_PER_MM * 25.4);
}
