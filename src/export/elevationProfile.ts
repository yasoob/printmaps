import type { ElevationProfile } from '../elevation/profile';
import { asciiBytes, buildPdf, pdfString, streamObject, type PdfObject } from './pdfWriter';

const SVG_WIDTH = 900;
const SVG_HEIGHT = 450;
const PDF_WIDTH_MM = 150;
const PDF_HEIGHT_MM = 75;
const POINTS_PER_MM = 72 / 25.4;
const MINIMUM_TERRAIN_ELEVATION_METERS = -12_000;
const MAXIMUM_TERRAIN_ELEVATION_METERS = 10_000;
const FEET_PER_METER = 3.280839895;
const MILES_PER_METER = 0.000621371192;

export type ElevationProfileUnits = 'metric' | 'imperial';

export type ElevationProfileSummary = Readonly<{
  distance: string;
  elevationRange: string;
  ascent: string;
  descent: string;
}>;

export type ElevationProfileRenderOptions = Readonly<{
  units?: ElevationProfileUnits;
  curveColor?: string;
  showFill?: boolean;
  showHorizontalGrid?: boolean;
  showVerticalGrid?: boolean;
}>;

type ResolvedElevationProfileRenderOptions = Readonly<{
  units: ElevationProfileUnits;
  curveColor: string;
  showFill: boolean;
  showHorizontalGrid: boolean;
  showVerticalGrid: boolean;
}>;

function resolveRenderOptions(options: ElevationProfileRenderOptions): ResolvedElevationProfileRenderOptions {
  const curveColor = options.curveColor ?? '#0d79c7';
  if (!/^#[\da-f]{6}$/i.test(curveColor)) {
    throw new Error('The elevation profile curve color must be a six-digit hexadecimal color.');
  }
  return {
    units: options.units ?? 'metric',
    curveColor: curveColor.toLowerCase(),
    showFill: options.showFill ?? true,
    showHorizontalGrid: options.showHorizontalGrid ?? true,
    showVerticalGrid: options.showVerticalGrid ?? true,
  };
}

function pdfRgb(color: string): string {
  const channels = [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)]
    .map((channel) => Number.parseInt(channel, 16) / 255);
  return channels.map((channel) => formatNumber(channel)).join(' ');
}

export function formatElevationProfileSummary(
  profile: ElevationProfile,
  units: ElevationProfileUnits,
): ElevationProfileSummary {
  if (units === 'imperial') {
    return {
      distance: `${(profile.totalDistanceMeters * MILES_PER_METER).toFixed(1)} mi`,
      elevationRange: `${Math.round(profile.minimumElevationMeters * FEET_PER_METER)}–${Math.round(profile.maximumElevationMeters * FEET_PER_METER)} ft`,
      ascent: `${Math.round(profile.totalAscentMeters * FEET_PER_METER)} ft`,
      descent: `${Math.round(profile.totalDescentMeters * FEET_PER_METER)} ft`,
    };
  }
  return {
    distance: `${(profile.totalDistanceMeters / 1000).toFixed(1)} km`,
    elevationRange: `${Math.round(profile.minimumElevationMeters)}–${Math.round(profile.maximumElevationMeters)} m`,
    ascent: `${Math.round(profile.totalAscentMeters)} m`,
    descent: `${Math.round(profile.totalDescentMeters)} m`,
  };
}

export type ElevationChartPoint = Readonly<{ x: number; y: number }>;
export type ElevationProfileLayout = Readonly<{
  width: number;
  height: number;
  plot: Readonly<{ left: number; top: number; width: number; height: number }>;
  points: readonly ElevationChartPoint[];
  distanceTicks: readonly Readonly<{ x: number; label: string }>[];
  elevationTicks: readonly Readonly<{ y: number; label: string }>[];
}>;

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function validateProfile(profile: ElevationProfile): void {
  const summaryValues = [
    profile.totalDistanceMeters,
    profile.minimumElevationMeters,
    profile.maximumElevationMeters,
    profile.totalAscentMeters,
    profile.totalDescentMeters,
  ];
  if (
    profile.samples.length < 2
    || summaryValues.some((value) => !Number.isFinite(value))
    || profile.totalDistanceMeters <= 0
    || profile.minimumElevationMeters < MINIMUM_TERRAIN_ELEVATION_METERS
    || profile.maximumElevationMeters > MAXIMUM_TERRAIN_ELEVATION_METERS
    || profile.minimumElevationMeters > profile.maximumElevationMeters
    || profile.totalAscentMeters < 0
    || profile.totalDescentMeters < 0
    || profile.samples.some((sample) => (
      !Number.isFinite(sample.distanceMeters)
      || !Number.isFinite(sample.elevationMeters)
      || sample.distanceMeters < 0
      || sample.distanceMeters > profile.totalDistanceMeters
      || sample.elevationMeters < MINIMUM_TERRAIN_ELEVATION_METERS
      || sample.elevationMeters > MAXIMUM_TERRAIN_ELEVATION_METERS
    ))
  ) {
    throw new Error('The elevation profile does not contain valid route measurements.');
  }
}

