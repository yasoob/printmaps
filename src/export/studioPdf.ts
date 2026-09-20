import { zlibSync } from 'fflate';
import type { PhotoAsset } from '../domain/studio';
import { deriveStudioComposition } from '../print/studioComposition';
import { decimal, type StudioBox, type StudioProjector } from '../print/studioGeometry';
import type { StudioCompositionDocument } from '../print/studioLayout';
import { STUDIO_FONTS, type StudioPrimitive } from '../print/studioPrimitives';
import { streamObject, type PdfObject } from './pdfWriter';

export type StudioPdfImage = Readonly<{ name: string; width: number; height: number; rgb: Uint8Array; alpha: Uint8Array }>;
export type StudioPdfComposition = Readonly<{ commands: string; images: readonly StudioPdfImage[]; opacities: readonly number[] }>;
export const STUDIO_PDF_FONTS = [
  { name: 'StudioSans', base: 'Helvetica' }, { name: 'StudioSerif', base: 'Times-Roman' }, { name: 'StudioMono', base: 'Courier' },
] as const;

function color(hex: string): string {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error('The poster contains an invalid PDF color.');
  return [1, 3, 5].map((offset) => decimal(Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)).join(' ');
}

function rect(box: StudioBox): string {
  return `${decimal(box.x)} ${decimal(box.y)} ${decimal(box.width)} ${decimal(box.height)} re`;
}

function circle(x: number, y: number, radius: number): string {
  const k = radius * 0.552284749831;
  return [
    `${decimal(x + radius)} ${decimal(y)} m`,
    `${decimal(x + radius)} ${decimal(y + k)} ${decimal(x + k)} ${decimal(y + radius)} ${decimal(x)} ${decimal(y + radius)} c`,
    `${decimal(x - k)} ${decimal(y + radius)} ${decimal(x - radius)} ${decimal(y + k)} ${decimal(x - radius)} ${decimal(y)} c`,
    `${decimal(x - radius)} ${decimal(y - k)} ${decimal(x - k)} ${decimal(y - radius)} ${decimal(x)} ${decimal(y - radius)} c`,
    `${decimal(x + k)} ${decimal(y - radius)} ${decimal(x + radius)} ${decimal(y - k)} ${decimal(x + radius)} ${decimal(y)} c`,
    'h',
  ].join('\n');
}

function contentString(text: string): string {
  let output = '';
  for (const character of text) {
    const code = character.codePointAt(0)!;
    if (code < 32 || code > 255 || (code > 126 && code < 160)) {
      throw new Error('PDF poster typography supports Latin characters. Use SVG or PNG for this title, or replace unsupported characters before exporting PDF.');
    }
    if (code >= 160) output += `\\${code.toString(8).padStart(3, '0')}`;
    else output += ['\\', '(', ')'].includes(character) ? `\\${character}` : character;
  }
  return `(${output})`;
}

function textCommands(primitive: Extract<StudioPrimitive, { kind: 'text' }>): string {
  const text = contentString(primitive.text);
  const surface = document.createElement('canvas');
  const context = surface.getContext('2d');
  if (!context) throw new Error('The browser cannot measure poster typography for PDF.');
  context.font = `${primitive.size}px ${STUDIO_FONTS[primitive.font]}`;
  const measured = context.measureText(primitive.text).width;
  surface.width = 0; surface.height = 0;
  const ratio = measured > 0 ? primitive.width / measured : 1;
  const font = { sans: 'StudioSans', serif: 'StudioSerif', mono: 'StudioMono' }[primitive.font];
  const offset = primitive.align === 'left' ? 0 : (primitive.align === 'right' ? primitive.width : primitive.width / 2);
  return `${color(primitive.color)} rg\nBT\n/${font} ${decimal(primitive.size)} Tf\n${decimal(ratio * 100)} Tz\n1 0 0 -1 ${decimal(primitive.point.x - offset)} ${decimal(primitive.point.y)} Tm\n${text} Tj\nET`;
}

function shapeCommands(primitive: Exclude<StudioPrimitive, { kind: 'text' | 'image' }>): string {
  let path: string;
  if (primitive.kind === 'rect') path = rect(primitive.box);
  else if (primitive.kind === 'circle') path = circle(primitive.center.x, primitive.center.y, primitive.radius);
  else path = primitive.points.map((point, index) => `${decimal(point.x)} ${decimal(point.y)} ${index === 0 ? 'm' : 'l'}`).join('\n') + (primitive.closed ? '\nh' : '');
  const hasFill = primitive.fill !== 'none';
  const hasStroke = Boolean(primitive.stroke && primitive.strokeWidth);
  const paint = [
    hasFill ? `${color(primitive.fill)} rg` : '',
    hasStroke ? `${color(primitive.stroke!)} RG\n${decimal(primitive.strokeWidth!)} w` : '',
  ].join('\n');
  return `${paint}\n${path}\n${hasFill ? (hasStroke ? 'B' : 'f') : (hasStroke ? 'S' : 'n')}`;
}

function imageCommands(primitive: Extract<StudioPrimitive, { kind: 'image' }>, name: string): string {
  const { box, imageBox } = primitive;
  const clip = primitive.shape === 'circle'
    ? circle(box.x + box.width / 2, box.y + box.height / 2, Math.min(box.width, box.height) / 2)
    : rect(box);
  return `${clip} W n\n${decimal(imageBox.width)} 0 0 ${decimal(-imageBox.height)} ${decimal(imageBox.x)} ${decimal(imageBox.y + imageBox.height)} cm\n/${name} Do`;
}

