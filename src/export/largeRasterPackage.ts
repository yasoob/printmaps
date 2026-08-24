import type { ExportPreflightResult } from './preflight';
import {
  composeRasterTiles,
  type RasterProgress,
  type RasterTileRenderRequest,
} from './rasterCompositor';
import { StreamingZipWriter, type StreamingZipSink } from './streamingZip';

export type LargeRasterWritable = StreamingZipSink;
export type LargeRasterStage = 'rendering' | 'encoding' | 'writing';

type Options = Readonly<{
  preflight: ExportPreflightResult;
  renderTile: (request: RasterTileRenderRequest) => PromiseLike<HTMLCanvasElement>;
  writable: LargeRasterWritable;
  signal?: AbortSignal;
  onProgress?: (progress: RasterProgress) => void | PromiseLike<void>;
  onStage?: (stage: LargeRasterStage) => void;
}>;

type ManifestTile = Readonly<{
  file: string;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

const textEncoder = new TextEncoder();

type SaveFilePicker = (options: Readonly<{
  suggestedName: string;
  types: readonly Readonly<{
    description: string;
    accept: Readonly<Record<string, readonly string[]>>;
  }>[];
}>) => PromiseLike<Readonly<{
  createWritable: () => PromiseLike<LargeRasterWritable>;
}>>;

function saveFilePicker(): SaveFilePicker | undefined {
  return (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
}

function packageFilename(filename: string): string {
  const stem = filename
    .replaceAll(/\.(?:png|zip)$/gi, '')
    .replaceAll(/[^a-z0-9._-]+/gi, '-')
    .replaceAll(/^[-.]+|[-.]+$/g, '') || 'map';
  return `${stem}.tiles.zip`;
}

export function canStreamLargeRasterPackage(): boolean {
  return typeof saveFilePicker() === 'function';
}

export async function pickLargeRasterPackageFile(filename: string): Promise<LargeRasterWritable> {
  const picker = saveFilePicker();
  if (!picker) {
    throw new Error('Large-output packages require Chrome or Edge with the File System Access API. Use a supported browser or reduce the page size for a single PNG.');
  }
  const handlePromise = picker.call(window, {
    suggestedName: packageFilename(filename),
    types: [{ description: 'Print map tile package', accept: { 'application/zip': ['.zip'] } }],
  });
  const handle = await handlePromise;
  return handle.createWritable();
}

function abortError(): DOMException {
  return new DOMException('Large raster package export was cancelled.', 'AbortError');
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortError();
}

function requirePackagePlan(preflight: ExportPreflightResult) {
  if (
    preflight.format !== 'png'
    || preflight.delivery !== 'tile-package'
    || !preflight.safe
    || !preflight.dimensions
    || !preflight.plan
  ) {
    throw new Error('Large raster package preflight must pass before rendering.');
  }
  return { dimensions: preflight.dimensions, plan: preflight.plan };
}

function createCanvas(width: number, height: number) {
  const surface = document.createElement('canvas');
  try {
    surface.width = width;
    surface.height = height;
    const context = surface.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable.');
    return { surface, context };
  } catch {
    surface.width = 0;
    surface.height = 0;
    throw new Error('PNG tile encoding is unavailable in this browser.');
  }
}

function validateRenderedTile(surface: HTMLCanvasElement, region: RasterTileRenderRequest['region']): void {
  if (surface instanceof HTMLCanvasElement && surface.width === region.width && surface.height === region.height) return;
  if (surface instanceof HTMLCanvasElement) {
    surface.width = 0;
    surface.height = 0;
  }
  throw new Error('The native map renderer returned an invalid target-resolution tile.');
}

function drawAttribution(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  attributions: readonly string[],
): void {
  const text = attributions.join(' · ').replaceAll(/\s+/g, ' ').trim();
  if (!text) throw new Error('Map attribution is unavailable, so this package cannot be exported.');
  const scale = Math.max(1, Math.min(width / 600, height / 400));
  const padding = Math.max(4, Math.round(4 * scale));
  let fontSize = Math.max(8, Math.round(8 * scale));
  context.font = `${fontSize}px sans-serif`;
  const availableWidth = Math.max(1, width - padding * 2);
  const measuredWidth = context.measureText(text).width;
  if (measuredWidth > availableWidth) {
    fontSize = Math.max(7, Math.floor(fontSize * availableWidth / measuredWidth));
    context.font = `${fontSize}px sans-serif`;
  }
  const barHeight = Math.max(14, fontSize + padding);
  const rootStyle = getComputedStyle(document.documentElement);
  context.globalAlpha = 1;
  context.fillStyle = rootStyle.getPropertyValue('--studio-surface').trim() || '#ffffff';
  context.fillRect(0, height - barHeight, width, barHeight);
  context.fillStyle = rootStyle.getPropertyValue('--studio-text-secondary').trim() || '#666666';
  context.textBaseline = 'middle';
  context.fillText(text, padding, height - barHeight / 2, availableWidth);
}

function encodeTile(surface: HTMLCanvasElement, signal: AbortSignal | undefined): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    try {
      surface.toBlob((blob) => {
        if (signal?.aborted) {
          reject(abortError());
          return;
        }
        if (!blob || blob.type !== 'image/png') {
          reject(new Error('The browser could not encode a PNG tile.'));
          return;
        }
        void blob.arrayBuffer()
          .then((buffer) => resolve(new Uint8Array(buffer)))
          .catch(() => reject(new Error('The browser could not read an encoded PNG tile.')));
      }, 'image/png');
    } catch {
      reject(new Error('The browser could not encode a PNG tile.'));
    }
  });
}

