import type { ExportPreflightResult, ExportTilePlan } from './preflight';
import type { RasterProgress, RasterTileRenderRequest } from './rasterCompositor';
import { planStreamingPngStrips } from './streamingPngPlan';
import { StreamingPngWriter, type LargeRasterWritable } from './streamingPngWriter';

export type { LargeRasterWritable } from './streamingPngWriter';
export type LargeRasterStage = 'rendering' | 'encoding' | 'writing';

export type LargeRasterRegion = Readonly<{
  tile: RasterTileRenderRequest['tile'];
  region: RasterTileRenderRequest['region'];
  source: Readonly<{ x: number; y: number; width: number; height: number }>;
  destination: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;

type Options = Readonly<{
  preflight: ExportPreflightResult;
  renderTile: (request: RasterTileRenderRequest) => PromiseLike<HTMLCanvasElement>;
  writable: LargeRasterWritable;
  signal?: AbortSignal;
  onProgress?: (progress: RasterProgress) => void | PromiseLike<void>;
  onStage?: (stage: LargeRasterStage) => void;
}>;

type SaveFilePicker = (options: Readonly<{
  suggestedName: string;
  types: readonly Readonly<{
    description: string;
    accept: Readonly<Record<string, readonly string[]>>;
  }>[];
}>) => PromiseLike<Readonly<{ createWritable: () => PromiseLike<LargeRasterWritable> }>>;


function saveFilePicker(): SaveFilePicker | undefined {
  return (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
}

function pngFilename(filename: string): string {
  const stem = filename
    .replaceAll(/\.(?:png|zip)$/gi, '')
    .replaceAll(/[^a-z0-9._-]+/gi, '-')
    .replaceAll(/^[-.]+|[-.]+$/g, '') || 'map';
  return `${stem}.png`;
}

export function canStreamLargeRasterPng(): boolean {
  return typeof saveFilePicker() === 'function' && typeof CompressionStream === 'function';
}

export async function pickLargeRasterPngFile(filename: string): Promise<LargeRasterWritable> {
  const picker = saveFilePicker();
  if (!picker || typeof CompressionStream !== 'function') {
    throw new Error('Large single-PNG export requires Chrome or Edge with streaming compression and the File System Access API.');
  }
  const handle = await picker.call(window, {
    suggestedName: pngFilename(filename),
    types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }],
  });
  return handle.createWritable();
}

function abortError(): DOMException {
  return new DOMException('Large PNG export was cancelled.', 'AbortError');
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortError();
}

function requireStreamingPlan(preflight: ExportPreflightResult) {
  if (
    preflight.format !== 'png'
    || preflight.delivery !== 'streaming-png'
    || !preflight.safe
    || !preflight.dimensions
    || !preflight.plan
  ) throw new Error('Large streamed PNG preflight must pass before rendering.');
  return { dimensions: preflight.dimensions, plan: preflight.plan };
}

function maximumContentHeight(plan: ExportTilePlan): number {
  let maximum = 1;
  for (const tile of plan.tiles) maximum = Math.max(maximum, tile.height);
  return maximum;
}

export function createLargeRasterPngRegions(preflight: ExportPreflightResult): readonly LargeRasterRegion[] {
  const { dimensions, plan } = requireStreamingPlan(preflight);
  const columns = plan.tiles.filter((tile) => tile.row === 0);
  const { stripCount, stripHeight } = planStreamingPngStrips(
    dimensions.widthPx,
    dimensions.heightPx,
    maximumContentHeight(plan),
  );
  const regions: LargeRasterRegion[] = [];
  for (let row = 0; row < stripCount; row += 1) {
    const y = row * stripHeight;
    const height = Math.min(stripHeight, dimensions.heightPx - y);
    for (const column of columns) {
      const renderX = Math.max(0, column.x - plan.overlapPx);
      const renderY = Math.max(0, y - plan.overlapPx);
      const renderRight = Math.min(dimensions.widthPx, column.x + column.width + plan.overlapPx);
      const renderBottom = Math.min(dimensions.heightPx, y + height + plan.overlapPx);
      regions.push({
        tile: { index: regions.length, column: column.column, row },
        region: { x: renderX, y: renderY, width: renderRight - renderX, height: renderBottom - renderY },
        source: { x: column.x - renderX, y: y - renderY, width: column.width, height },
        destination: { x: column.x, y, width: column.width, height },
      });
    }
  }
  return regions;
}

function validateSurface(surface: HTMLCanvasElement, region: LargeRasterRegion['region']): void {
  if (surface instanceof HTMLCanvasElement && surface.width === region.width && surface.height === region.height) return;
  throw new Error('The native map renderer returned an invalid target-resolution tile.');
}

function copyPixels(target: Uint8Array, outputWidth: number, pixels: Uint8ClampedArray, region: LargeRasterRegion): void {
  for (let row = 0; row < region.destination.height; row += 1) {
    const sourceStart = row * region.destination.width * 4;
    const targetStart = (row * outputWidth + region.destination.x) * 4;
    target.set(pixels.subarray(sourceStart, sourceStart + region.destination.width * 4), targetStart);
  }
}

