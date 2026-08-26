import type { ElevationProfile } from '../elevation/profile';
import {
  createElevationProfileLayout,
  createElevationProfileMarkers,
  elevationProfileMarkerLabelY,
  elevationProfileMarkerTextAnchor,
  formatElevationProfileNumber,
  formatElevationProfileSummary,
  resolveElevationProfileRenderOptions,
  type ElevationProfileRenderOptions,
} from './elevationProfile';
import { asciiBytes, buildPdf, pdfString, streamObject, type PdfObject } from './pdfWriter';

const PDF_WIDTH_MM = 150;
const PDF_HEIGHT_MM = 75;
const POINTS_PER_MM = 72 / 25.4;

function pdfRgb(color: string): string {
  const channels = [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)]
    .map((channel) => Number.parseInt(channel, 16) / 255);
  return channels.map((channel) => formatElevationProfileNumber(channel)).join(' ');
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

function pdfCircleCommands(x: number, y: number, radius: number): readonly string[] {
  const control = radius * 0.55228475;
  const format = formatElevationProfileNumber;
  return [
    `${format(x + radius)} ${format(y)} m`,
    `${format(x + radius)} ${format(y + control)} ${format(x + control)} ${format(y + radius)} ${format(x)} ${format(y + radius)} c`,
    `${format(x - control)} ${format(y + radius)} ${format(x - radius)} ${format(y + control)} ${format(x - radius)} ${format(y)} c`,
    `${format(x - radius)} ${format(y - control)} ${format(x - control)} ${format(y - radius)} ${format(x)} ${format(y - radius)} c`,
    `${format(x + control)} ${format(y - radius)} ${format(x + radius)} ${format(y - control)} ${format(x + radius)} ${format(y)} c f`,
  ];
}

function pdfBaseFont(fontFamily: ElevationProfileRenderOptions['fontFamily']): string {
  if (fontFamily === 'serif') return 'Times-Roman';
  if (fontFamily === 'mono') return 'Courier';
  return 'Helvetica';
}

