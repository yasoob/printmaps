import { Map, type Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';
import type { PrintTileExportPlan, PrintTileRenderer } from '../export/previewPng';
import {
  calculateNativeTileCamera,
  type NativeMapRegion,
  type NativeTileCamera,
  type NativeTileRequest,
} from './NativeMapCamera';
import { visibleContentLayers } from './MapContentLayerRendering';
import { registerCustomMarkerImages } from './CustomMarkerMapImages';
import { registerRoutePictogramImages } from './RoutePictogramMapImages';
import {
  copyNativeMapCanvas,
} from './NativeMapTileSupport';
import {
  scaleNativeMapStyle,
  updatePrintLayerPaint,
} from './NativeMapStyle';
import { prepareNativePrintExport, type NativePrintExportSource } from './NativeMapExportPlan';

export { calculateNativeTileCamera } from './NativeMapCamera';
export type { NativeMapOutput, NativeMapRegion, NativeTileCamera, NativeTileRequest } from './NativeMapCamera';
export { scaleNativeMapStyle } from './NativeMapStyle';

type NativeMapFactory = (options: ConstructorParameters<typeof Map>[0]) => MapLibreMap;

export function selectNativeExportPixelRatio(
  output: Readonly<{ width: number; height: number }>,
): 1 | 2 {
  return output.width % 2 === 0 && output.height % 2 === 0 ? 2 : 1;
}

type NativeMapRenderOptions = Readonly<{
  createMap?: NativeMapFactory;
  layers: ContentLayer[];
  assets?: Record<string, CustomMarkerAsset>;
  pixelsPerMillimetre?: number;
  signal?: AbortSignal;
  style?: ReturnType<MapLibreMap['getStyle']>;
  timeoutMs?: number;
}>;

type NativeMapWaitOptions = Readonly<{
  assets: Record<string, CustomMarkerAsset>;
  pixelsPerMillimetre: number;
  signal?: AbortSignal;
  timeoutMs: number;
}>;

function abortError(): DOMException {
  return new DOMException('Native map export was cancelled.', 'AbortError');
}

function waitForNativeMap(
  map: MapLibreMap,
  layers: ContentLayer[],
  options: NativeMapWaitOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(abortError());
      return;
    }
    const cleanup = () => {
      clearTimeout(timeout);
      map.off('load', handleLoad);
      map.off('idle', handleIdle);
      map.off('error', handleError);
      options.signal?.removeEventListener('abort', handleAbort);
    };
    const finish = (error?: unknown) => {
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const handleIdle = () => finish();
    const handleError = (event?: { error?: unknown }) => finish(
      event?.error instanceof Error
        ? event.error
        : new Error('The native map renderer failed while loading print tiles.'),
    );
    const handleAbort = () => finish(abortError());
    const handleLoad = () => {
      void (async () => {
        try {
          const visibleLayers = visibleContentLayers(layers);
          await registerCustomMarkerImages(map, visibleLayers, options.assets);
          registerRoutePictogramImages(map, visibleLayers);
          for (const layer of visibleLayers) {
            updatePrintLayerPaint(map, layer, options.pixelsPerMillimetre, options.assets);
          }
          map.once('idle', handleIdle);
          map.triggerRepaint();
        } catch (error) {
          finish(error);
        }
      })();
    };
    const timeout = setTimeout(() => finish(
      new Error('The native map renderer timed out while loading print tiles.'),
    ), options.timeoutMs);
    options.signal?.addEventListener('abort', handleAbort, { once: true });
    map.once('error', handleError);
    map.once('load', handleLoad);
  });
}

function removeMap(map: MapLibreMap): void {
  try {
    map.remove();
  } catch {
    try {
      map.remove();
    } catch {
      // The temporary DOM container is still removed by the caller.
    }
  }
}

function isCameraMatching(actual: number, expected: number): boolean {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= 0.000001;
}

function isLongitudeMatching(actual: number, expected: number): boolean {
  const delta = ((actual - expected + 540) % 360) - 180;
  return Math.abs(delta) <= 0.000001;
}

function verifyNativeTileCamera(map: MapLibreMap, expected: NativeTileCamera): void {
  const center = map.getCenter();
  if (
    !isLongitudeMatching(center.lng, expected.center[0])
    || !isCameraMatching(center.lat, expected.center[1])
    || !isCameraMatching(map.getZoom(), expected.zoom)
    || !isCameraMatching(map.getBearing(), expected.bearing)
    || !isCameraMatching(map.getPitch(), expected.pitch)
  ) {
    throw new Error('The native map renderer could not preserve the requested print camera. Reduce the map zoom or page size and retry.');
  }
}

const regionKey = (region: NativeMapRegion) => (
  `${region.x},${region.y},${region.width},${region.height}`
);

