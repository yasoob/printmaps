import { Map, type Map as MapLibreMap, type ErrorEvent as MapErrorEvent } from 'maplibre-gl';
import type { ProjectDocument } from '../domain/project';
import type { MapRenderSnapshot } from '../map/MapRenderSnapshot';
import { deferCustomMarkerLayers } from '../map/CustomMarkerMapImages';
import { visibleContentLayers } from '../map/MapContentLayerRendering';
import { waitForMapExportReady } from '../map/MapExportReadiness';
import { scaleNativeMapStyle, updatePrintLayerPaint } from '../map/NativeMapStyle';
import { registerRoutePictogramImages } from '../map/RoutePictogramMapImages';
import { registerPoiShapeImages } from '../map/PoiShapeMapImages';
import { requireVideoActive } from './abort';
import type { VideoCamera } from './camera';
import { prepareVideoMapImages } from './mapImages';
import { createVideoFrameCrop, planVideoViewport } from './mapViewport';
import type { VideoPlan, VideoRenderer } from './types';

type MapFactory = (options: ConstructorParameters<typeof Map>[0]) => MapLibreMap;

const wrappedDelta = (actual: number, expected: number) => ((actual - expected + 540) % 360) - 180;

function verifyVideoCamera(map: MapLibreMap, camera: VideoCamera): void {
  const center = map.getCenter();
  const deltas = [
    wrappedDelta(center.lng, camera.center[0]), center.lat - camera.center[1],
    map.getZoom() - camera.zoom, map.getPitch() - camera.pitch,
    wrappedDelta(map.getBearing(), camera.bearing),
  ];
  if (deltas.some((delta) => !Number.isFinite(delta) || Math.abs(delta) > 0.000001)) {
    throw new Error('The isolated renderer could not preserve the requested video camera.');
  }
}

function hasContourProtocol(style: MapRenderSnapshot['style']): boolean {
  return Object.values(style.sources).some((source) => (
    ('url' in source && source.url?.startsWith('pms-contours:'))
    || ('tiles' in source && source.tiles?.some((url) => url.startsWith('pms-contours:')))
  ));
}

function waitForLoad(map: MapLibreMap, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: unknown) => {
      clearTimeout(timeout);
      map.off('load', loaded);
      map.off('error', failed);
      signal.removeEventListener('abort', aborted);
      if (error) reject(error); else resolve();
    };
    const loaded = () => finish();
    const failed = (event: MapErrorEvent) => finish(new Error(event.error.message));
    const aborted = () => finish(signal.reason);
    const timeout = setTimeout(() => finish(new Error('Video map resources did not finish loading within 20 seconds.')), 20_000);
    map.once('load', loaded);
    map.once('error', failed);
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted();
  });
}

export function videoSnapshotCamera(snapshot: MapRenderSnapshot, plan: VideoPlan): VideoCamera {
  if (Math.abs(snapshot.camera.roll) > 0.000001) throw new Error('Video export does not support camera roll.');
  if ([snapshot.frame.width, snapshot.frame.height].some((size) => !Number.isFinite(size) || size <= 0)) throw new Error('The video snapshot has invalid frame dimensions.');
  const frameAspect = snapshot.frame.width / snapshot.frame.height;
  const posterAspect = plan.poster.width / plan.poster.height;
  if (Math.abs(frameAspect - posterAspect) / frameAspect > 0.005) {
    throw new Error('The print frame changed aspect ratio. Wait for the editor layout to settle and retry.');
  }
  const { zoom, center, bearing, pitch } = snapshot.camera;
  if (!Number.isFinite(zoom) || zoom < -2 || zoom > 24) {
    throw new Error('The video camera exceeds the renderer zoom range. Reduce the map zoom or video quality.');
  }
  return { center: [...center], bearing, pitch, zoom };
}

