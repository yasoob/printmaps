import type { ContentLayer } from '../domain/project';
import { POI_MARKER_SYMBOL_GLYPHS } from '../domain/poiMarkers';
import { ROUTE_TRAVEL_PROFILE_MARKERS } from '../domain/routeProfiles';
import type { PreviewPng } from './previewPng';

const POINTS_PER_MM = 72 / 25.4;
type FramePoint = Readonly<{ x: number; y: number }>;
type ProjectedCapture = PreviewPng & Required<Pick<PreviewPng, 'projectToFrame'>>;
type ProjectionContext = Readonly<{
  capture: ProjectedCapture;
  width: number;
  height: number;
}>;

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function colorComponents(hexadecimal: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hexadecimal)) {
    throw new Error('A layer contains an invalid color for PDF export.');
  }
  const channels = [1, 3, 5].map((offset) => (
    Number.parseInt(hexadecimal.slice(offset, offset + 2), 16) / 255
  ));
  return channels.map((channel) => formatNumber(channel)).join(' ');
}

function project(coordinate: readonly [number, number], context: ProjectionContext): FramePoint {
  const point = context.capture.projectToFrame(coordinate);
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error('The map projection returned an invalid point during PDF export.');
  }
  return { x: point.x * context.width, y: (1 - point.y) * context.height };
}

function pointText(point: FramePoint): string {
  return `${formatNumber(point.x)} ${formatNumber(point.y)}`;
}

function circleCommands(point: FramePoint, radius: number): string {
  const kappa = 0.552284749831;
  const control = radius * kappa;
  return [
    `${formatNumber(point.x + radius)} ${formatNumber(point.y)} m`,
    `${formatNumber(point.x + radius)} ${formatNumber(point.y + control)} ${formatNumber(point.x + control)} ${formatNumber(point.y + radius)} ${formatNumber(point.x)} ${formatNumber(point.y + radius)} c`,
    `${formatNumber(point.x - control)} ${formatNumber(point.y + radius)} ${formatNumber(point.x - radius)} ${formatNumber(point.y + control)} ${formatNumber(point.x - radius)} ${formatNumber(point.y)} c`,
    `${formatNumber(point.x - radius)} ${formatNumber(point.y - control)} ${formatNumber(point.x - control)} ${formatNumber(point.y - radius)} ${formatNumber(point.x)} ${formatNumber(point.y - radius)} c`,
    `${formatNumber(point.x + control)} ${formatNumber(point.y - radius)} ${formatNumber(point.x + radius)} ${formatNumber(point.y - control)} ${formatNumber(point.x + radius)} ${formatNumber(point.y)} c`,
  ].join('\n');
}

function pdfContentString(value: string, label = 'PDF text'): string {
  let escaped = '';
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (['\\', '(', ')'].includes(character)) {
      escaped += String.fromCodePoint(92) + character;
    } else if (codePoint >= 32 && codePoint <= 126) {
      escaped += character;
    } else if (codePoint >= 160 && codePoint <= 255) {
      escaped += `\\${codePoint.toString(8).padStart(3, '0')}`;
    } else {
      throw new Error(`${label} contains characters that the PDF font cannot encode.`);
    }
  }
  return `(${escaped})`;
}

function poiMarkerCommands(point: FramePoint, radius: number, shape: 'circle' | 'square' | 'diamond') {
  if (shape === 'circle') return circleCommands(point, radius);
  if (shape === 'square') {
    return [
      `${formatNumber(point.x - radius)} ${formatNumber(point.y - radius)} m`,
      `${formatNumber(point.x + radius)} ${formatNumber(point.y - radius)} l`,
      `${formatNumber(point.x + radius)} ${formatNumber(point.y + radius)} l`,
      `${formatNumber(point.x - radius)} ${formatNumber(point.y + radius)} l`,
      'h',
    ].join('\n');
  }
  return [
    `${formatNumber(point.x)} ${formatNumber(point.y + radius)} m`,
    `${formatNumber(point.x + radius)} ${formatNumber(point.y)} l`,
    `${formatNumber(point.x)} ${formatNumber(point.y - radius)} l`,
    `${formatNumber(point.x - radius)} ${formatNumber(point.y)} l`,
    'h',
  ].join('\n');
}