export async function createElevationProfilePdf(
  profile: ElevationProfile,
  title: string,
  options: ElevationProfileRenderOptions = {},
): Promise<Blob> {
  const resolved = resolveElevationProfileRenderOptions(options);
  const pdfFont = pdfBaseFont(resolved.fontFamily);
  const pageWidth = resolved.printWidthMm * POINTS_PER_MM;
  const pageHeight = resolved.printWidthMm / 2 * POINTS_PER_MM;
  const width = PDF_WIDTH_MM * POINTS_PER_MM;
  const height = PDF_HEIGHT_MM * POINTS_PER_MM;
  const pageScale = resolved.printWidthMm / PDF_WIDTH_MM;
  const summary = formatElevationProfileSummary(profile, resolved.units);
  const layout = createElevationProfileLayout(profile, width, height, resolved);
  const markers = createElevationProfileMarkers(profile, layout, resolved.units);
  const pdfFontSize = resolved.fontSize * 0.3;
  const format = formatElevationProfileNumber;
  const pointCommands = layout.points.map((point, index) => (
    `${format(point.x)} ${format(height - point.y)} ${index === 0 ? 'm' : 'l'}`
  ));
  const verticalGridCommands = resolved.showVerticalGrid ? [
    '% grid vertical',
    ...layout.distanceTicks.flatMap((tick) => [
      `${format(tick.x)} ${format(height - layout.plot.top)} m`,
      `${format(tick.x)} ${format(height - layout.plot.top - layout.plot.height)} l S`,
    ]),
  ] : [];
  const horizontalGridCommands = resolved.showHorizontalGrid ? [
    '% grid horizontal',
    ...layout.elevationTicks.flatMap((tick) => [
      `${format(layout.plot.left)} ${format(height - tick.y)} m`,
      `${format(layout.plot.left + layout.plot.width)} ${format(height - tick.y)} l S`,
    ]),
  ] : [];
  const fillCommands = resolved.showFill ? [
    '% profile fill',
    `% profile fill color ${pdfRgb(resolved.fillColor)}`,
    ...(resolved.showGradient ? [
      'q',
      ...pointCommands,
      `${format(layout.plot.left + layout.plot.width)} ${format(height - layout.plot.top - layout.plot.height)} l`,
      `${format(layout.plot.left)} ${format(height - layout.plot.top - layout.plot.height)} l h W n`,
      '/Sh1 sh',
      'Q',
    ] : [
      `${pdfRgb(resolved.fillColor)} rg`,
      ...pointCommands,
      `${format(layout.plot.left + layout.plot.width)} ${format(height - layout.plot.top - layout.plot.height)} l`,
      `${format(layout.plot.left)} ${format(height - layout.plot.top - layout.plot.height)} l h f`,
    ]),
  ] : [];
  const markerCommands = resolved.showElevationMarkers ? [
    '% elevation markers',
    `${pdfRgb(resolved.markerColor)} rg`,
    ...markers.flatMap((marker) => {
      const markerY = height - marker.point.y;
      const textAnchor = elevationProfileMarkerTextAnchor({ pointX: marker.point.x, label: marker.label, fontSize: pdfFontSize, plot: layout.plot });
      const topDownLabelY = elevationProfileMarkerLabelY(marker.point.y, pdfFontSize, layout.plot.top, 7);
      const labelY = height - topDownLabelY;
      const estimatedLabelWidth = marker.label.length * pdfFontSize * 0.5;
      let unclampedLabelX = marker.point.x - estimatedLabelWidth / 2;
      if (textAnchor === 'start') unclampedLabelX = marker.point.x;
      else if (textAnchor === 'end') unclampedLabelX = marker.point.x - estimatedLabelWidth;
      const labelX = Math.min(
        Math.max(unclampedLabelX, layout.plot.left),
        layout.plot.left + layout.plot.width - estimatedLabelWidth,
      );
      return [
        ...pdfCircleCommands(marker.point.x, markerY, 3),
        `BT /F1 ${format(pdfFontSize)} Tf`,
        `${format(labelX)} ${format(labelY)} Td ${pdfContentText(marker.label)} Tj ET`,
      ];
    }),
  ] : [];
  const curveCommands = resolved.showCurve ? [
    `${pdfRgb(resolved.curveColor)} RG 2.5 w 1 J 1 j`,
    ...pointCommands,
    'S',
  ] : [];
  const content = asciiBytes([
    'q',
    `${format(pageScale)} 0 0 ${format(pageScale)} 0 0 cm`,
    '1 1 1 rg',
    `0 0 ${format(width)} ${format(height)} re f`,
    '0.898 0.898 0.898 RG 0.5 w',
    ...verticalGridCommands,
    ...horizontalGridCommands,
    ...fillCommands,
    ...curveCommands,
    ...markerCommands,
    '0.117647 0.117647 0.117647 rg',
    `BT /F1 ${format(pdfFontSize)} Tf`,
    `${format(layout.plot.left)} ${format(height - 20)} Td ${pdfContentText(title)} Tj ET`,
    `BT /F1 ${format(resolved.fontSize * 0.175)} Tf`,
    `${format(layout.plot.left)} 24 Td ${pdfContentText(`${summary.distance} | ascent ${summary.ascent} | descent ${summary.descent}`)} Tj ET`,
    `BT /F1 ${format(resolved.fontSize * 0.15)} Tf`,
    `${format(Math.max(layout.plot.left, layout.plot.left + layout.plot.width - profile.sourceLabel.length * resolved.fontSize * 0.15 * 0.5))} 7 Td ${pdfContentText(profile.sourceLabel)} Tj ET`,
    'Q',
  ].join('\n'));
  const objects: PdfObject[] = [
    ['<< /Type /Catalog /Pages 2 0 R >>'],
    ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${format(pageWidth)} ${format(pageHeight)}] /Resources << /Font << /F1 5 0 R >>${resolved.showGradient ? ' /Shading << /Sh1 7 0 R >>' : ''} >> /Contents 4 0 R >>`],
    streamObject('', content),
    [`<< /Type /Font /Subtype /Type1 /BaseFont /${pdfFont} /Encoding /WinAnsiEncoding >>`],
    [`<< /Title ${pdfString(`${title} elevation profile`)} /Creator (Print Map Studio) /Subject (Attributed route elevation profile.) >>`],
  ];
  if (resolved.showGradient) {
    objects.push([`<< /ShadingType 2 /ColorSpace /DeviceRGB /Coords [0 ${format(height - layout.plot.top)} 0 ${format(height - layout.plot.top - layout.plot.height)}] /Function << /FunctionType 2 /Domain [0 1] /C0 [${pdfRgb(resolved.fillColor)}] /C1 [${pdfRgb(resolved.gradientColor)}] /N 1 >> /Extend [true true] >>`]);
  }
  const bytes = buildPdf(objects, 6);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/pdf' });
}
