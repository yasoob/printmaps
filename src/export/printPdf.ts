import type { ContentLayer, ProjectDocument } from '../domain/project';
import { asciiBytes, buildPdf, pdfString, streamObject, type PdfObject } from './pdfWriter';
import type { PreviewPng } from './previewPng';

const POINTS_PER_MM = 72 / 25.4;
const ATTRIBUTION = 'OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors';
type FramePoint = Readonly<{ x: number; y: number }>;

type PdfGroup = Readonly<{
  layer?: ContentLayer;
  name: string;
  resourceName: string;
}>;

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function opacityValue(layer: ContentLayer): string {
  if (!Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 100) {
    throw new Error(`Layer "${layer.name}" has an invalid opacity for PDF export.`);
  }
  return formatNumber(layer.opacity / 100);
}

function pdfContentString(value: string): string {
  let escaped = '';
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint === 0xA9) escaped += String.raw`\251`;
    else if (codePoint === 0xB7) escaped += String.raw`\267`;
    else if (['\\', '(', ')'].includes(character)) {
      escaped += String.fromCodePoint(92) + character;
    } else if (codePoint >= 32 && codePoint <= 126) escaped += character;
    else escaped += '?';
  }
  return `(${escaped})`;
}

function abortError(): DOMException {
  return new DOMException('PDF export was cancelled.', 'AbortError');
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw abortError();
}

function validateCapture(capture: PreviewPng): asserts capture is PreviewPng & Required<Pick<PreviewPng, 'projectToFrame'>> {
  if (
    !(capture.surface instanceof HTMLCanvasElement)
    || !Number.isSafeInteger(capture.width)
    || !Number.isSafeInteger(capture.height)
    || capture.width <= 0
    || capture.height <= 0
    || capture.surface.width !== capture.width
    || capture.surface.height !== capture.height
  ) {
    throw new Error('The browser preview is not a valid raster source for PDF export.');
  }
  if (!capture.projectToFrame) {
    throw new Error('The map projection is not ready for PDF export. Reload the map and try again.');
  }
}

function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 4
    && bytes[0] === 0xFF
    && bytes[1] === 0xD8
    && bytes.at(-2) === 0xFF
    && bytes.at(-1) === 0xD9;
}

function encodeJpeg(surface: HTMLCanvasElement, signal: AbortSignal | undefined): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      surface.toBlob((blob) => {
        if (signal?.aborted === true) {
          reject(abortError());
          return;
        }
        if (blob) resolve(blob);
        else reject(new Error('The browser could not encode the raster basemap for PDF export.'));
      }, 'image/jpeg', 0.92);
    } catch {
      reject(new Error('The browser could not encode the raster basemap for PDF export.'));
    }
  });
}

async function jpegBytes(capture: PreviewPng, signal: AbortSignal | undefined): Promise<Uint8Array> {
  throwIfCancelled(signal);
  let blob = capture.blob;
  if (blob.type !== 'image/jpeg') blob = await encodeJpeg(capture.surface, signal);
  throwIfCancelled(signal);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  throwIfCancelled(signal);
  if (!hasJpegSignature(bytes)) {
    throw new Error('The browser produced an invalid JPEG basemap for PDF export.');
  }
  return bytes;
}

function colorComponents(hexadecimal: string): string {
  const channels = [1, 3, 5].map((offset) => (
    Number.parseInt(hexadecimal.slice(offset, offset + 2), 16) / 255
  ));
  return channels.map((channel) => formatNumber(channel)).join(' ');
}

function project(
  coordinate: readonly [number, number],
  capture: PreviewPng & Required<Pick<PreviewPng, 'projectToFrame'>>,
  width: number,
  height: number,
): FramePoint {
  const point = capture.projectToFrame(coordinate);
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error('The map projection returned an invalid point during PDF export.');
  }
  return { x: point.x * width, y: (1 - point.y) * height };
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