async function loadPdfPhoto(asset: PhotoAsset, signal?: AbortSignal): Promise<HTMLImageElement> {
  if (signal?.aborted) throw new DOMException('PDF composition cancelled.', 'AbortError');
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      image.removeEventListener('load', loaded);
      image.removeEventListener('error', failed);
      signal?.removeEventListener('abort', abort);
    };
    const loaded = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); image.src = ''; reject(new Error('The browser cannot decode a photo for PDF export.')); };
    const abort = () => { cleanup(); image.src = ''; reject(new DOMException('PDF composition cancelled.', 'AbortError')); };
    image.addEventListener('load', loaded, { once: true });
    image.addEventListener('error', failed, { once: true });
    signal?.addEventListener('abort', abort, { once: true });
    image.src = asset.dataUri;
  });
  return image;
}

async function decodePhoto(asset: PhotoAsset, name: string, signal?: AbortSignal): Promise<StudioPdfImage> {
  const image = await loadPdfPhoto(asset, signal);
  const canvas = document.createElement('canvas');
  canvas.width = asset.width; canvas.height = asset.height;
  try {
    if (signal?.aborted) throw new DOMException('PDF composition cancelled.', 'AbortError');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The browser cannot prepare photo pixels for PDF export.');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, asset.width, asset.height).data;
    const rgb = new Uint8Array(asset.width * asset.height * 3), alpha = new Uint8Array(asset.width * asset.height);
    for (let index = 0; index < alpha.length; index += 1) {
      rgb.set(pixels.subarray(index * 4, index * 4 + 3), index * 3);
      alpha[index] = pixels[index * 4 + 3];
    }
    return { name, width: asset.width, height: asset.height, rgb: zlibSync(rgb), alpha: zlibSync(alpha) };
  } finally {
    canvas.width = 0; canvas.height = 0; image.src = '';
  }
}

export async function prepareStudioPdf(document: StudioCompositionDocument, projectToFrame: StudioProjector, signal?: AbortSignal, referenceLongitude?: number): Promise<StudioPdfComposition> {
  const primitives = deriveStudioComposition(document, (coordinate) => {
    const point = projectToFrame(coordinate);
    return { x: point.x * document.page.widthMm, y: point.y * document.page.heightMm };
  }, undefined, referenceLongitude);
  if (primitives.length === 0) return { commands: '', images: [], opacities: [] };
  const images: StudioPdfImage[] = [];
  const byId = new Map<string, string>();
  const opacities = [...new Set(primitives.map((primitive) => 'opacity' in primitive ? primitive.opacity ?? 1 : 1))];
  const commands = ['q', `${decimal(72 / 25.4)} 0 0 ${decimal(-72 / 25.4)} 0 ${decimal(document.page.heightMm * 72 / 25.4)} cm`];
  for (const primitive of primitives) {
    if (signal?.aborted) throw new DOMException('PDF composition cancelled.', 'AbortError');
    commands.push('q');
    if (primitive.clip) commands.push(`${rect(primitive.clip)} W n`);
    const opacity = 'opacity' in primitive ? primitive.opacity ?? 1 : 1;
    commands.push(`/StudioOpacity${opacities.indexOf(opacity)} gs`);
    if (primitive.kind === 'image') {
      let name = byId.get(primitive.asset.id);
      if (!name) {
        name = `StudioPhoto${images.length}`;
        images.push(await decodePhoto(primitive.asset, name, signal));
        byId.set(primitive.asset.id, name);
      }
      commands.push(imageCommands(primitive, name));
    } else commands.push(primitive.kind === 'text' ? textCommands(primitive) : shapeCommands(primitive));
    commands.push('Q');
  }
  commands.push('Q');
  return { commands: commands.join('\n'), images, opacities };
}

export function studioPdfImageObjects(image: StudioPdfImage, firstReference: number): PdfObject[] {
  const shared = `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /BitsPerComponent 8 /Filter /FlateDecode`;
  return [
    streamObject(`${shared} /ColorSpace /DeviceRGB /SMask ${firstReference + 1} 0 R`, image.rgb),
    streamObject(`${shared} /ColorSpace /DeviceGray`, image.alpha),
  ];
}

export function studioPdfResources(composition: StudioPdfComposition, firstReference: number) {
  const objects: PdfObject[] = [];
  if (!composition.commands) return { objects, imageResources: '', fontResources: '', graphicsStates: '' };
  const imageResources: string[] = [], fontResources: string[] = [], graphicsStates: string[] = [];
  for (const image of composition.images) {
    const reference = firstReference + objects.length;
    imageResources.push(`/${image.name} ${reference} 0 R`);
    objects.push(...studioPdfImageObjects(image, reference));
  }
  for (const font of STUDIO_PDF_FONTS) {
    fontResources.push(`/${font.name} ${firstReference + objects.length} 0 R`);
    objects.push([`<< /Type /Font /Subtype /Type1 /BaseFont /${font.base} /Encoding /WinAnsiEncoding >>`]);
  }
  for (const [index, opacity] of composition.opacities.entries()) {
    graphicsStates.push(`/StudioOpacity${index} ${firstReference + objects.length} 0 R`);
    objects.push([`<< /Type /ExtGState /CA ${decimal(opacity)} /ca ${decimal(opacity)} >>`]);
  }
  return { objects, imageResources: imageResources.join(' '), fontResources: fontResources.join(' '), graphicsStates: graphicsStates.join(' ') };
}
