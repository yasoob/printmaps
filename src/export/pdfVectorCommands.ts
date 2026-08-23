import type { ContentLayer } from '../domain/project';
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

function routeCommands(
  layer: ContentLayer,
  coordinates: readonly (readonly [number, number])[],
  context: ProjectionContext,
): string {
  if (coordinates.length < 2) throw new Error(`Route layer "${layer.name}" has no printable line.`);
  const appearance = layer.appearance?.kind === 'route'
    ? layer.appearance
    : { color: '#d9363e', width: 4 };
  const path = coordinates.map((coordinate, index) => (
    `${pointText(project(coordinate, context))} ${index === 0 ? 'm' : 'l'}`
  )).join('\n');
  return `${colorComponents(appearance.color)} RG\n${formatNumber(appearance.width * 0.3 * POINTS_PER_MM)} w\n1 J\n1 j\n${path}\nS`;
}

function poiCommands(
  layer: ContentLayer,
  coordinate: readonly [number, number],
  context: ProjectionContext,
): string {
  const appearance = layer.appearance?.kind === 'poi'
    ? layer.appearance
    : { color: '#0d78b5', size: 14 };
  const point = project(coordinate, context);
  return `${colorComponents(appearance.color)} rg\n1 1 1 RG\n${formatNumber(0.4 * POINTS_PER_MM)} w\n${circleCommands(point, appearance.size / 7 * POINTS_PER_MM)}\nB`;
}

function shapeCommands(
  layer: ContentLayer,
  rings: readonly (readonly (readonly [number, number])[])[],
  context: ProjectionContext,
): string {
  if (rings.length === 0) throw new Error(`Shape layer "${layer.name}" has no printable polygon.`);
  const appearance = layer.appearance?.kind === 'shape'
    ? layer.appearance
    : { fillColor: '#d18b25', strokeColor: '#d18b25', strokeWidth: 2 };
  const path = rings.map((ring) => ring.map((coordinate, index) => (
    `${pointText(project(coordinate, context))} ${index === 0 ? 'm' : 'l'}`
  )).join('\n') + '\nh').join('\n');
  return `${colorComponents(appearance.fillColor)} rg\n${colorComponents(appearance.strokeColor)} RG\n${formatNumber(appearance.strokeWidth * 0.25 * POINTS_PER_MM)} w\n${path}\nB*`;
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