export function createMapVideoSnapshot(
  renderSnapshot: MapRenderSnapshot,
  document: ProjectDocument,
  plan: VideoPlan,
  options: Readonly<{
    createMap?: MapFactory;
    retainStyleResources?: (style: MapRenderSnapshot['style']) => () => void;
  }> = {},
): Readonly<{
  document: ProjectDocument;
  camera: VideoCamera;
  createRenderer: (signal: AbortSignal) => Promise<VideoRenderer>;
}> {
  const snapshot = structuredClone(renderSnapshot);
  if (hasContourProtocol(snapshot.style) && !options.retainStyleResources) {
    throw new Error('Terrain contour resources are unavailable for isolated video export.');
  }
  const project = structuredClone(document);
  const camera = videoSnapshotCamera(snapshot, plan);
  const viewport = planVideoViewport(snapshot, plan);
  const pixelsPerMillimetre = plan.poster.width / project.page.widthMm / viewport.pixelRatio;
  return {
    document: project,
    camera,
    createRenderer: async (signal) => {
      requireVideoActive(signal);
      const images = await prepareVideoMapImages(snapshot, signal);
      const container = window.document.createElement('div');
      container.setAttribute('aria-hidden', 'true');
      container.dataset.videoExportRenderer = 'true';
      Object.assign(container.style, {
        width: `${viewport.width}px`, height: `${viewport.height}px`,
        position: 'fixed', left: '-100000px', top: '0', pointerEvents: 'none',
      });
      let map: MapLibreMap | undefined;
      let crop: ReturnType<typeof createVideoFrameCrop> | undefined;
      let releaseResources: (() => void) | undefined;
      let isDisposed = false;
      let failure: Error | undefined;
      const rememberFailure = (event: MapErrorEvent) => { failure = new Error(event.error.message); };
      const contextLost = () => { failure = new Error('The isolated video renderer lost its graphics context. Try lower quality.'); };
      const dispose = () => {
        if (isDisposed) return;
        isDisposed = true;
        try {
          map?.off('error', rememberFailure);
          map?.off('webglcontextlost', contextLost);
          map?.remove();
        } finally {
          try {
            releaseResources?.();
          } finally {
            images.dispose();
            crop?.dispose();
            container.remove();
          }
        }
      };
      try {
        requireVideoActive(signal);
        crop = createVideoFrameCrop(snapshot, plan, viewport);
        const frameCrop = crop;
        const style = scaleNativeMapStyle(snapshot.style, pixelsPerMillimetre * 0.3);
        releaseResources = options.retainStyleResources?.(style);
        const deferred = deferCustomMarkerLayers(style);
        window.document.body.append(container);
        map = (options.createMap ?? ((settings) => new Map(settings)))({
          container, style, center: [...camera.center], zoom: camera.zoom,
          bearing: camera.bearing, pitch: camera.pitch,
          interactive: false, attributionControl: false, fadeDuration: 0,
          pixelRatio: viewport.pixelRatio, minZoom: -2, maxZoom: 24,
          maxCanvasSize: [Math.ceil(viewport.width * viewport.pixelRatio), Math.ceil(viewport.height * viewport.pixelRatio)],
          canvasContextAttributes: { preserveDrawingBuffer: true },
        });
        map.on('error', rememberFailure);
        map.on('webglcontextlost', contextLost);
        await waitForLoad(map, signal);
        images.register(map);
        const layers = visibleContentLayers([...snapshot.layers]);
        for (const id of deferred) map.setLayoutProperty(id, 'visibility', 'visible');
        registerRoutePictogramImages(map, layers);
        registerPoiShapeImages(map, layers);
        for (const layer of layers) updatePrintLayerPaint(map, layer, pixelsPerMillimetre, snapshot.assets);
        const activeMap = map;
        return {
          dispose,
          render: async (nextCamera, frameSignal) => {
            requireVideoActive(frameSignal);
            if (failure) throw failure;
            if (isDisposed) throw new Error('The video renderer has already been disposed.');
            activeMap.jumpTo({ ...nextCamera, center: [...nextCamera.center] });
            verifyVideoCamera(activeMap, nextCamera);
            await waitForMapExportReady(activeMap, {
              isCurrent: () => !isDisposed,
              isReady: () => activeMap.areTilesLoaded(),
              signal: frameSignal,
            });
            requireVideoActive(frameSignal);
            if (failure) throw failure;
            return frameCrop.draw(activeMap, nextCamera);
          },
        };
      } catch (error) {
        dispose();
        throw error;
      }
    },
  };
}
