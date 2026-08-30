import { writePsdUint8Array, type Layer, type LinkedFile, type Psd } from 'ag-psd';
import type { ProjectDocument } from '../domain/project';
import type { ExportPreflightResult } from './preflight';
import type { PreviewPng } from './previewPng';
import { composeRasterTiles, type RasterProgress, type RasterTileRenderRequest } from './rasterCompositor';
import {
  createPsdSurface,
  releasePsdSurface,
  throwIfPsdCancelled,
} from './layeredPsdCanvas';
import {
  createPsdSvgRasterLayers,
  psdLayerOpacity,
  rasterizePsdSvgLayer,
} from './layeredPsdSvg';
import { createPsdSmartObject, type PsdSmartObject } from './layeredPsdSmartObject';

type ReadyPsdPreflight = ExportPreflightResult & {
  dimensions: NonNullable<ExportPreflightResult['dimensions']>;
  plan: NonNullable<ExportPreflightResult['plan']>;
};

type PsdRasterLayer = Readonly<{
  canvas: HTMLCanvasElement;
  hidden: boolean;
  name: string;
  opacity: number;
  smartObject?: PsdSmartObject;
}>;

export type LayeredPsdOptions = Readonly<{
  effectiveDpi: number;
  preflight: ExportPreflightResult;
  renderTile: (request: RasterTileRenderRequest) => PromiseLike<HTMLCanvasElement>;
  signal?: AbortSignal;
  onProgress?: (progress: RasterProgress) => void | PromiseLike<void>;
  onStage?: (stage: 'basemap' | 'layers' | 'packaging', detail?: string) => void;
}>;

function requireReadyPreflight(preflight: ExportPreflightResult): ReadyPsdPreflight {
  if (preflight.format !== 'psd' || !preflight.safe || !preflight.dimensions || !preflight.plan) {
    throw new Error('Layered PSD preflight must pass before document surfaces are allocated.');
  }
  return {
    ...preflight,
    dimensions: preflight.dimensions,
    plan: preflight.plan,
  };
}

function validateCapture(
  capture: PreviewPng,
): asserts capture is PreviewPng & Required<Pick<PreviewPng, 'projectToFrame'>> {
  if (!capture.projectToFrame) {
    throw new Error('The map projection is not ready for layered PSD export. Reload the map and try again.');
  }
}

function validateRenderedTile(
  surface: HTMLCanvasElement,
  region: RasterTileRenderRequest['region'],
): void {
  if (
    surface instanceof HTMLCanvasElement
    && surface.width === region.width
    && surface.height === region.height
  ) return;
  if (surface instanceof HTMLCanvasElement) releasePsdSurface(surface);
  throw new Error('The native map renderer returned an invalid PSD basemap region.');
}

async function composeBasemap(
  preflight: ReadyPsdPreflight,
  options: LayeredPsdOptions,
): Promise<HTMLCanvasElement> {
  const { widthPx, heightPx } = preflight.dimensions;
  const { context, surface } = createPsdSurface(widthPx, heightPx);
  try {
    await composeRasterTiles(preflight.plan, {
      renderTile: async (request) => {
        options.onStage?.('basemap');
        const tile = await options.renderTile(request);
        validateRenderedTile(tile, request.region);
        return { value: tile, release: () => releasePsdSurface(tile) };
      },
      writeTile: ({ resource, source, destination }) => {
        context.drawImage(
          resource,
          source.x,
          source.y,
          source.width,
          source.height,
          destination.x,
          destination.y,
          destination.width,
          destination.height,
        );
      },
      onProgress: options.onProgress,
    }, { signal: options.signal });
    return surface;
  } catch (error) {
    releasePsdSurface(surface);
    throw error;
  }
}

function drawCompositeLayer(
  context: CanvasRenderingContext2D,
  layer: PsdRasterLayer,
): void {
  if (layer.hidden) return;
  context.globalAlpha = layer.opacity;
  context.drawImage(layer.canvas, 0, 0);
  context.globalAlpha = 1;
}

function psdLayer(layer: PsdRasterLayer): Layer {
  return {
    canvas: layer.canvas,
    hidden: layer.hidden,
    name: layer.name,
    opacity: layer.opacity,
    ...(layer.smartObject && { placedLayer: layer.smartObject.placedLayer }),
  };
}

function psdBlobBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.buffer instanceof ArrayBuffer) {
    if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) return bytes.buffer;
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  return Uint8Array.from(bytes).buffer;
}

function yieldToBrowserTask(): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 0));
}