function vectorCommands(
  layer: ContentLayer,
  capture: PreviewPng & Required<Pick<PreviewPng, 'projectToFrame'>>,
  width: number,
  height: number,
): string {
  if (layer.type === 'basemap' || !layer.geometry) return '';
  if (layer.type === 'route' && layer.geometry.type === 'LineString') {
    if (layer.geometry.coordinates.length < 2) throw new Error(`Route layer "${layer.name}" has no printable line.`);
    const path = layer.geometry.coordinates.map((coordinate, index) => (
      `${pointText(project(coordinate, capture, width, height))} ${index === 0 ? 'm' : 'l'}`
    )).join('\n');
    return `${colorComponents('#d9363e')} RG\n${formatNumber(1.2 * POINTS_PER_MM)} w\n1 J\n1 j\n${path}\nS`;
  }
  if (layer.type === 'poi' && layer.geometry.type === 'Point') {
    const point = project(layer.geometry.coordinates, capture, width, height);
    return `${colorComponents('#0d78b5')} rg\n${circleCommands(point, 2 * POINTS_PER_MM)}\nf`;
  }
  if (layer.type === 'shape' && layer.geometry.type === 'Polygon') {
    if (layer.geometry.coordinates.length === 0) throw new Error(`Shape layer "${layer.name}" has no printable polygon.`);
    const path = layer.geometry.coordinates.map((ring) => ring.map((coordinate, index) => (
      `${pointText(project(coordinate, capture, width, height))} ${index === 0 ? 'm' : 'l'}`
    )).join('\n') + '\nh').join('\n');
    const color = colorComponents('#d18b25');
    return `${color} rg\n${color} RG\n${formatNumber(0.5 * POINTS_PER_MM)} w\n${path}\nB*`;
  }
  throw new Error(`Layer "${layer.name}" has geometry that cannot be represented in the PDF.`);
}

function createContentStream(
  groups: readonly PdfGroup[],
  capture: PreviewPng & Required<Pick<PreviewPng, 'projectToFrame'>>,
  width: number,
  height: number,
): Uint8Array {
  const basemap = groups.find(({ layer }) => layer?.type === 'basemap');
  if (!basemap) throw new Error('The project must contain one basemap for PDF export.');
  const lines = [
    'q',
    `0 0 ${formatNumber(width)} ${formatNumber(height)} re W n`,
    '/BasemapGS gs',
    `/OC /${basemap.resourceName} BDC`,
    `${formatNumber(width)} 0 0 ${formatNumber(height)} 0 0 cm`,
    '/BasemapImage Do',
    'EMC',
    'Q',
  ];
  const vectorGroups = groups.filter(({ layer }) => layer && layer.type !== 'basemap');
  let index = vectorGroups.length;
  while (index > 0) {
    index -= 1;
    const { layer, name, resourceName } = vectorGroups[index];
    if (!layer) continue;
    const commands = vectorCommands(layer, capture, width, height);
    lines.push(
      `% Vector layer: ${name.replaceAll(/[\r\n%]/g, ' ')}`,
      'q',
      `/GS${index + 1} gs`,
      `/OC /${resourceName} BDC`,
      commands,
      'EMC',
      'Q',
    );
  }
  const attribution = groups.at(-1);
  if (!attribution) throw new Error('The PDF attribution layer is unavailable.');
  lines.push(
    '/OC /Attribution BDC',
    'q',
    '1 1 1 rg',
    `0 0 ${formatNumber(width)} ${formatNumber(5 * POINTS_PER_MM)} re f`,
    '0.066667 0.094118 0.152941 rg',
    'BT',
    '/F1 6 Tf',
    `6 ${formatNumber(1.8 * POINTS_PER_MM)} Td`,
    `${pdfContentString(ATTRIBUTION)} Tj`,
    'ET',
    'Q',
    'EMC',
  );
  return asciiBytes(lines.join('\n'));
}