export function createElevationProfileLayout(
  profile: ElevationProfile,
  width = SVG_WIDTH,
  height = SVG_HEIGHT,
  options: ElevationProfileRenderOptions = {},
): ElevationProfileLayout {
  validateProfile(profile);
  const units = options.units ?? 'metric';
  const plot = {
    left: width * 0.09,
    top: height * 0.16,
    width: width * 0.85,
    height: height * 0.65,
  };
  const measuredRange = profile.maximumElevationMeters - profile.minimumElevationMeters;
  const padding = Math.max(10, measuredRange * 0.1);
  const minimum = profile.minimumElevationMeters - padding;
  const maximum = profile.maximumElevationMeters + padding;
  const range = maximum - minimum;
  const points = profile.samples.map((sample) => ({
    x: plot.left + sample.distanceMeters / profile.totalDistanceMeters * plot.width,
    y: plot.top + (maximum - sample.elevationMeters) / range * plot.height,
  }));
  if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error('The elevation profile does not contain valid route measurements.');
  }
  const distanceTicks = Array.from({ length: 5 }, (_, index) => ({
    x: plot.left + index / 4 * plot.width,
    label: units === 'imperial'
      ? `${(profile.totalDistanceMeters * MILES_PER_METER * index / 4).toFixed(1)} mi`
      : `${(profile.totalDistanceMeters / 1000 * index / 4).toFixed(1)} km`,
  }));
  const elevationTicks = Array.from({ length: 5 }, (_, index) => {
    const value = maximum - index / 4 * range;
    return {
      y: plot.top + index / 4 * plot.height,
      label: units === 'imperial'
        ? `${Math.round(value * FEET_PER_METER)} ft`
        : `${Math.round(value)} m`,
    };
  });
  return { width, height, plot, points, distanceTicks, elevationTicks };
}

