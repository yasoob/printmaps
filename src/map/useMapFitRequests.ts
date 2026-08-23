import { useEffect, useRef, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { CameraSettings, ContentLayer } from '../domain/project';
import { layerBounds, type MapBounds } from './MapLayerBounds';
import type { CameraViewportChangeMode } from './MapCameraViewport';

const PAGE_BOUNDS: [[number, number], [number, number]] = [[16.28, 48.14], [16.48, 48.26]];

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
    runFit(options.cameraViewportChangeMode, 'history', () => options.map.current?.fitBounds(PAGE_BOUNDS, {
      bearing: options.camera.bearing, duration: 0, padding: 64, pitch: options.camera.pitch,
    }));
    options.container.current?.setAttribute('data-camera-fit-request', String(options.fitRequest));
  }, [options.camera.bearing, options.camera.locked, options.camera.pitch, options.cameraViewportChangeMode, options.container, options.fitRequest, options.map]);

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
