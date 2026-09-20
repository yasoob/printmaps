import { projectAttributionText } from '../domain/projectAttributions';
import { deriveStudioComposition } from '../print/studioComposition';
import type { StudioCamera, StudioCompositionDocument } from '../print/studioLayout';
import { STUDIO_FONTS, studioText, type StudioPrimitive } from '../print/studioPrimitives';
import type { StudioBox, StudioProjector } from '../print/studioGeometry';

export type StudioDrawOptions = Readonly<{
  signal?: AbortSignal;
  camera?: StudioCamera;
  referenceLongitude?: number;
  includeAttribution?: boolean;
  output?: Readonly<{ width: number; height: number }>;
  region?: StudioBox;
}>;

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Poster composition cancelled.', 'AbortError');
}

function imageLoader() {
  const images = new Map<string, Promise<HTMLImageElement>>();
  const release: Array<() => void> = [];
  return {
    load(id: string, source: string) {
      let promise = images.get(id);
      if (!promise) {
        promise = new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          const loaded = () => resolve(image);
          const failed = () => reject(new Error(`Photo "${id}" cannot be decoded. Reattach this photo before exporting.`));
          image.addEventListener('load', loaded, { once: true });
          image.addEventListener('error', failed, { once: true });
          release.push(() => {
            image.removeEventListener('load', loaded);
            image.removeEventListener('error', failed);
            image.src = '';
            reject(new DOMException('Poster image decoding cancelled.', 'AbortError'));
          });
          image.src = source;
        });
        images.set(id, promise);
      }
      return promise;
    },
    dispose() {
      for (const dispose of release) dispose();
      images.clear();
      release.length = 0;
    },
  };
}

function abortableImage(promise: Promise<HTMLImageElement>, signal?: AbortSignal): Promise<HTMLImageElement> {
  throwIfCancelled(signal);
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Poster image decoding cancelled.', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    async function settle() {
      try {
        const image = await promise;
        if (signal!.aborted) abort();
        else resolve(image);
      } catch (error) {
        reject(error);
      } finally {
        signal!.removeEventListener('abort', abort);
      }
    }
    void settle();
  });
}

function clipBox(context: CanvasRenderingContext2D, box: StudioBox): void {
  context.beginPath();
  context.rect(box.x, box.y, box.width, box.height);
  context.clip();
}

function shapePath(context: CanvasRenderingContext2D, primitive: Exclude<StudioPrimitive, { kind: 'text' | 'image' }>): void {
  context.beginPath();
  switch (primitive.kind) {
    case 'rect': { context.rect(primitive.box.x, primitive.box.y, primitive.box.width, primitive.box.height); break;
    }
    case 'circle': { context.arc(primitive.center.x, primitive.center.y, primitive.radius, 0, Math.PI * 2); break;
    }
    case 'path': {
      for (const [index, point] of primitive.points.entries()) {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      }
      if (primitive.closed) context.closePath();
    }
  }
}

function drawText(context: CanvasRenderingContext2D, primitive: Extract<StudioPrimitive, { kind: 'text' }>): void {
  context.fillStyle = primitive.color;
  context.font = `${primitive.size}px ${STUDIO_FONTS[primitive.font]}`;
  context.textAlign = primitive.align;
  context.textBaseline = 'alphabetic';
  const measured = context.measureText(primitive.text).width;
  const ratio = measured > 0 ? primitive.width / measured : 1;
  context.translate(primitive.point.x, primitive.point.y);
  context.scale(ratio, 1);
  context.fillText(primitive.text, 0, 0);
}

async function drawPrimitive(context: CanvasRenderingContext2D, primitive: StudioPrimitive, images: ReturnType<typeof imageLoader>, signal?: AbortSignal): Promise<void> {
  context.save();
  try {
    if (primitive.clip) clipBox(context, primitive.clip);
    if (primitive.kind === 'text') return drawText(context, primitive);
    if (primitive.kind === 'image') {
      const image = await abortableImage(images.load(primitive.asset.id, primitive.asset.dataUri), signal);
      throwIfCancelled(signal);
      const { box, imageBox } = primitive;
      const path = new Path2D();
      if (primitive.shape === 'circle') path.arc(box.x + box.width / 2, box.y + box.height / 2, Math.min(box.width, box.height) / 2, 0, Math.PI * 2);
      else path.rect(box.x, box.y, box.width, box.height);
      context.clip(path);
      context.drawImage(image, imageBox.x, imageBox.y, imageBox.width, imageBox.height);
      return;
    }
    context.globalAlpha = primitive.opacity ?? 1;
    shapePath(context, primitive);
    if (primitive.fill !== 'none') {
      context.fillStyle = primitive.fill;
      context.fill();
    }
    if (primitive.stroke && primitive.strokeWidth) {
      context.strokeStyle = primitive.stroke;
      context.lineWidth = primitive.strokeWidth;
      context.stroke();
    }
  } finally {
    context.restore();
  }
}

export function studioAttributionPrimitives(document: StudioCompositionDocument): StudioPrimitive[] {
  const { widthMm: width, heightMm: height } = document.page;
  return [
    { kind: 'rect', box: { x: 0, y: height - 5, width, height: 5 }, fill: '#ffffff' },
    studioText(projectAttributionText(document), { x: 2, y: height - 1.5 }, { size: 2.5, maxWidth: width - 4, color: '#111827', font: 'sans', align: 'left' }),
  ];
}

export function prepareStudioComposition(document: StudioCompositionDocument) {
  const images = imageLoader();
  let isDisposed = false;
  return {
    async draw(canvas: HTMLCanvasElement, projectToFrame: StudioProjector, options: StudioDrawOptions = {}): Promise<void> {
      if (isDisposed) throw new Error('This poster composition has already been released.');
      throwIfCancelled(options.signal);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('The browser cannot draw the poster composition.');
      const project: StudioProjector = (coordinate) => {
        const point = projectToFrame(coordinate);
        return { x: point.x * document.page.widthMm, y: point.y * document.page.heightMm };
      };
      const primitives = deriveStudioComposition(document, project, options.camera, options.referenceLongitude);
      if (options.includeAttribution) primitives.push(...studioAttributionPrimitives(document));
      const output = options.output ?? canvas;
      context.save();
      try {
        context.translate(-(options.region?.x ?? 0), -(options.region?.y ?? 0));
        context.scale(output.width / document.page.widthMm, output.height / document.page.heightMm);
        for (const primitive of primitives) {
          throwIfCancelled(options.signal);
          await drawPrimitive(context, primitive, images, options.signal);
        }
        throwIfCancelled(options.signal);
      } finally {
        context.restore();
      }
    },
    dispose() { isDisposed = true; images.dispose(); },
  };
}

export async function drawStudioComposition(canvas: HTMLCanvasElement, document: StudioCompositionDocument, projectToFrame: StudioProjector, options?: StudioDrawOptions): Promise<void> {
  const prepared = prepareStudioComposition(document);
  try {
    await prepared.draw(canvas, projectToFrame, options);
  } finally {
    prepared.dispose();
  }
}