export async function createLayeredPsd(
  document: ProjectDocument,
  capture: PreviewPng,
  options: LayeredPsdOptions,
): Promise<Blob> {
  validateCapture(capture);
  const preflight = requireReadyPreflight(options.preflight);
  if (!Number.isFinite(options.effectiveDpi) || options.effectiveDpi <= 0) {
    throw new Error('Layered PSD resolution must be a finite positive value.');
  }
  const basemapLayer = document.layers.find(({ type }) => type === 'basemap');
  if (!basemapLayer || document.layers.filter(({ type }) => type === 'basemap').length !== 1) {
    throw new Error('The project must contain exactly one basemap for layered PSD export.');
  }
  const output = {
    width: preflight.dimensions.widthPx,
    height: preflight.dimensions.heightPx,
  };
  const ownedSurfaces: HTMLCanvasElement[] = [];
  try {
    throwIfPsdCancelled(options.signal);
    const basemap = await composeBasemap(preflight, options);
    ownedSurfaces.push(basemap);
    const { context: compositeContext, surface: composite } = createPsdSurface(output.width, output.height);
    ownedSurfaces.push(composite);
    const basemapLayerSource: PsdRasterLayer = {
      canvas: basemap,
      hidden: !basemapLayer.visible,
      name: basemapLayer.name,
      opacity: psdLayerOpacity(basemapLayer),
    };
    const smartObjectLayers: Array<PsdRasterLayer & { role: 'content' | 'attribution' }> = [];
    const linkedFiles: LinkedFile[] = [];

    const svgLayers = createPsdSvgRasterLayers(document, capture, output);
    for (const [index, svgLayer] of svgLayers.entries()) {
      throwIfPsdCancelled(options.signal);
      options.onStage?.('layers', svgLayer.name);
      const canvas = await rasterizePsdSvgLayer(svgLayer, output, options.signal);
      ownedSurfaces.push(canvas);
      const smartObject = createPsdSmartObject(svgLayer, {
        documentId: document.id,
        effectiveDpi: options.effectiveDpi,
        index,
        output,
      });
      linkedFiles.push(smartObject.linkedFile);
      const layer = { ...svgLayer, canvas, smartObject };
      smartObjectLayers.push(layer);
    }
    const contentLayers = smartObjectLayers.filter(({ role }) => role === 'content');
    const attributionLayer = smartObjectLayers.find(({ role }) => role === 'attribution');
    if (!attributionLayer) throw new Error('The PSD attribution layer is unavailable.');

    drawCompositeLayer(compositeContext, basemapLayerSource);
    for (let index = contentLayers.length - 1; index >= 0; index -= 1) {
      const layer = contentLayers[index];
      if (layer) drawCompositeLayer(compositeContext, layer);
    }
    drawCompositeLayer(compositeContext, attributionLayer);

    throwIfPsdCancelled(options.signal);
    options.onStage?.('packaging');
    await yieldToBrowserTask();
    throwIfPsdCancelled(options.signal);
    const children: Layer[] = [
      psdLayer(attributionLayer),
      ...contentLayers.map((layer) => psdLayer(layer)),
      psdLayer(basemapLayerSource),
    ];
    const psd: Psd = {
      width: output.width,
      height: output.height,
      canvas: composite,
      children,
      linkedFiles,
      imageResources: {
        resolutionInfo: {
          horizontalResolution: options.effectiveDpi,
          horizontalResolutionUnit: 'PPI',
          widthUnit: 'Inches',
          verticalResolution: options.effectiveDpi,
          verticalResolutionUnit: 'PPI',
          heightUnit: 'Inches',
        },
      },
    };
    const bytes = writePsdUint8Array(psd, {
      generateThumbnail: false,
      noBackground: true,
      trimImageData: true,
    });
    throwIfPsdCancelled(options.signal);
    return new Blob([psdBlobBuffer(bytes)], { type: 'image/vnd.adobe.photoshop' });
  } finally {
    for (const surface of ownedSurfaces) releasePsdSurface(surface);
  }
}

function sanitizeBaseFilename(filename: string): string {
  return filename
    .replace(/(?:\.layered\.(?:svg|psd)|\.(?:svg|psd|png|pdf))$/i, '')
    .replaceAll(/[^a-z0-9._-]+/gi, '-')
    .replaceAll(/^[-.]+|[-.]+$/g, '') || 'map';
}

export function startLayeredPsdDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeBaseFilename(filename)}.layered.psd`;
    link.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
