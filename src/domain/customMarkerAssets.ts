import { sha256Hex } from './sha256';

export { sha256Hex } from './sha256';

export const MAX_CUSTOM_MARKER_BYTES = 1024 * 1024;
export const MIN_CUSTOM_MARKER_PIXELS = 100;
export const MAX_CUSTOM_MARKER_PIXELS = 2048;
export const MAX_CUSTOM_MARKER_PROJECT_ASSETS = 64;
export const MAX_CUSTOM_MARKER_PROJECT_BYTES = 8 * 1024 * 1024;
export const MAX_CUSTOM_MARKER_PROJECT_PIXELS = 16 * 1024 * 1024;

export type CustomMarkerMimeType = 'image/png' | 'image/jpeg' | 'image/svg+xml';

export type CustomMarkerAsset = Readonly<{
  id: string;
  mimeType: CustomMarkerMimeType;
  width: number;
  height: number;
  dataUri: string;
}>;

export type DecodedCustomMarkerImage = ImageBitmap | ImageData;

export function decodeCustomMarkerImage(asset: CustomMarkerAsset): Promise<DecodedCustomMarkerImage> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = asset.width;
        canvas.height = asset.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('The browser cannot decode the custom marker image.');
        context.drawImage(image, 0, 0, asset.width, asset.height);
        resolve(context.getImageData(0, 0, asset.width, asset.height));
      } catch {
        reject(new Error('The custom marker image could not be decoded.'));
      }
    }, { once: true });
    image.addEventListener('error', () => reject(new Error('The custom marker image could not be decoded.')), { once: true });
    image.src = asset.dataUri;
  });
}

const SUPPORTED_TYPES = new Set<CustomMarkerMimeType>(['image/png', 'image/jpeg', 'image/svg+xml']);
const FORBIDDEN_SVG_ELEMENTS = new Set([
  'a', 'foreignobject', 'iframe', 'object', 'script', 'style',
]);
const REFERENCING_SVG_ELEMENTS = new Set(['image', 'use']);
const ALLOWED_SVG_ELEMENTS = new Set([
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'title', 'desc',
]);
const ALLOWED_SVG_ATTRIBUTES = new Set([
  'id', 'version', 'viewbox', 'preserveaspectratio', 'width', 'height',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'transform',
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'fill-opacity', 'stroke-opacity', 'opacity', 'fill-rule', 'clip-rule', 'vector-effect',
  'role', 'focusable', 'aria-hidden',
]);
const SAFE_SVG_PAINT = /^(?:none|currentColor|transparent|[a-zA-Z]{1,32}|#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\([0-9.,%+\-\s]+\))$/;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCodePoint(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}


function assertDimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) {
    throw new TypeError('Custom markers must use whole-pixel dimensions.');
  }
  if (width < MIN_CUSTOM_MARKER_PIXELS || height < MIN_CUSTOM_MARKER_PIXELS) {
    throw new Error(`Custom markers must be at least ${MIN_CUSTOM_MARKER_PIXELS} × ${MIN_CUSTOM_MARKER_PIXELS} pixels.`);
  }
  if (width > MAX_CUSTOM_MARKER_PIXELS || height > MAX_CUSTOM_MARKER_PIXELS) {
    throw new Error(`Custom markers must be no larger than ${MAX_CUSTOM_MARKER_PIXELS} × ${MAX_CUSTOM_MARKER_PIXELS} pixels.`);
  }
}