function routeCommands(
  layer: ContentLayer,
  coordinates: readonly (readonly [number, number])[],
  context: ProjectionContext,
): string {
  if (coordinates.length < 2) throw new Error(`Route layer "${layer.name}" has no printable line.`);
  const appearance = layer.appearance?.kind === 'route'
    ? layer.appearance
    : {
      color: '#d9363e',
      width: 4,
      travelProfile: 'car' as const,
      showTravelModeIcon: false,
    };
  const path = coordinates.map((coordinate, index) => (
    `${pointText(project(coordinate, context))} ${index === 0 ? 'm' : 'l'}`
  )).join('\n');
  const line = `${colorComponents(appearance.color)} RG\n${formatNumber(appearance.width * 0.3 * POINTS_PER_MM)} w\n1 J\n1 j\n${path}\nS`;
  if (!appearance.showTravelModeIcon) return line;
  const point = project(coordinates[Math.floor((coordinates.length - 1) / 2)], context);
  const label = ROUTE_TRAVEL_PROFILE_MARKERS[appearance.travelProfile];
  const radius = 4 * POINTS_PER_MM;
  const textX = point.x - label.length * 1.35;
  const textY = point.y - 1.8;
  const marker = [
    `% Route travel profile: ${appearance.travelProfile}`,
    'q',
    `${colorComponents(appearance.color)} rg`,
    '1 1 1 RG',
    `${formatNumber(0.6 * POINTS_PER_MM)} w`,
    circleCommands(point, radius),
    'B',
    '1 1 1 rg',
    'BT',
    '/F1 5 Tf',
    `${formatNumber(textX)} ${formatNumber(textY)} Td`,
    `(${label}) Tj`,
    'ET',
    'Q',
  ].join('\n');
  return `${line}\n${marker}`;
}

function poiCommands(
  layer: ContentLayer,
  coordinate: readonly [number, number],
  context: ProjectionContext,
): string {
  const appearance = layer.appearance?.kind === 'poi'
    ? layer.appearance
    : {
        color: '#0d78b5',
        size: 14,
        markerShape: 'circle' as const,
        markerSymbol: 'none' as const,
        label: '',
      };
  const point = project(coordinate, context);
  const radius = appearance.size / 7 * POINTS_PER_MM;
  const marker = [
    `% POI marker shape: ${appearance.markerShape}`,
    `${colorComponents(appearance.color)} rg`,
    '1 1 1 RG',
    `${formatNumber(0.4 * POINTS_PER_MM)} w`,
    poiMarkerCommands(point, radius, appearance.markerShape),
    'B',
  ];
  const symbol = POI_MARKER_SYMBOL_GLYPHS[appearance.markerSymbol];
  if (symbol) {
    marker.push(
      '1 1 1 rg',
      'BT',
      `/F1 ${formatNumber(Math.max(6, appearance.size / 2))} Tf`,
      `${formatNumber(point.x - symbol.length * 1.35)} ${formatNumber(point.y - 1.8)} Td`,
      `${pdfContentString(symbol)} Tj`,
      'ET',
    );
  }
  if (appearance.label) {
    marker.push(
      '0.117647 0.117647 0.117647 rg',
      'BT',
      '/F1 8 Tf',
      `${formatNumber(point.x - appearance.label.length * 2)} ${formatNumber(point.y - radius - 8)} Td`,
      `${pdfContentString(appearance.label, 'POI label')} Tj`,
      'ET',
    );
  }
  return marker.join('\n');
}

function shapeCommands(
  layer: ContentLayer,
  rings: readonly (readonly (readonly [number, number])[])[],
  context: ProjectionContext,
): string {
  if (rings.length === 0) throw new Error(`Shape layer "${layer.name}" has no printable polygon.`);
  const appearance = layer.appearance?.kind === 'shape'
    ? layer.appearance
    : { fillColor: '#d18b25', strokeColor: '#d18b25', strokeWidth: 2, invert: false };
  const path = rings.map((ring) => ring.map((coordinate, index) => (
    `${pointText(project(coordinate, context))} ${index === 0 ? 'm' : 'l'}`
  )).join('\n') + '\nh').join('\n');
  const paint = `${colorComponents(appearance.fillColor)} rg\n${colorComponents(appearance.strokeColor)} RG\n${formatNumber(appearance.strokeWidth * 0.25 * POINTS_PER_MM)} w`;
  if (!appearance.invert) return `${paint}\n${path}\nB*`;
  const pagePath = `0 0 m\n${formatNumber(context.width)} 0 l\n${formatNumber(context.width)} ${formatNumber(context.height)} l\n0 ${formatNumber(context.height)} l\nh`;
  return `${paint}\n% Inverted shape fill\n${pagePath}\n${path}\nf*\n% Shape boundary outline\n${path}\nS`;
}

export function pdfVectorCommands(
  layer: ContentLayer,
  capture: ProjectedCapture,
  width: number,
  height: number,
): string {
  if (layer.type === 'basemap' || !layer.geometry) return '';
  const context = { capture, width, height };
  if (layer.type === 'route' && layer.geometry.type === 'LineString') {
    return routeCommands(layer, layer.geometry.coordinates, context);
  }
  if (layer.type === 'poi' && layer.geometry.type === 'Point') {
    return poiCommands(layer, layer.geometry.coordinates, context);
  }
  if (layer.type === 'shape' && layer.geometry.type === 'Polygon') {
    return shapeCommands(layer, layer.geometry.coordinates, context);
  }
  throw new Error(`Layer "${layer.name}" has geometry that cannot be represented in the PDF.`);
}
