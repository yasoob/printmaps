import { Zlib } from 'fflate';
import type { ExportPreflightResult } from './preflight';
import {
  composeRasterTiles,
  type RasterProgress,
  type RasterTileRenderRequest,
} from './rasterCompositor';

const ROW_BATCH_SIZE = 64;

type PixelRegion = Readonly<{ x: number; y: number; width: number; height: number }>;

export type LosslessPdfRasterImage = Readonly<{
  bytes: readonly Uint8Array[];
  destination: PixelRegion;
  height: number;
  resourceName: string;
  width: number;
}>;

export type LosslessPdfRasterOptions = Readonly<{
  preflight: ExportPreflightResult;
  renderTile: (request: RasterTileRenderRequest) => PromiseLike<HTMLCanvasElement>;
  signal?: AbortSignal;
  onProgress?: (progress: RasterProgress) => void | PromiseLike<void>;
  onStage?: (stage: 'rendering' | 'encoding') => void;
}>;

function abortError(): DOMException {
  return new DOMException('PDF export was cancelled.', 'AbortError');
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortError();
}

function yieldToBrowserTask(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
}

function requireSafePdfPlan(preflight: ExportPreflightResult) {
  if (preflight.format !== 'pdf' || !preflight.safe || !preflight.dimensions || !preflight.plan) {
    throw new Error('PDF export preflight must pass before native basemap rendering begins.');
  }
  return { dimensions: preflight.dimensions, plan: preflight.plan };
}

function validateSurface(surface: HTMLCanvasElement, region: RasterTileRenderRequest['region']): void {
  if (
    surface instanceof HTMLCanvasElement
    && surface.width === region.width
    && surface.height === region.height
  ) return;
  if (surface instanceof HTMLCanvasElement) {
    surface.width = 0;
    surface.height = 0;
  }
  throw new Error('The native map renderer returned an invalid PDF basemap region.');
}

function validateSourceRegion(surface: HTMLCanvasElement, source: PixelRegion): void {
  const values = [source.x, source.y, source.width, source.height];
  if (
    values.some((value) => !Number.isSafeInteger(value))
    || source.x < 0
    || source.y < 0
    || source.width <= 0
    || source.height <= 0
    || source.x + source.width > surface.width
    || source.y + source.height > surface.height
  ) {
    throw new Error('The PDF basemap crop is outside its rendered map region.');
  }
}

function compositeChannel(channel: number, alpha: number): number {
  if (alpha === 255) return channel;
  if (alpha === 0) return 255;
  return Math.round((channel * alpha + 255 * (255 - alpha)) / 255);
}

function predictorRows(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  previous: Uint8Array,
): Uint8Array {
  const rowStride = width * 3 + 1;
  const output = new Uint8Array(rowStride * height);
  for (let row = 0; row < height; row += 1) {
    const outputRow = row * rowStride;
    output[outputRow] = 2;
    for (let column = 0; column < width; column += 1) {
      const sourcePixel = (row * width + column) * 4;
      const targetPixel = outputRow + 1 + column * 3;
      const previousPixel = column * 3;
      const alpha = pixels[sourcePixel + 3] ?? 0;
      for (let channel = 0; channel < 3; channel += 1) {
        const value = compositeChannel(pixels[sourcePixel + channel] ?? 0, alpha);
        output[targetPixel + channel] = (value - (previous[previousPixel + channel] ?? 0) + 256) & 0xFF;
        previous[previousPixel + channel] = value;
      }
    }
  }
  return output;
}

async function encodeLosslessRgb(
  surface: HTMLCanvasElement,
  source: PixelRegion,
  signal: AbortSignal | undefined,
): Promise<readonly Uint8Array[]> {
  validateSourceRegion(surface, source);
  const context = surface.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('The browser cannot read the native PDF basemap region.');

  const chunks: Uint8Array[] = [];
  let isFinal = false;
  const compressor = new Zlib({ level: 9 }, (chunk, final) => {
    if (chunk.length > 0) chunks.push(chunk);
    isFinal = final;
  });
  const previous = new Uint8Array(source.width * 3);

  for (let row = 0; row < source.height; row += ROW_BATCH_SIZE) {
    throwIfCancelled(signal);
    const height = Math.min(ROW_BATCH_SIZE, source.height - row);
    let pixels: Uint8ClampedArray;
    try {
      pixels = context.getImageData(source.x, source.y + row, source.width, height).data;
    } catch {
      throw new Error('The browser could not read the native PDF basemap pixels.');
    }
    const isFinalBlock = row + height === source.height;
    compressor.push(predictorRows(pixels, source.width, height, previous), isFinalBlock);
    if (!isFinalBlock) await yieldToBrowserTask();
  }

  throwIfCancelled(signal);
  if (!isFinal || chunks.length === 0) {
    throw new Error('The browser could not compress the lossless PDF basemap region.');
  }
  return chunks;
}

export async function createLosslessPdfRaster(options: LosslessPdfRasterOptions): Promise<Readonly<{
  images: readonly LosslessPdfRasterImage[];
  output: Readonly<{ width: number; height: number }>;
}>> {
  const { preflight, renderTile, signal, onProgress, onStage } = options;
  throwIfCancelled(signal);
  const { dimensions, plan } = requireSafePdfPlan(preflight);
  const images: LosslessPdfRasterImage[] = [];

  await composeRasterTiles(plan, {
    renderTile: async (request) => {
      onStage?.('rendering');
      const surface = await renderTile(request);
      validateSurface(surface, request.region);
      return {
        value: surface,
        release: () => {
          surface.width = 0;
          surface.height = 0;
        },
      };
    },
    writeTile: async ({ tile, resource, source, destination }) => {
      onStage?.('encoding');
      const bytes = await encodeLosslessRgb(resource, source, signal);
      images.push({
        bytes,
        destination,
        height: source.height,
        resourceName: `BasemapImage${tile.index}`,
        width: source.width,
      });
    },
    onProgress,
  }, { signal });

  return {
    images,
    output: { width: dimensions.widthPx, height: dimensions.heightPx },
  };
}