function svgPath(points: readonly ElevationChartPoint[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${formatNumber(point.x)} ${formatNumber(point.y)}`).join(' ');
}

export function serializeElevationProfileSvg(
  profile: ElevationProfile,
  title: string,
  options: ElevationProfileRenderOptions = {},
): string {
  const resolved = resolveRenderOptions(options);
  const summary = formatElevationProfileSummary(profile, resolved.units);
  const layout = createElevationProfileLayout(profile, SVG_WIDTH, SVG_HEIGHT, resolved);
  const linePath = svgPath(layout.points);
  const areaPath = `${linePath} L ${formatNumber(layout.plot.left + layout.plot.width)} ${formatNumber(layout.plot.top + layout.plot.height)} L ${formatNumber(layout.plot.left)} ${formatNumber(layout.plot.top + layout.plot.height)} Z`;
  const verticalGrid = resolved.showVerticalGrid ? `<g data-grid-axis="vertical">${layout.distanceTicks.map((tick) => `<line x1="${formatNumber(tick.x)}" y1="${formatNumber(layout.plot.top)}" x2="${formatNumber(tick.x)}" y2="${formatNumber(layout.plot.top + layout.plot.height)}" />`).join('')}</g>` : '';
  const horizontalGrid = resolved.showHorizontalGrid ? `<g data-grid-axis="horizontal">${layout.elevationTicks.map((tick) => `<line x1="${formatNumber(layout.plot.left)}" y1="${formatNumber(tick.y)}" x2="${formatNumber(layout.plot.left + layout.plot.width)}" y2="${formatNumber(tick.y)}" />`).join('')}</g>` : '';
  const fill = resolved.showFill ? `<path data-profile-fill="true" d="${areaPath}" fill="#dceeff"/>` : '';
  const distanceLabels = layout.distanceTicks.map((tick) => `<text x="${formatNumber(tick.x)}" y="${formatNumber(layout.plot.top + layout.plot.height + 30)}" text-anchor="middle">${escapeXml(tick.label)}</text>`).join('');
  const elevationLabels = layout.elevationTicks.map((tick) => `<text x="${formatNumber(layout.plot.left - 12)}" y="${formatNumber(tick.y + 4)}" text-anchor="end">${escapeXml(tick.label)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="150mm" height="75mm" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" data-elevation-profile="true" role="img" aria-labelledby="title description"><title id="title">${escapeXml(title)} elevation profile</title><desc id="description">${summary.distance} route with an elevation range of ${summary.elevationRange}. ${escapeXml(profile.sourceLabel)}.</desc><rect width="900" height="450" fill="#ffffff"/><text x="81" y="42" fill="#1e1e1e" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="600">${escapeXml(title)}</text><g stroke="#e5e5e5" stroke-width="1">${verticalGrid}${horizontalGrid}</g>${fill}<path d="${linePath}" fill="none" stroke="${resolved.curveColor}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><g fill="#666666" font-family="Inter,Arial,sans-serif" font-size="14">${distanceLabels}${elevationLabels}</g><g fill="#333333" font-family="Inter,Arial,sans-serif" font-size="15"><text x="81" y="405">${summary.distance} · ↑ ${summary.ascent} · ↓ ${summary.descent}</text><text x="819" y="405" text-anchor="end">${escapeXml(profile.sourceLabel)}</text></g></svg>`;
}

function pdfContentText(value: string): string {
  let escaped = '';
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (['\\', '(', ')'].includes(character)) escaped += `\\${character}`;
    else if (codePoint >= 32 && codePoint <= 126) escaped += character;
    else if (codePoint >= 160 && codePoint <= 255) escaped += `\\${codePoint.toString(8).padStart(3, '0')}`;
    else throw new Error('The elevation profile PDF cannot encode this route title. Use SVG or PNG for full Unicode text.');
  }
  return `(${escaped})`;
}

export async function createElevationProfilePdf(
  profile: ElevationProfile,
  title: string,
  options: ElevationProfileRenderOptions = {},
): Promise<Blob> {
  const resolved = resolveRenderOptions(options);
  const width = PDF_WIDTH_MM * POINTS_PER_MM;
  const height = PDF_HEIGHT_MM * POINTS_PER_MM;
  const summary = formatElevationProfileSummary(profile, resolved.units);
  const layout = createElevationProfileLayout(profile, width, height, resolved);
  const pointCommands = layout.points.map((point, index) => (
    `${formatNumber(point.x)} ${formatNumber(height - point.y)} ${index === 0 ? 'm' : 'l'}`
  ));
  const verticalGridCommands = resolved.showVerticalGrid ? [
    '% grid vertical',
    ...layout.distanceTicks.flatMap((tick) => [
      `${formatNumber(tick.x)} ${formatNumber(height - layout.plot.top)} m`,
      `${formatNumber(tick.x)} ${formatNumber(height - layout.plot.top - layout.plot.height)} l S`,
    ]),
  ] : [];
  const horizontalGridCommands = resolved.showHorizontalGrid ? [
    '% grid horizontal',
    ...layout.elevationTicks.flatMap((tick) => [
      `${formatNumber(layout.plot.left)} ${formatNumber(height - tick.y)} m`,
      `${formatNumber(layout.plot.left + layout.plot.width)} ${formatNumber(height - tick.y)} l S`,
    ]),
  ] : [];
  const fillCommands = resolved.showFill ? [
    '% profile fill',
    '0.862745 0.933333 1 rg',
    ...pointCommands,
    `${formatNumber(layout.plot.left + layout.plot.width)} ${formatNumber(height - layout.plot.top - layout.plot.height)} l`,
    `${formatNumber(layout.plot.left)} ${formatNumber(height - layout.plot.top - layout.plot.height)} l h f`,
  ] : [];
  const content = asciiBytes([
    '1 1 1 rg',
    `0 0 ${formatNumber(width)} ${formatNumber(height)} re f`,
    '0.898 0.898 0.898 RG 0.5 w',
    ...verticalGridCommands,
    ...horizontalGridCommands,
    ...fillCommands,
    `${pdfRgb(resolved.curveColor)} RG 2.5 w 1 J 1 j`,
    ...pointCommands,
    'S',
    '0.117647 0.117647 0.117647 rg',
    'BT /F1 12 Tf',
    `${formatNumber(layout.plot.left)} ${formatNumber(height - 20)} Td ${pdfContentText(title)} Tj ET`,
    'BT /F1 7 Tf',
    `${formatNumber(layout.plot.left)} 10 Td ${pdfContentText(`${summary.distance} | ascent ${summary.ascent} | descent ${summary.descent}`)} Tj ET`,
    'BT /F1 6 Tf',
    `${formatNumber(width - layout.plot.left - 135)} 10 Td ${pdfContentText(profile.sourceLabel)} Tj ET`,
  ].join('\n'));
  const objects: PdfObject[] = [
    ['<< /Type /Catalog /Pages 2 0 R >>'],
    ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formatNumber(width)} ${formatNumber(height)}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`],
    streamObject('', content),
    ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'],
    [`<< /Title ${pdfString(`${title} elevation profile`)} /Creator (Print Map Studio) /Subject (Attributed route elevation profile.) >>`],
  ];
  const bytes = buildPdf(objects, 6);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/pdf' });
}

type ElevationPngOptions = ElevationProfileRenderOptions & Readonly<{
  rasterize?: (svg: string) => Promise<Blob>;
}>;

async function rasterizeElevationSvg(svg: string): Promise<Blob> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => reject(new Error('The browser could not render the elevation profile.')), { once: true });
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const canvas = document.createElement('canvas');
  canvas.width = SVG_WIDTH * 2;
  canvas.height = SVG_HEIGHT * 2;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The browser could not allocate the elevation profile image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          if (blob?.type === 'image/png') resolve(blob);
          else reject(new Error('The browser could not encode the elevation profile PNG.'));
        }, 'image/png');
      } catch {
        reject(new Error('The browser could not encode the elevation profile PNG.'));
      }
    });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export function createElevationProfilePng(
  profile: ElevationProfile,
  title: string,
  options: ElevationPngOptions = {},
): Promise<Blob> {
  const svg = serializeElevationProfileSvg(profile, title, options);
  return (options.rasterize ?? rasterizeElevationSvg)(svg);
}
