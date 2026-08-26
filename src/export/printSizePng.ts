import { getPixelSurfaceAllocationIssue, type ExportPreflightResult } from './preflight';
import type { PreviewPng } from './previewPng';
import {
  composeRasterTiles,
  type RasterProgress,
  type RasterTileRenderRequest,
} from './rasterCompositor';
import { embedPngPhysicalResolution } from './pngPhysicalResolution';

const PRINT_PNG_DPI = 300;

type SharedPrintSizePngOptions = Readonly<{
  preflight: ExportPreflightResult;
  signal?: AbortSignal;
  onProgress?: (progress: RasterProgress) => void | PromiseLike<void>;
  onStage?: (stage: PrintSizePngStage) => void;
}>;

export type PrintSizePngStage = 'rendering' | 'composing' | 'encoding';

export type NativePrintTileRenderer = (
  request: RasterTileRenderRequest,
) => PromiseLike<HTMLCanvasElement>;

export type PrintSizePngOptions = SharedPrintSizePngOptions & (
  | Readonly<{ renderTile: NativePrintTileRenderer; source?: never }>
  | Readonly<{ renderTile?: never; source: PreviewPng }>
);

function abortError(): DOMException {
  return new DOMException('Print-size PNG export was cancelled.', 'AbortError');
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw abortError();
}

function encodePng(
  surface: HTMLCanvasElement,
  width: number,
  height: number,
  signal: AbortSignal | undefined,
): Promise<PreviewPng> {
  return new Promise((resolve, reject) => {
    try {
      surface.toBlob((blob) => {
        if (signal?.aborted === true) {
          reject(abortError());
          return;
        }
        if (!blob) {
          reject(new Error('The browser could not create the print-size PNG file.'));
          return;
        }
        void embedPngPhysicalResolution(blob, PRINT_PNG_DPI).then((metadataBlob) => {
          if (signal?.aborted === true) reject(abortError());
          else resolve({ blob: metadataBlob, width, height, surface });
        }).catch(() => reject(new Error('The browser could not create the print-size PNG file.')));
      }, 'image/png');
    } catch {
      reject(new Error('The browser could not create the print-size PNG file.'));
    }
  });
}

function requireSafePlan(preflight: ExportPreflightResult) {
  if (preflight.format !== 'png' || !preflight.safe || !preflight.dimensions || !preflight.plan) {
    throw new Error('Export preflight must pass before a print-size PNG surface is allocated.');
  }
  return { dimensions: preflight.dimensions, plan: preflight.plan };
}

function validateSource(source: PreviewPng): void {
  if (
    !(source.surface instanceof HTMLCanvasElement)
    || !Number.isSafeInteger(source.width)
    || !Number.isSafeInteger(source.height)
    || source.width <= 0
    || source.height <= 0
    || source.surface.width !== source.width
    || source.surface.height !== source.height
  ) {
    throw new Error('The browser preview is not a valid raster source for print-size export.');
  }
}

function validateRenderedTile(surface: HTMLCanvasElement, region: RasterTileRenderRequest['region']): void {
  if (
    surface instanceof HTMLCanvasElement
    && surface.width === region.width
    && surface.height === region.height
  ) {
    return;
  }
  if (surface instanceof HTMLCanvasElement) {
    surface.width = 0;
    surface.height = 0;
  }
  throw new Error('The native map renderer returned an invalid target-resolution tile.');
}

function reportComposingStage(
  surface: HTMLCanvasElement,
  onStage: SharedPrintSizePngOptions['onStage'],
): void {
  try {
    onStage?.('composing');
  } catch (error) {
    surface.width = 0;
    surface.height = 0;
    throw error;
  }
}

function createSurface(width: number, height: number, unavailableMessage: string) {
  const surface = document.createElement('canvas');
  try {
    surface.width = width;
    surface.height = height;
    const context = surface.getContext('2d');
    if (!context) throw new Error(unavailableMessage);
    return { surface, context };
  } catch {
    surface.width = 0;
    surface.height = 0;
    throw new Error(unavailableMessage);
  }
}

function drawNativeAttribution(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  attributions: readonly string[],
): void {
  const text = attributions.join(' · ').replaceAll(/\s+/g, ' ').trim();
  if (!text) throw new Error('Map attribution is unavailable, so this PNG cannot be exported.');
  const pixelScale = Math.max(1, Math.min(width / 600, height / 400));
  const padding = Math.max(4, Math.round(4 * pixelScale));
  let fontSize = Math.max(8, Math.round(8 * pixelScale));
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

export async function createPrintSizePng({
  source,
  renderTile,
  preflight,
  signal,
  onProgress,
  onStage,
}: PrintSizePngOptions): Promise<PreviewPng> {
  throwIfCancelled(signal);
  const { dimensions, plan } = requireSafePlan(preflight);
  if (source) validateSource(source);
  const allocationIssue = getPixelSurfaceAllocationIssue(dimensions.widthPx, dimensions.heightPx);
  if (allocationIssue) {
    throw new Error(`The print-size PNG cannot be allocated safely. ${allocationIssue.message}`);
  }

  const { surface: output, context: outputContext } = createSurface(
    dimensions.widthPx,
    dimensions.heightPx,
    'PNG composition is unavailable in this browser.',
  );

  try {
    await composeRasterTiles(plan, {
      renderTile: async (request) => {
        const { region } = request;
        throwIfCancelled(signal);
        onStage?.('rendering');
        if (renderTile) {
          const tileSurface = await renderTile(request);
          validateRenderedTile(tileSurface, region);
          reportComposingStage(tileSurface, onStage);
          return {
            value: tileSurface,
            release: () => {
              tileSurface.width = 0;
              tileSurface.height = 0;
            },
          };
        }
        if (!source) throw new Error('A native map tile renderer is required for print-size PNG export.');
        const { surface: tileSurface, context: tileContext } = createSurface(
          region.width,
          region.height,
          'PNG tile rendering is unavailable in this browser.',
        );
        try {
          tileContext.drawImage(
            source.surface,
            region.x / dimensions.widthPx * source.width,
            region.y / dimensions.heightPx * source.height,
            region.width / dimensions.widthPx * source.width,
            region.height / dimensions.heightPx * source.height,
            0,
            0,
            region.width,
            region.height,
          );
        } catch {
          tileSurface.width = 0;
          tileSurface.height = 0;
          throw new Error('The browser could not render a print-size PNG tile.');
        }
        reportComposingStage(tileSurface, onStage);
        return {
          value: tileSurface,
          release: () => {
            tileSurface.width = 0;
            tileSurface.height = 0;
          },
        };
      },
      writeTile: ({ resource, source: sourceRegion, destination }) => {
        try {
          outputContext.drawImage(
            resource,
            sourceRegion.x,
            sourceRegion.y,
            sourceRegion.width,
            sourceRegion.height,
            destination.x,
            destination.y,
            destination.width,
            destination.height,
          );
        } catch {
          throw new Error('The browser could not compose the print-size PNG.');
        }
      },
      onProgress,
    }, { signal });

    throwIfCancelled(signal);
    if (renderTile) drawNativeAttribution(
      outputContext,
      dimensions.widthPx,
      dimensions.heightPx,
      preflight.attributions,
    );
    onStage?.('encoding');
    return await encodePng(output, dimensions.widthPx, dimensions.heightPx, signal);
  } catch (error) {
    output.width = 0;
    output.height = 0;
    throw error;
  }
}