function pngDimensions(bytes: Uint8Array): [number, number] {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 29 || signature.some((value, index) => bytes[index] !== value)
    || String.fromCodePoint(...bytes.subarray(12, 16)) !== 'IHDR') {
    throw new Error('The selected file does not contain a valid PNG header.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

const JPEG_START_OF_FRAME = new Set([0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF]);

function jpegFrameDimensions(bytes: Uint8Array, marker: number, offset: number, length: number): [number, number] | undefined {
  if (!JPEG_START_OF_FRAME.has(marker)) return;
  if (length < 8) throw new Error('The selected JPEG contains a malformed frame header.');
  return [
    (bytes[offset + 5] << 8) | bytes[offset + 6],
    (bytes[offset + 3] << 8) | bytes[offset + 4],
  ];
}

function jpegSegment(bytes: Uint8Array, initialOffset: number) {
  if (bytes[initialOffset] !== 0xFF) throw new Error('The selected file contains a malformed JPEG marker.');
  let offset = initialOffset;
  while (bytes[offset] === 0xFF) offset += 1;
  const marker = bytes[offset++];
  if (marker === 0xD8) return { nextOffset: offset };
  if (marker === 0xD9 || offset + 2 > bytes.length) return { nextOffset: bytes.length };
  const length = (bytes[offset] << 8) | bytes[offset + 1];
  if (length < 2 || offset + length > bytes.length) return { nextOffset: bytes.length };
  return { dimensions: jpegFrameDimensions(bytes, marker, offset, length), nextOffset: offset + length };
}

function jpegDimensions(bytes: Uint8Array): [number, number] {
  if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) throw new Error('The selected file does not contain a valid JPEG header.');
  let offset = 2;
  while (offset + 8 < bytes.length) {
    const segment = jpegSegment(bytes, offset);
    if (segment.dimensions) return segment.dimensions;
    offset = segment.nextOffset;
  }
  throw new Error('The selected JPEG does not contain readable dimensions.');
}

function numericSvgDimension(value: string | null): number | undefined {
  if (!value || !/^(?:\d+\.?\d*|\.\d+)(?:px)?$/i.test(value.trim())) return;
  const result = Number(value.replace(/px$/i, ''));
  return Number.isFinite(result) ? result : undefined;
}

function validateSvgAttribute(attribute: Attr): void {
  const name = attribute.name.toLowerCase();
  if (name.startsWith('on')) throw new Error('Custom SVG markers may not contain event handlers.');
  if (name === 'xmlns' || name.startsWith('xmlns:')) return;
  if (!ALLOWED_SVG_ATTRIBUTES.has(name)) throw new Error(`Custom SVG attribute is not supported: ${name}.`);
  if (attribute.value.includes('\\')) throw new Error(`Custom SVG ${name} attribute value is not supported.`);
  if ((name === 'fill' || name === 'stroke') && !SAFE_SVG_PAINT.test(attribute.value)) {
    throw new Error(`Custom SVG ${name} attribute value is not supported.`);
  }
}

function validateSvgElement(element: Element): void {
  const localName = element.localName.toLowerCase();
  if (FORBIDDEN_SVG_ELEMENTS.has(localName)) {
    throw new Error('Custom SVG markers may not contain active content or embedded resources.');
  }
  if (REFERENCING_SVG_ELEMENTS.has(localName)) {
    throw new Error('Custom SVG markers may not contain external references or inline styles.');
  }
  if (!ALLOWED_SVG_ELEMENTS.has(localName)) {
    throw new Error(`Custom SVG element is not supported: ${localName}.`);
  }
  for (const attribute of element.attributes) validateSvgAttribute(attribute);
}

function svgRootDimensions(root: Element): [number, number] {
  const width = numericSvgDimension(root.getAttribute('width'));
  const height = numericSvgDimension(root.getAttribute('height'));
  if (width !== undefined && height !== undefined) return [width, height];
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value))
    || viewBox[2] <= 0 || viewBox[3] <= 0) {
    throw new Error('Custom SVG markers need positive pixel width and height or a valid viewBox.');
  }
  return [viewBox[2], viewBox[3]];
}