function attributionPixels(width: number, height: number, attributions: readonly string[]) {
  const text = attributions.join(' · ').replaceAll(/\s+/g, ' ').trim();
  if (!text) throw new Error('Map attribution is unavailable, so this PNG cannot be exported.');
  const scale = Math.max(1, Math.min(4, width / 600, height / 400));
  const padding = Math.max(4, Math.round(4 * scale));
  const fontSize = Math.max(8, Math.round(8 * scale));
  const barHeight = Math.max(14, fontSize + padding);
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(width, 4096);
  canvas.height = barHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('The browser cannot render PNG attribution.');
  const style = getComputedStyle(document.documentElement);
  context.fillStyle = style.getPropertyValue('--studio-surface').trim() || '#ffffff';
  context.fillRect(0, 0, canvas.width, barHeight);
  context.fillStyle = style.getPropertyValue('--studio-text-secondary').trim() || '#666666';
  context.font = `${fontSize}px sans-serif`;
  context.textBaseline = 'middle';
  context.fillText(text, padding, barHeight / 2, canvas.width - padding * 2);
  const pixels = context.getImageData(0, 0, canvas.width, barHeight).data;
  canvas.width = 0;
  canvas.height = 0;
  return { barHeight, pixels, width: Math.min(width, 4096) };
}

function applyAttribution(strip: Uint8Array, outputWidth: number, stripHeight: number, attribution: ReturnType<typeof attributionPixels>): void {
  const startRow = stripHeight - attribution.barHeight;
  const background = attribution.pixels.subarray(0, 4);
  for (let row = 0; row < attribution.barHeight; row += 1) {
    const rowStart = (startRow + row) * outputWidth * 4;
    for (let x = 0; x < outputWidth; x += 1) strip.set(background, rowStart + x * 4);
    const sourceStart = row * attribution.width * 4;
    strip.set(attribution.pixels.subarray(sourceStart, sourceStart + attribution.width * 4), rowStart);
  }
}

type RenderedStrip = { y: number; height: number; pixels: Uint8Array };

async function encodeStrip(options: Readonly<{
  writer: StreamingPngWriter;
  strip: RenderedStrip;
  width: number;
  signal?: AbortSignal;
}>): Promise<void> {
  const { writer, strip, width, signal } = options;
  let y = 0;
  const rows = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (y >= strip.height) {
        controller.close();
        return;
      }
      throwIfCancelled(signal);
      const row = new Uint8Array(width * 4 + 1);
      row.set(strip.pixels.subarray(y * width * 4, (y + 1) * width * 4), 1);
      y += 1;
      controller.enqueue(row);
    },
  });
  await rows.pipeTo(new WritableStream({ write: (row) => writer.row(row) }));
}

async function renderIntoStrip(options: Readonly<{
  region: LargeRasterRegion;
  renderTile: Options['renderTile'];
  strip: RenderedStrip;
  width: number;
  signal?: AbortSignal;
}>): Promise<void> {
  const { region, renderTile, signal, strip, width } = options;
  const surface = await renderTile({ tile: region.tile, region: region.region, signal });
  try {
    validateSurface(surface, region.region);
    const context = surface.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('The browser cannot read a native print tile.');
    const pixels = context.getImageData(region.source.x, region.source.y, region.source.width, region.source.height).data;
    copyPixels(strip.pixels, width, pixels, region);
  } finally {
    surface.width = 0;
    surface.height = 0;
  }
}

function requireRenderedStrip(strip: RenderedStrip | null): RenderedStrip {
  if (!strip) throw new Error('The streamed PNG strip was not initialized.');
  return strip;
}

async function beginStrip(options: Readonly<{
  previous: RenderedStrip | null;
  region: LargeRasterRegion;
  writer: StreamingPngWriter;
  width: number;
  signal?: AbortSignal;
}>): Promise<RenderedStrip> {
  const { previous, region, signal, width, writer } = options;
  if (previous) await encodeStrip({ writer, strip: previous, width, signal });
  return {
    y: region.destination.y,
    height: region.destination.height,
    pixels: new Uint8Array(width * region.destination.height * 4),
  };
}

async function abortWithoutMasking(
  writer: StreamingPngWriter | null,
  writable: LargeRasterWritable,
  error: unknown,
): Promise<void> {
  try {
    if (writer) await writer.abort(error);
    else await writable.abort(error);
  } catch {
    // Preserve the initialization, render, encode, or finalization failure.
  }
}

export async function createLargeRasterPng(options: Options): Promise<Readonly<{
  width: number; height: number; renderCount: number; bytesWritten: number;
}>> {
  const { preflight, renderTile, writable, signal, onProgress, onStage } = options;
  let completedTiles = 0;
  let currentY = -1;
  let strip: RenderedStrip | null = null;
  let writer: StreamingPngWriter | null = null;
  try {
    const { dimensions } = requireStreamingPlan(preflight);
    const regions = createLargeRasterPngRegions(preflight);
    writer = new StreamingPngWriter(writable);
    const attribution = attributionPixels(dimensions.widthPx, dimensions.heightPx, preflight.attributions);
    await writer.start(dimensions.widthPx, dimensions.heightPx);
    for (const region of regions) {
      throwIfCancelled(signal);
      if (region.destination.y !== currentY) {
        onStage?.('encoding');
        strip = await beginStrip({ previous: strip, region, writer, width: dimensions.widthPx, signal });
        currentY = region.destination.y;
      }
      onStage?.('rendering');
      await renderIntoStrip({ region, renderTile, strip: requireRenderedStrip(strip), width: dimensions.widthPx, signal });
      completedTiles += 1;
      await onProgress?.({ completedTiles, totalTiles: regions.length, fraction: completedTiles / regions.length, tile: region.tile });
    }
    if (strip) {
      onStage?.('encoding');
      applyAttribution(strip.pixels, dimensions.widthPx, strip.height, attribution);
      await encodeStrip({ writer, strip, width: dimensions.widthPx, signal });
    }
    onStage?.('writing');
    throwIfCancelled(signal);
    await writer.close(signal);
    return { width: dimensions.widthPx, height: dimensions.heightPx, renderCount: regions.length, bytesWritten: writer.bytesWritten };
  } catch (error) {
    await abortWithoutMasking(writer, writable, error);
    throw error;
  }
}
