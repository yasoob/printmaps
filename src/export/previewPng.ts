import { getPixelSurfaceAllocationIssue } from './preflight';
import type { MapRenderSnapshot, MapRenderSnapshotOptions } from '../map/MapRenderSnapshot';
import type { VectorBasemapCapture } from './vector/scene';

export type PreviewPng = {
  blob: Blob;
  width: number;
  height: number;
  surface: HTMLCanvasElement;
  projectToFrame?: (coordinate: readonly [number, number]) => Readonly<{ x: number; y: number }>;
  referenceLongitude?: number;
};

export type PrintTileRenderRequest = Readonly<{
  output: Readonly<{ width: number; height: number }>;
  region: Readonly<{ x: number; y: number; width: number; height: number }>;
  signal?: AbortSignal;
}>;

export type PrintTileRenderer = (request: PrintTileRenderRequest) => Promise<HTMLCanvasElement>;

export type PrintTileExportPlan = Readonly<{
  content?: 'composite' | 'basemap';
  output: PrintTileRenderRequest['output'];
  pixelsPerMillimetre: number;
  regions: readonly PrintTileRenderRequest['region'][];
  signal?: AbortSignal;
  symbolBufferPx?: number;
  symbolsVisible: boolean;
}>;

export type PreviewPngExporter = ((
  options?: Readonly<{
    content?: 'composite' | 'basemap';
    signal?: AbortSignal;
  }>,
) => Promise<PreviewPng>) & {
  createPrintTileRenderer?: (plan: PrintTileExportPlan) => PrintTileRenderer;
  captureRenderSnapshot?: (options?: MapRenderSnapshotOptions) => MapRenderSnapshot;
  captureVectorBasemap?: (options?: Readonly<{ signal?: AbortSignal }>) => Promise<VectorBasemapCapture>;
};

type PreviewCaptureOptions = Readonly<{
  projectToCanvas?: (coordinate: readonly [number, number]) => Readonly<{ x: number; y: number }>;
  referenceLongitude?: number;
}>;

type PreviewCrop = {
  frameX: number;
  frameY: number;
  frameWidth: number;
  frameHeight: number;
  scaleX: number;
  scaleY: number;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
};

const unavailableError = () => new Error('The print frame is not ready to export.');

function releaseOutput(output: HTMLCanvasElement): void {
  output.width = 0;
  output.height = 0;
}

function hasRenderableBounds(
  mapCanvas: HTMLCanvasElement,
  canvasRect: DOMRect,
  frameRect: DOMRect,
): boolean {
  const dimensions = [
    mapCanvas.width,
    mapCanvas.height,
    canvasRect.width,
    canvasRect.height,
    frameRect.width,
    frameRect.height,
  ];
  return dimensions.every((dimension) => dimension > 0);
}

function calculateCrop(canvasRect: DOMRect, frameRect: DOMRect, mapCanvas: HTMLCanvasElement): PreviewCrop | null {
  const intersectionLeft = Math.max(canvasRect.left, frameRect.left);
  const intersectionTop = Math.max(canvasRect.top, frameRect.top);
  const intersectionRight = Math.min(canvasRect.right, frameRect.right);
  const intersectionBottom = Math.min(canvasRect.bottom, frameRect.bottom);
  if (intersectionRight <= intersectionLeft || intersectionBottom <= intersectionTop) return null;

  const scaleX = mapCanvas.width / canvasRect.width;
  const scaleY = mapCanvas.height / canvasRect.height;
  const sourceX = (intersectionLeft - canvasRect.left) * scaleX;
  const sourceY = (intersectionTop - canvasRect.top) * scaleY;
  const sourceWidth = (intersectionRight - intersectionLeft) * scaleX;
  const sourceHeight = (intersectionBottom - intersectionTop) * scaleY;
  const cropValues = [scaleX, scaleY, sourceX, sourceY, sourceWidth, sourceHeight];
  if (cropValues.some((value) => !Number.isFinite(value)) || sourceWidth <= 0 || sourceHeight <= 0) return null;

  return {
    frameX: intersectionLeft - canvasRect.left,
    frameY: intersectionTop - canvasRect.top,
    frameWidth: intersectionRight - intersectionLeft,
    frameHeight: intersectionBottom - intersectionTop,
    scaleX,
    scaleY,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    width: Math.round(sourceWidth),
    height: Math.round(sourceHeight),
  };
}

/**
Crops the live map only; callers paint the shared map credit (export/studioComposition) on top.
*/
function drawPreview(context: CanvasRenderingContext2D, mapCanvas: HTMLCanvasElement, crop: PreviewCrop): void {
  context.drawImage(
    mapCanvas,
    crop.sourceX,
    crop.sourceY,
    crop.sourceWidth,
    crop.sourceHeight,
    0,
    0,
    crop.width,
    crop.height,
  );
}

function encodePreview(output: HTMLCanvasElement, width: number, height: number): Promise<PreviewPng> {
  return new Promise((resolve, reject) => {
    try {
      output.toBlob((blob) => {
        if (blob) resolve({ blob, width, height, surface: output });
        else {
          releaseOutput(output);
          reject(new Error('The browser could not create the PNG file.'));
        }
      }, 'image/png');
    } catch {
      releaseOutput(output);
      reject(new Error('The browser could not create the PNG file.'));
    }
  });
}

export async function capturePrintFramePng(
  mapCanvas: HTMLCanvasElement,
  printFrame: HTMLElement,
  options: PreviewCaptureOptions = {},
): Promise<PreviewPng> {
  const canvasRect = mapCanvas.getBoundingClientRect();
  const frameRect = printFrame.getBoundingClientRect();
  if (!hasRenderableBounds(mapCanvas, canvasRect, frameRect)) throw unavailableError();

  const crop = calculateCrop(canvasRect, frameRect, mapCanvas);
  if (!crop) throw unavailableError();
  if (crop.width < 120 || crop.height < 48) {
    throw new Error('The rendered print frame is too small to export with useful map content and legible attribution.');
  }
  const allocationIssue = getPixelSurfaceAllocationIssue(crop.width, crop.height);
  if (allocationIssue) {
    throw new Error(`The rendered print frame is too large to export safely. ${allocationIssue.message}`);
  }

  const output = document.createElement('canvas');
  output.width = crop.width;
  output.height = crop.height;
  const context = output.getContext('2d');
  if (!context) {
    releaseOutput(output);
    throw new Error('PNG export is unavailable in this browser.');
  }

  try {
    drawPreview(context, mapCanvas, crop);
  } catch {
    releaseOutput(output);
    throw new Error('The browser could not render the PNG. The map canvas may be unavailable or blocked by its source.');
  }

  const preview = await encodePreview(output, crop.width, crop.height);
  if (!options.projectToCanvas) return preview;
  return {
    ...preview,
    referenceLongitude: options.referenceLongitude,
    projectToFrame: (coordinate: readonly [number, number]) => {
      const point = options.projectToCanvas!(coordinate);
      return {
        x: (point.x - crop.frameX) / crop.frameWidth,
        y: (point.y - crop.frameY) / crop.frameHeight,
      };
    },
  };
}

export function startPreviewDownload(blob: Blob, filename: string) {
  const safeFilename = filename
    .replaceAll(/[^a-z0-9._-]+/gi, '-')
    .replaceAll(/^[-.]+|[-.]+$/g, '') || 'map-preview.png';
  const downloadName = safeFilename.toLowerCase().endsWith('.png') ? safeFilename : `${safeFilename}.png`;
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    link.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