function svgDimensions(bytes: Uint8Array): [number, number] {
  let source: string;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Custom SVG markers must use valid UTF-8 text.');
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) {
    throw new Error('Custom SVG markers may not contain active content.');
  }
  const withoutXmlDeclaration = source.replace(/^\s*<\?xml\s[^?]*\?>/i, '');
  if (/<\?/.test(withoutXmlDeclaration)) {
    throw new Error('Custom SVG markers may not contain processing instructions.');
  }
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (parsed.querySelector('parsererror') || parsed.documentElement.localName.toLowerCase() !== 'svg') {
    throw new Error('The selected file is not valid SVG markup.');
  }
  for (const element of parsed.querySelectorAll('*')) validateSvgElement(element);
  return svgRootDimensions(parsed.documentElement);
}

function markerDimensions(mimeType: CustomMarkerMimeType, bytes: Uint8Array): [number, number] {
  if (mimeType === 'image/png') return pngDimensions(bytes);
  if (mimeType === 'image/jpeg') return jpegDimensions(bytes);
  return svgDimensions(bytes);
}

export function validateStoredCustomMarkerAsset(asset: CustomMarkerAsset): void {
  if (!SUPPORTED_TYPES.has(asset.mimeType)) throw new Error('Custom marker assets must be PNG, JPEG, or SVG images.');
  const prefix = `data:${asset.mimeType};base64,`;
  if (!asset.dataUri.startsWith(prefix)) throw new Error('Custom marker asset data must match its declared image type.');
  const encoded = asset.dataUri.slice(prefix.length);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error('Custom marker asset data must be valid base64.');
  }
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(encoded), (character) => character.codePointAt(0) ?? 0);
  } catch {
    throw new Error('Custom marker asset data must be valid base64.');
  }
  if (bytes.length === 0 || bytes.length > MAX_CUSTOM_MARKER_BYTES) {
    throw new Error('Custom marker asset data must be between 1 byte and 1 MB.');
  }
  const [width, height] = markerDimensions(asset.mimeType, bytes);
  assertDimensions(width, height);
  if (width !== asset.width || height !== asset.height) {
    throw new Error('Custom marker asset dimensions do not match its image data.');
  }
  if (asset.id !== `sha256-${sha256Hex(bytes)}`) {
    throw new Error('Custom marker asset content does not match its SHA-256 ID.');
  }
}

export function validateCustomMarkerAssetCollection(assets: Record<string, CustomMarkerAsset>): void {
  const values = Object.values(assets);
  if (values.length > MAX_CUSTOM_MARKER_PROJECT_ASSETS) {
    throw new Error(`Projects may contain at most ${MAX_CUSTOM_MARKER_PROJECT_ASSETS} custom marker assets.`);
  }
  const encodedBytes = values.reduce((total, asset) => total + asset.dataUri.length, 0);
  if (encodedBytes > MAX_CUSTOM_MARKER_PROJECT_BYTES) {
    throw new Error('Custom marker assets exceed the 8 MiB encoded project budget.');
  }
  const pixels = values.reduce((total, asset) => total + asset.width * asset.height, 0);
  if (pixels > MAX_CUSTOM_MARKER_PROJECT_PIXELS) throw new Error('Custom marker assets exceed the decoded pixel budget.');
}

export async function validateCustomMarkerFile(file: File): Promise<CustomMarkerAsset> {
  if (!SUPPORTED_TYPES.has(file.type as CustomMarkerMimeType)) {
    throw new Error('Custom markers must be PNG, JPEG, or SVG files.');
  }
  if (file.size === 0) throw new Error('The custom marker file is empty.');
  if (file.size > MAX_CUSTOM_MARKER_BYTES) {
    throw new Error('Custom marker files must be 1 MB or smaller.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type as CustomMarkerMimeType;
  const [width, height] = markerDimensions(mimeType, bytes);
  assertDimensions(width, height);
  return {
    id: `sha256-${sha256Hex(bytes)}`,
    mimeType,
    width,
    height,
    dataUri: `data:${mimeType};base64,${bytesToBase64(bytes)}`,
  };
}