function digits(value: number): number {
  return Math.max(3, String(Math.max(0, value - 1)).length);
}

function tileName(row: number, column: number, rows: number, columns: number): string {
  return `tiles/tile-r${String(row).padStart(digits(rows), '0')}-c${String(column).padStart(digits(columns), '0')}.png`;
}

function manifestJson(options: Readonly<{
  dimensions: Readonly<{ widthPx: number; heightPx: number }>;
  columns: number;
  rows: number;
  overlapPx: number;
  attributionEmbeddedIn: string;
  tiles: readonly ManifestTile[];
}>): Uint8Array {
  const { dimensions, columns, rows, overlapPx, attributionEmbeddedIn, tiles } = options;
  return textEncoder.encode(`${JSON.stringify({
    format: 'print-map-tile-package-v1',
    assembly: { width: dimensions.widthPx, height: dimensions.heightPx, columns, rows },
    units: 'pixels',
    tileOrder: 'row-major',
    overlapRemoved: true,
    sourceRenderOverlapPx: overlapPx,
    attributionEmbeddedIn,
    tiles,
  }, null, 2)}\n`);
}

export async function createLargeRasterPackage(options: Options): Promise<Readonly<{
  width: number;
  height: number;
  tileCount: number;
  bytesWritten: number;
}>> {
  const { preflight, renderTile, writable, signal, onProgress, onStage } = options;
  throwIfCancelled(signal);
  const { dimensions, plan } = requirePackagePlan(preflight);
  const writer = new StreamingZipWriter(writable);
  const manifestTiles: ManifestTile[] = [];
  const attributionTile = tileName(plan.rows - 1, 0, plan.rows, plan.columns);

  try {
    await composeRasterTiles(plan, {
      renderTile: async (request) => {
        throwIfCancelled(signal);
        onStage?.('rendering');
        const surface = await renderTile(request);
        validateRenderedTile(surface, request.region);
        return {
          value: surface,
          release: () => {
            surface.width = 0;
            surface.height = 0;
          },
        };
      },
      writeTile: async ({ tile, resource, source, destination }) => {
        throwIfCancelled(signal);
        const { surface, context } = createCanvas(destination.width, destination.height);
        try {
          context.drawImage(
            resource,
            source.x,
            source.y,
            source.width,
            source.height,
            0,
            0,
            destination.width,
            destination.height,
          );
          const file = tileName(tile.row, tile.column, plan.rows, plan.columns);
          if (file === attributionTile) {
            drawAttribution(context, destination.width, destination.height, preflight.attributions);
          }
          onStage?.('encoding');
          const png = await encodeTile(surface, signal);
          throwIfCancelled(signal);
          onStage?.('writing');
          await writer.add(file, png);
          manifestTiles.push({ file, ...destination });
        } finally {
          surface.width = 0;
          surface.height = 0;
        }
      },
      onProgress,
    }, { signal });

    throwIfCancelled(signal);
    await writer.add('manifest.json', manifestJson({
      dimensions,
      columns: plan.columns,
      rows: plan.rows,
      overlapPx: plan.overlapPx,
      attributionEmbeddedIn: attributionTile,
      tiles: manifestTiles,
    }));
    await writer.close();
    return {
      width: dimensions.widthPx,
      height: dimensions.heightPx,
      tileCount: plan.tiles.length,
      bytesWritten: writer.bytesWritten,
    };
  } catch (error) {
    try {
      await writer.abort(error);
    } catch {
      // Preserve the render, encode, write, or cancellation failure.
    }
    throw error;
  }
}
