import { useEffect, useRef, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { CameraSettings, ContentLayer } from '../domain/project';
import { layerBounds, visibleLayerBounds, type MapBounds } from './MapLayerBounds';
import type { CameraViewportChangeMode } from './MapCameraViewport';

const FALLBACK_FIT_PADDING = 64;
const MAX_CONTENT_FIT_ZOOM = 16;
const PRINT_FRAME_INSET = 32;

type MapFitRequestOptions = Readonly<{
  camera: CameraSettings;
  cameraViewportChangeMode: { current: CameraViewportChangeMode };
  container: RefObject<HTMLDivElement | null>;
  fitLayerId?: string | null;
  fitLayerRequest?: number;
  fitImportBounds?: MapBounds;
  fitImportRequest?: number;
  fitRequest: number;
  layers: readonly ContentLayer[];
  map: RefObject<MapLibreMap | null>;
}>;

function runFit(
  modeReference: { current: CameraViewportChangeMode },
  mode: CameraViewportChangeMode,
  action: () => void,
) {
  modeReference.current = mode;
  try {
    action();
  } finally {
    queueMicrotask(() => {
      if (modeReference.current === mode) modeReference.current = 'history';
    });
  }
}

function printFrameFitPadding(container: HTMLDivElement | null) {
  if (!container) return FALLBACK_FIT_PADDING;
  const frame = container.parentElement?.querySelector<HTMLElement>('.print-frame');
  if (!frame) return FALLBACK_FIT_PADDING;

  const containerRect = container.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  if (containerRect.width <= 0 || containerRect.height <= 0 || frameRect.width <= 0 || frameRect.height <= 0) {
    return FALLBACK_FIT_PADDING;
  }

  const frameTop = Math.max(containerRect.top, frameRect.top);
  const frameRight = Math.min(containerRect.right, frameRect.right);
  const frameBottom = Math.min(containerRect.bottom, frameRect.bottom);
  const frameLeft = Math.max(containerRect.left, frameRect.left);
  const frameWidth = frameRight - frameLeft;
  const frameHeight = frameBottom - frameTop;
  if (frameWidth <= 0 || frameHeight <= 0) return FALLBACK_FIT_PADDING;
  const inset = Math.min(PRINT_FRAME_INSET, frameWidth / 4, frameHeight / 4);

  return {
    top: frameTop - containerRect.top + inset,
    right: containerRect.right - frameRight + inset,
    bottom: containerRect.bottom - frameBottom + inset,
    left: frameLeft - containerRect.left + inset,
  };
}

export function useMapFitRequests(options: MapFitRequestOptions) {
  const handledFitRequest = useRef(0);
  const handledLayerFitRequest = useRef(0);
  const handledFitImportRequest = useRef(0);

  useEffect(() => {
    if (!(options.fitRequest > handledFitRequest.current && options.map.current)) return;
    if (options.camera.locked) {
      handledFitRequest.current = options.fitRequest;
      return;
    }
    handledFitRequest.current = options.fitRequest;
    const bounds = visibleLayerBounds(options.layers);
    if (!bounds) return;
    runFit(options.cameraViewportChangeMode, 'history', () => options.map.current?.fitBounds(bounds, {
      bearing: options.camera.bearing,
      duration: 0,
      maxZoom: MAX_CONTENT_FIT_ZOOM,
      padding: printFrameFitPadding(options.container.current),
      pitch: options.camera.pitch,
    }));
    options.container.current?.setAttribute('data-camera-fit-request', String(options.fitRequest));
  }, [options.camera.bearing, options.camera.locked, options.camera.pitch, options.cameraViewportChangeMode, options.container, options.fitRequest, options.layers, options.map]);

  useEffect(() => {
    const request = options.fitLayerRequest ?? 0;
    if (!(request > handledLayerFitRequest.current && options.map.current)) return;
    if (options.camera.locked) {
      handledLayerFitRequest.current = request;
      return;
    }
    const bounds = layerBounds(options.layers, options.fitLayerId ?? null);
    if (!bounds) return;
    handledLayerFitRequest.current = request;
    runFit(options.cameraViewportChangeMode, 'amend', () => options.map.current?.fitBounds(bounds, {
      bearing: options.camera.bearing, duration: 0, padding: 72, pitch: options.camera.pitch,
    }));
    options.container.current?.setAttribute('data-camera-fit-layer', options.fitLayerId ?? '');
  }, [options.camera.bearing, options.camera.locked, options.camera.pitch, options.cameraViewportChangeMode, options.container, options.fitLayerId, options.fitLayerRequest, options.layers, options.map]);

  useEffect(() => {
    const request = options.fitImportRequest ?? 0;
    if (!(request > handledFitImportRequest.current && options.fitImportBounds && options.map.current)) return;
    if (options.camera.locked) {
      handledFitImportRequest.current = request;
      return;
    }
    handledFitImportRequest.current = request;
    runFit(options.cameraViewportChangeMode, 'amend', () => options.map.current?.fitBounds(options.fitImportBounds!, {
      bearing: options.camera.bearing, duration: 0, padding: 72, pitch: options.camera.pitch,
    }));
    options.container.current?.setAttribute('data-camera-fit-import', String(request));
  }, [options.camera.bearing, options.camera.locked, options.camera.pitch, options.cameraViewportChangeMode, options.container, options.fitImportBounds, options.fitImportRequest, options.map]);
}
