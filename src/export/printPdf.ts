import type { ContentLayer, ProjectDocument } from '../domain/project';
import { fitAttributionFontSize, projectAttributionText } from '../domain/projectAttributions';
import { asciiBytes, buildPdfBlob, pdfString, streamObject, type PdfObject } from './pdfWriter';
import { pdfVectorCommands } from './pdfVectorCommands';
import {
  createLosslessPdfRaster,
  type LosslessPdfRasterImage,
  type LosslessPdfRasterOptions,
} from './printPdfRaster';
import type { PreviewPng } from './previewPng';

const POINTS_PER_MM = 72 / 25.4;



type PdfGroup = Readonly<{
  layer?: ContentLayer;
  name: string;
  resourceName: string;
}>;

type PdfBasemapImage = Readonly<{
  bytes: Uint8Array | readonly Uint8Array[];
  destination: Readonly<{ x: number; y: number; width: number; height: number }>;
  dictionary: string;
  resourceName: string;
}>;

type PdfBasemap = Readonly<{
  images: readonly PdfBasemapImage[];
  output: Readonly<{ width: number; height: number }>;
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

function createContentStream(options: Readonly<{
  basemapImages: readonly PdfBasemapImage[];
  basemapOutput: PdfBasemap['output'];
  groups: readonly PdfGroup[];
  capture: PreviewPng & Required<Pick<PreviewPng, 'projectToFrame'>>;
  width: number;
  height: number;
  attributionText: string;
}>): Uint8Array {
  const { attributionText, basemapImages, basemapOutput, capture, groups, height, width } = options;
  const basemap = groups.find(({ layer }) => layer?.type === 'basemap');
  if (!basemap) throw new Error('The project must contain one basemap for PDF export.');
  if (basemapImages.length === 0) throw new Error('The PDF basemap has no printable image regions.');
  const lines = [
    'q',
    `0 0 ${formatNumber(width)} ${formatNumber(height)} re W n`,
    '/BasemapGS gs',
    `/OC /${basemap.resourceName} BDC`,
    ...basemapImages.flatMap(({ destination, resourceName }) => {
      const imageWidth = destination.width / basemapOutput.width * width;
      const imageHeight = destination.height / basemapOutput.height * height;
      const imageX = destination.x / basemapOutput.width * width;
      const imageY = height - (destination.y + destination.height) / basemapOutput.height * height;
      return [
        'q',
        `${formatNumber(imageWidth)} 0 0 ${formatNumber(imageHeight)} ${formatNumber(imageX)} ${formatNumber(imageY)} cm`,
        `/${resourceName} Do`,
        'Q',
      ];
    }),
    'EMC',
    'Q',
  ];
  const vectorGroups = groups.filter(({ layer }) => layer && layer.type !== 'basemap');
  let index = vectorGroups.length;
  while (index > 0) {
    index -= 1;
    const { layer, name, resourceName } = vectorGroups[index];
    if (!layer) continue;
    const commands = pdfVectorCommands(layer, capture, width, height);
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
  const attributionFontSize = fitAttributionFontSize(attributionText, Math.max(0.1, width - 12), 6);
  lines.push(
    '/OC /Attribution BDC',
    'q',
    '1 1 1 rg',
    `0 0 ${formatNumber(width)} ${formatNumber(5 * POINTS_PER_MM)} re f`,
    '0.066667 0.094118 0.152941 rg',
    'BT',
    `/F1 ${formatNumber(attributionFontSize)} Tf`,
    `6 ${formatNumber(1.8 * POINTS_PER_MM)} Td`,
    `${pdfContentString(attributionText)} Tj`,
    'ET',
    'Q',
    'EMC',
  );
  return asciiBytes(lines.join('\n'));
}

function validatePdfInput(
  document: ProjectDocument,
  capture: PreviewPng,
): asserts capture is PreviewPng & Required<Pick<PreviewPng, 'projectToFrame'>> {
  validateCapture(capture);
  if (!Number.isFinite(document.page.widthMm) || document.page.widthMm <= 0
    || !Number.isFinite(document.page.heightMm) || document.page.heightMm <= 0) {
    throw new Error('The PDF page dimensions must be finite positive values.');
  }
  if (document.layers.some(({ appearance }) => appearance?.kind === 'poi' && appearance.customAssetId)) {
    throw new Error('PDF export does not yet support custom marker images. Use layered SVG or PNG for this project.');
  }
  const basemapLayers = document.layers.filter(({ type }) => type === 'basemap');
  if (basemapLayers.length !== 1) throw new Error('The project must contain exactly one basemap for PDF export.');
}

function createPdf(
  document: ProjectDocument,
  capture: PreviewPng & Required<Pick<PreviewPng, 'projectToFrame'>>,
  basemap: PdfBasemap,
): Blob {
  const basemapLayer = document.layers.find(({ type }) => type === 'basemap');
  if (!basemapLayer) throw new Error('The project must contain exactly one basemap for PDF export.');
  const width = document.page.widthMm * POINTS_PER_MM;
  const height = document.page.heightMm * POINTS_PER_MM;
  const vectorLayers = document.layers.filter(({ type }) => type !== 'basemap');
  const groups: PdfGroup[] = [
    { layer: basemapLayer, name: basemapLayer.name, resourceName: 'Basemap' },
    ...vectorLayers.map((layer, index) => ({ layer, name: layer.name, resourceName: `Layer${index}` })),
    { name: 'Attribution', resourceName: 'Attribution' },
  ];

  const firstImageObject = 5;
  const fontReference = firstImageObject + basemap.images.length;
  const firstGroupObject = fontReference + 1;
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
  const imageResources = basemap.images.map(({ resourceName }, index) => (
    `/${resourceName} ${firstImageObject + index} 0 R`
  )).join(' ');
  const content = createContentStream({
    basemapImages: basemap.images,
    basemapOutput: basemap.output,
    groups,
    capture,
    width,
    height,
    attributionText: projectAttributionText(document),
  });

  const objects: PdfObject[] = [
    [`<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [${allGroupReferences}] /D << /Order [${orderedGroupReferences}] /OFF [${offGroupReferences}] >> >> >>`],
    ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formatNumber(width)} ${formatNumber(height)}] /CropBox [0 0 ${formatNumber(width)} ${formatNumber(height)}] /Resources << /XObject << ${imageResources} >> /Font << /F1 ${fontReference} 0 R >> /Properties << ${properties} >> /ExtGState << ${graphicsStates} >> >> /Contents 4 0 R >>`],
    streamObject('', content),
    ...basemap.images.map(({ bytes, dictionary }) => streamObject(dictionary, bytes)),
    ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'],
    ...groups.map(({ name }) => [`<< /Type /OCG /Name ${pdfString(name)} >>`] as PdfObject),
    [`<< /Type /ExtGState /CA ${opacityValue(basemapLayer)} /ca ${opacityValue(basemapLayer)} >>`],
    ...vectorLayers.map((layer) => [`<< /Type /ExtGState /CA ${opacityValue(layer)} /ca ${opacityValue(layer)} >>`] as PdfObject),
    [`<< /Title ${pdfString(document.title)} /Creator (Print Map Studio) /Subject (Exact-page PDF with a raster basemap and named vector overlays.) >>`],
  ];
  return buildPdfBlob(objects, infoReference);
}

function losslessImage(image: LosslessPdfRasterImage): PdfBasemapImage {
  return {
    bytes: image.bytes,
    destination: image.destination,
    dictionary: `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Interpolate false /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${image.width} >>`,
    resourceName: image.resourceName,
  };
}

export async function createPrintPdf(
  document: ProjectDocument,
  capture: PreviewPng,
  signal?: AbortSignal,
): Promise<Blob> {
  validatePdfInput(document, capture);
  const imageBytes = await jpegBytes(capture, signal);
  throwIfCancelled(signal);
  return createPdf(document, capture, {
    images: [{
      bytes: imageBytes,
      destination: { x: 0, y: 0, width: capture.width, height: capture.height },
      dictionary: `/Type /XObject /Subtype /Image /Width ${capture.width} /Height ${capture.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Interpolate false /Filter /DCTDecode`,
      resourceName: 'BasemapImage0',
    }],
    output: { width: capture.width, height: capture.height },
  });
}

export async function createNativePrintPdf(
  document: ProjectDocument,
  capture: PreviewPng,
  options: LosslessPdfRasterOptions,
): Promise<Blob> {
  validatePdfInput(document, capture);
  const raster = await createLosslessPdfRaster(options);
  throwIfCancelled(options.signal);
  return createPdf(document, capture, {
    images: raster.images.map((image) => losslessImage(image)),
    output: raster.output,
  });
}
