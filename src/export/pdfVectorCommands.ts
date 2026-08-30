import {
  deriveRenderedRoute,
  projectedRouteMarkerBearing,
  rebaseRenderedRouteMarker,
} from '../domain/renderedRoute';
import { rebasePathLongitudes } from '../domain/routeArcGeometry';
import { routePictogramPdfGeometry } from '../domain/routePictograms';
import type { ContentLayer } from '../domain/project';
import { POI_MARKER_SYMBOL_GLYPHS } from '../domain/poiMarkers';
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

function routeMarkerCommands(
  pictogram: NonNullable<Extract<ContentLayer['appearance'], { kind: 'route' }>['marker']>['pictogram'],
  color: string,
  point: FramePoint,
  bearing: number,
) {
  const radius = 4 * POINTS_PER_MM;
  const geometry = routePictogramPdfGeometry(pictogram, point, radius, bearing);
  const marker = [
    `% Route pictogram: ${pictogram}`,
    'q',
    `${colorComponents(color)} rg`,
  ].join('\n');
  const primitives = geometry.map((primitive, index) => {
    const pathCommands = primitive.type === 'circle'
      ? circleCommands(primitive.center, primitive.radius)
      : primitive.points.map((candidate, pointIndex) => (
          `${pointText(candidate)} ${pointIndex === 0 ? 'm' : 'l'}`
        )).join('\n') + (primitive.closed ? '\nh' : '');
    if (index === 0) return `${pathCommands}\nf`;
    const operator = primitive.fill ? 'f' : 'S';
    return `1 1 1 ${primitive.fill ? 'rg' : 'RG'}\n${formatNumber(primitive.strokeWidth)} w\n1 J\n1 j\n${pathCommands}\n${operator}`;
  }).join('\n');
  return `${marker}\n${primitives}\nQ`;
}

function routeCommands(layer: ContentLayer, context: ProjectionContext): string {
  const rendered = deriveRenderedRoute(layer);
  if (!rendered || layer.appearance?.kind !== 'route') {
    throw new Error(`Route layer "${layer.name}" has no printable line.`);
  }
  const lines = rendered.legs.map((leg) => {
    const width = leg.style.width * 0.3 * POINTS_PER_MM;
    const path = rebasePathLongitudes(leg.path, context.capture.referenceLongitude)
      .map((coordinate, index) => (
        `${pointText(project(coordinate, context))} ${index === 0 ? 'm' : 'l'}`
      )).join('\n');
    const dash = leg.style.strokeStyle === 'dashed'
      ? `[${formatNumber(width * 2)} ${formatNumber(width * 1.5)}] 0 d`
      : '[] 0 d';
    return `% Route leg: ${leg.index}\n${colorComponents(leg.style.color)} RG\n${formatNumber(width)} w\n${dash}\n1 J\n1 j\n${path}\nS`;
  });
  const pictogram = layer.appearance.marker?.pictogram;
  const markerAppearance = layer.appearance.marker;
  if (pictogram) {
    lines.push(...rendered.markers.map((rawMarker) => {
      const marker = rebaseRenderedRouteMarker(rawMarker, context.capture.referenceLongitude);
      return routeMarkerCommands(
        pictogram,
        marker.style.color,
        project(marker.position, context),
        projectedRouteMarkerBearing(marker, markerAppearance!, (position) => project(position, context), 'up'),
      );
    }));
  }
  return lines.join('\n');
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

function routeLayerCommands(layer: ContentLayer, context: ProjectionContext) {
  const geometry = layer.geometry;
  if (geometry?.type !== 'Arc' && geometry?.type !== 'LineString') return;
  return routeCommands(layer, context);
}

function poiLayerCommands(layer: ContentLayer, context: ProjectionContext) {
  if (layer.geometry?.type === 'Point') return poiCommands(layer, layer.geometry.coordinates, context);
}

function shapeLayerCommands(layer: ContentLayer, context: ProjectionContext) {
  if (layer.geometry?.type !== 'Polygon' && layer.geometry?.type !== 'MultiPolygon') return;
  const rings = layer.geometry.type === 'Polygon'
    ? layer.geometry.coordinates
    : layer.geometry.coordinates.flat();
  return shapeCommands(layer, rings, context);
}

function commandsForLayer(layer: ContentLayer, context: ProjectionContext) {
  if (layer.type === 'route') return routeLayerCommands(layer, context);
  if (layer.type === 'poi') return poiLayerCommands(layer, context);
  return shapeLayerCommands(layer, context);
}

export function pdfVectorCommands(
  layer: ContentLayer,
  capture: ProjectedCapture,
  width: number,
  height: number,
): string {
  if (layer.type === 'basemap' || !layer.geometry) return '';
  const context = { capture, width, height };
  const commands = commandsForLayer(layer, context);
  if (commands !== undefined) return commands;
  throw new Error(`Layer "${layer.name}" has geometry that cannot be represented in the PDF.`);
}
