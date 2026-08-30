import type { ContentLayer, ProjectDocument } from '../domain/project';
import { projectAttributionText } from '../domain/projectAttributions';
import { serializePrintScene } from '../print/scene';
import {
  createPsdSurface,
  psdAbortError,
  releasePsdSurface,
  throwIfPsdCancelled,
} from './layeredPsdCanvas';
import type { PreviewPng } from './previewPng';

const ONE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

export type PsdSvgRasterLayer = Readonly<{
  hidden: boolean;
  name: string;
  opacity: number;
  role: 'content' | 'attribution';
  svg: string;
}>;

export function psdLayerOpacity(layer: ContentLayer | undefined): number {
  if (!layer) return 1;
  if (!Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 100) {
    throw new Error(`Layer "${layer.name}" has an invalid opacity for layered PSD export.`);
  }
  return layer.opacity / 100;
}

function rootSceneGroups(root: SVGSVGElement): SVGElement[] {
  return [...root.children].filter(
    (child): child is SVGElement => child instanceof SVGElement && child.localName === 'g',
  );
}

function isolateSceneGroup(
  root: SVGSVGElement,
  group: SVGElement,
  definitions: Element | undefined,
  output: Readonly<{ width: number; height: number }>,
): string {
  const isolatedRoot = root.cloneNode(false) as SVGSVGElement;
  isolatedRoot.setAttribute('width', String(output.width));
  isolatedRoot.setAttribute('height', String(output.height));
  if (definitions) isolatedRoot.append(definitions.cloneNode(true));
  const isolatedGroup = group.cloneNode(true) as SVGElement;
  isolatedGroup.removeAttribute('opacity');
  isolatedGroup.removeAttribute('visibility');
  isolatedRoot.append(isolatedGroup);
  return new XMLSerializer().serializeToString(isolatedRoot);
}

function psdLayerRole(role: 'vector-overlay' | 'attribution'): 'content' | 'attribution' {
  return role === 'attribution' ? 'attribution' : 'content';
}

function createPsdSvgRasterLayer(options: Readonly<{
  contentById: ReadonlyMap<string, ContentLayer>;
  definitions: Element | undefined;
  group: SVGElement;
  output: Readonly<{ width: number; height: number }>;
  root: SVGSVGElement;
}>): PsdSvgRasterLayer | null {
  const { contentById, definitions, group, output, root } = options;
  const role = group.dataset.sceneRole;
  if (role === 'raster-basemap') return null;
  if (role !== 'vector-overlay' && role !== 'attribution') {
    throw new Error('The print scene contains an unsupported Photoshop layer.');
  }
  const contentLayer = role === 'vector-overlay'
    ? contentById.get(group.dataset.layerId ?? '')
    : undefined;
  if (role === 'vector-overlay' && !contentLayer) {
    throw new Error('A named print layer is unavailable for layered PSD export.');
  }
  return {
    hidden: contentLayer ? !contentLayer.visible : false,
    name: group.dataset.layerName || contentLayer?.name || 'Layer',
    opacity: psdLayerOpacity(contentLayer),
    role: psdLayerRole(role),
    svg: isolateSceneGroup(root, group, definitions, output),
  };
}

export function createPsdSvgRasterLayers(
  document: ProjectDocument,
  capture: PreviewPng & Required<Pick<PreviewPng, 'projectToFrame'>>,
  output: Readonly<{ width: number; height: number }>,
): PsdSvgRasterLayer[] {
  const scene = serializePrintScene(document, {
    attribution: projectAttributionText(document),
    basemap: { dataUri: ONE_PIXEL_PNG, pixelWidth: 1, pixelHeight: 1 },
    metadata: 'Rasterized named layers for Photoshop export.',
    referenceLongitude: capture.referenceLongitude,
    project: (coordinate, context) => {
      const point = capture.projectToFrame(coordinate);
      return { x: point.x * context.pageWidthMm, y: point.y * context.pageHeightMm };
    },
  });
  const parsed = new DOMParser().parseFromString(scene, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) {
    throw new Error('The browser could not prepare vector artwork for layered PSD export.');
  }
  const root = parsed.documentElement as unknown as SVGSVGElement;
  const definitions = [...root.children].find((child) => child.localName === 'defs');
  const contentById = new Map(document.layers.map((layer) => [layer.id, layer]));
  const layers: PsdSvgRasterLayer[] = [];
  for (const group of rootSceneGroups(root)) {
    const layer = createPsdSvgRasterLayer({ contentById, definitions, group, output, root });
    if (layer) layers.push(layer);
  }
  return layers;
}

export function rasterizePsdSvgLayer(
  layer: PsdSvgRasterLayer,
  output: Readonly<{ width: number; height: number }>,
  signal: AbortSignal | undefined,
): Promise<HTMLCanvasElement> {
  throwIfPsdCancelled(signal);
  const { context, surface } = createPsdSurface(output.width, output.height);
  let url: string;
  try {
    url = URL.createObjectURL(new Blob([layer.svg], { type: 'image/svg+xml' }));
  } catch {
    releasePsdSurface(surface);
    throw new Error(`The browser could not prepare Photoshop layer "${layer.name}".`);
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    let isSettled = false;
    const cleanup = () => {
      image.removeEventListener('load', handleLoad);
      image.removeEventListener('error', handleError);
      signal?.removeEventListener('abort', handleAbort);
      URL.revokeObjectURL(url);
    };
    const finish = (error?: Error) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      if (error) {
        releasePsdSurface(surface);
        reject(error);
      } else {
        resolve(surface);
      }
    };
    const handleAbort = () => finish(psdAbortError());
    const handleLoad = () => {
      try {
        throwIfPsdCancelled(signal);
        context.drawImage(image, 0, 0, output.width, output.height);
        finish();
      } catch (error) {
        finish(error instanceof Error ? error : new Error('The browser could not render a Photoshop layer.'));
      }
    };
    const handleError = () => finish(new Error(`The browser could not render Photoshop layer "${layer.name}".`));
    image.addEventListener('load', handleLoad);
    image.addEventListener('error', handleError);
    signal?.addEventListener('abort', handleAbort, { once: true });
    image.src = url;
  });
}