export async function createPrintPdf(
  document: ProjectDocument,
  capture: PreviewPng,
  signal?: AbortSignal,
): Promise<Blob> {
  validateCapture(capture);
  if (!Number.isFinite(document.page.widthMm) || document.page.widthMm <= 0
    || !Number.isFinite(document.page.heightMm) || document.page.heightMm <= 0) {
    throw new Error('The PDF page dimensions must be finite positive values.');
  }
  const basemapLayers = document.layers.filter(({ type }) => type === 'basemap');
  if (basemapLayers.length !== 1) throw new Error('The project must contain exactly one basemap for PDF export.');
  const imageBytes = await jpegBytes(capture, signal);
  throwIfCancelled(signal);

  const width = document.page.widthMm * POINTS_PER_MM;
  const height = document.page.heightMm * POINTS_PER_MM;
  const vectorLayers = document.layers.filter(({ type }) => type !== 'basemap');
  const groups: PdfGroup[] = [
    { layer: basemapLayers[0], name: basemapLayers[0]?.name ?? 'Basemap', resourceName: 'Basemap' },
    ...vectorLayers.map((layer, index) => ({ layer, name: layer.name, resourceName: `Layer${index}` })),
    { name: 'Attribution', resourceName: 'Attribution' },
  ];

  const firstGroupObject = 7;
  const groupReferences = groups.map((_, index) => firstGroupObject + index);
  const firstGraphicsStateObject = firstGroupObject + groups.length;
  const basemapGraphicsStateReference = firstGraphicsStateObject;
  const graphicsStateReferences = vectorLayers.map((_, index) => firstGraphicsStateObject + index + 1);
  const infoReference = firstGraphicsStateObject + vectorLayers.length + 1;
  const allGroupReferences = groupReferences.map((reference) => `${reference} 0 R`).join(' ');
  const orderedGroupReferences = [
    ...groupReferences.slice(1, -1),
    groupReferences[0],
    groupReferences.at(-1),
  ].map((reference) => `${reference} 0 R`).join(' ');
  const offGroupReferences = groups.flatMap(({ layer }, index) => (
    layer && !layer.visible ? [`${groupReferences[index]} 0 R`] : []
  )).join(' ');
  const properties = groups.map(({ resourceName }, index) => (
    `/${resourceName} ${groupReferences[index]} 0 R`
  )).join(' ');
  const graphicsStates = [
    `/BasemapGS ${basemapGraphicsStateReference} 0 R`,
    ...vectorLayers.map((_, index) => `/GS${index + 1} ${graphicsStateReferences[index]} 0 R`),
  ].join(' ');
  const content = createContentStream(groups, capture, width, height);

  const objects: PdfObject[] = [
    [`<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [${allGroupReferences}] /D << /Order [${orderedGroupReferences}] /OFF [${offGroupReferences}] >> >> >>`],
    ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formatNumber(width)} ${formatNumber(height)}] /CropBox [0 0 ${formatNumber(width)} ${formatNumber(height)}] /Resources << /XObject << /BasemapImage 5 0 R >> /Font << /F1 6 0 R >> /Properties << ${properties} >> /ExtGState << ${graphicsStates} >> >> /Contents 4 0 R >>`],
    streamObject('', content),
    streamObject(`/Type /XObject /Subtype /Image /Width ${capture.width} /Height ${capture.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, imageBytes),
    ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'],
    ...groups.map(({ name }) => [`<< /Type /OCG /Name ${pdfString(name)} >>`] as PdfObject),
    [`<< /Type /ExtGState /CA ${opacityValue(basemapLayers[0])} /ca ${opacityValue(basemapLayers[0])} >>`],
    ...vectorLayers.map((layer) => [`<< /Type /ExtGState /CA ${opacityValue(layer)} /ca ${opacityValue(layer)} >>`] as PdfObject),
    [`<< /Title ${pdfString(document.title)} /Creator (Print Map Studio) /Subject (Exact-page PDF with a raster basemap and named vector overlays.) >>`],
  ];
  const bytes = buildPdf(objects, infoReference);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/pdf' });
}

function sanitizeBaseFilename(filename: string): string {
  return filename
    .replace(/(?:\.layered\.svg|\.svg|\.png|\.pdf)$/i, '')
    .replaceAll(/[^a-z0-9._-]+/gi, '-')
    .replaceAll(/^[-.]+|[-.]+$/g, '') || 'map';
}

export function startPrintPdfDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeBaseFilename(filename)}.pdf`;
    link.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