type NativeMapTileSnapshot = Readonly<{
  assets: Record<string, CustomMarkerAsset>;
  camera: NativeTileCamera;
  layers: ContentLayer[];
  pixelsPerMillimetre: number;
  style: ReturnType<MapLibreMap['getStyle']>;
}>;

async function renderNativeMapTileSnapshot(
  request: NativeTileRequest,
  snapshot: NativeMapTileSnapshot,
  options: Omit<NativeMapRenderOptions, 'layers' | 'style'>,
): Promise<HTMLCanvasElement> {
  if (options.signal?.aborted) throw abortError();
  const { camera } = snapshot;
  const pixelRatio = selectNativeExportPixelRatio(request.output);
  const renderCamera = {
    ...camera,
    zoom: camera.zoom - Math.log2(pixelRatio),
  };
  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.dataset.nativeExportRegion = [
    request.region.x,
    request.region.y,
    request.region.width,
    request.region.height,
  ].join(',') + `/${request.output.width}x${request.output.height}`;
  Object.assign(container.style, {
    height: `${request.region.height / pixelRatio}px`,
    left: '-100000px',
    pointerEvents: 'none',
    position: 'fixed',
    top: '0',
    width: `${request.region.width / pixelRatio}px`,
  });
  document.body.append(container);

  let map: MapLibreMap | null = null;
  try {
    const createMap = options.createMap ?? ((mapOptions) => new Map(mapOptions));
    map = createMap({
      attributionControl: false,
      bearing: renderCamera.bearing,
      canvasContextAttributes: { preserveDrawingBuffer: true },
      center: renderCamera.center,
      container,
      fadeDuration: 0,
      interactive: false,
      maxCanvasSize: [request.region.width, request.region.height],
      pitch: renderCamera.pitch,
      pixelRatio,
      style: structuredClone(snapshot.style),
      zoom: renderCamera.zoom,
    });
    verifyNativeTileCamera(map, renderCamera);
    await waitForNativeMap(
      map,
      snapshot.layers,
      {
        assets: snapshot.assets,
        pixelsPerMillimetre: snapshot.pixelsPerMillimetre / pixelRatio,
        signal: options.signal,
        timeoutMs: options.timeoutMs ?? 20_000,
      },
    );
    if (options.signal?.aborted) throw abortError();

    const rendered = map.getCanvas();
    if (rendered.width !== request.region.width || rendered.height !== request.region.height) {
      throw new Error('The native map renderer could not allocate the requested print tile dimensions.');
    }
    return copyNativeMapCanvas(rendered, request.region.width, request.region.height);
  } finally {
    if (map) removeMap(map);
    container.remove();
  }
}

export function createNativePrintTileExport(
  source: NativePrintExportSource,
  plan: PrintTileExportPlan,
): PrintTileRenderer {
  const snapshots = new globalThis.Map<string, NativeMapTileSnapshot>();
  const pixelRatio = selectNativeExportPixelRatio(plan.output);
  const { assets, layers, printFrame, style } = prepareNativePrintExport(source, plan, pixelRatio);
  for (const region of plan.regions) {
    snapshots.set(regionKey(region), {
      assets,
      camera: calculateNativeTileCamera(source.map, printFrame, { output: plan.output, region }),
      layers,
      pixelsPerMillimetre: plan.pixelsPerMillimetre,
      style,
    });
  }
  return async ({ output, region, signal }) => {
    if (!source.isReady()) throw new Error('The native export source map changed while rendering. Retry the export.');
    if (output.width !== plan.output.width || output.height !== plan.output.height) {
      throw new Error('The native map renderer received an unexpected output size.');
    }
    const snapshot = snapshots.get(regionKey(region));
    if (!snapshot) throw new Error('The native map renderer received an unexpected tile region.');
    const surface = await renderNativeMapTileSnapshot({ output, region }, snapshot, {
      signal: signal ?? plan.signal,
    });
    if (source.isReady()) return surface;
    surface.width = 0;
    surface.height = 0;
    throw new Error('The native export source map changed while rendering. Retry the export.');
  };
}

export async function renderNativeMapTile(
  sourceMap: MapLibreMap,
  printFrame: HTMLElement,
  request: NativeTileRequest,
  options: NativeMapRenderOptions,
): Promise<HTMLCanvasElement> {
  const camera = calculateNativeTileCamera(sourceMap, printFrame, request);
  const pixelsPerMillimetre = options.pixelsPerMillimetre ?? 1 / 0.3;
  const pixelRatio = selectNativeExportPixelRatio(request.output);
  return renderNativeMapTileSnapshot(request, {
    assets: structuredClone(options.assets ?? {}),
    camera,
    layers: structuredClone(options.layers),
    pixelsPerMillimetre,
    style: scaleNativeMapStyle(
      options.style ?? sourceMap.getStyle(),
      pixelsPerMillimetre * 0.3 / pixelRatio,
    ),
  }, options);
}
