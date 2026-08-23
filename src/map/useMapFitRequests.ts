import { useEffect, useRef, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { CameraSettings, ContentLayer } from '../domain/project';
import { layerBounds, type MapBounds } from './MapLayerBounds';

const PAGE_BOUNDS: [[number, number], [number, number]] = [[16.28, 48.14], [16.48, 48.26]];

type MapFitRequestOptions = Readonly<{
  camera: CameraSettings;
  container: RefObject<HTMLDivElement | null>;
  fitLayerId?: string | null;
  fitLayerRequest?: number;
  fitImportBounds?: MapBounds;
  fitImportRequest?: number;
  fitRequest: number;
  layers: readonly ContentLayer[];
  map: RefObject<MapLibreMap | null>;
}>;

export function useMapFitRequests(options: MapFitRequestOptions) {
  const handledFitRequest = useRef(0);
  const handledLayerFitRequest = useRef(0);
  const handledFitImportRequest = useRef(0);

  useEffect(() => {
    if (!(options.fitRequest > handledFitRequest.current && options.map.current)) return;
    handledFitRequest.current = options.fitRequest;
    options.map.current.fitBounds(PAGE_BOUNDS, {
      bearing: options.camera.bearing,
      duration: 0,
      padding: 64,
      pitch: options.camera.pitch,
    });
    options.container.current?.setAttribute('data-camera-fit-request', String(options.fitRequest));
  }, [options.camera.bearing, options.camera.pitch, options.container, options.fitRequest, options.map]);

  useEffect(() => {
    const request = options.fitLayerRequest ?? 0;
    if (!(request > handledLayerFitRequest.current && options.map.current)) return;
    const bounds = layerBounds(options.layers, options.fitLayerId ?? null);
    if (!bounds) return;
    handledLayerFitRequest.current = request;
    options.map.current.fitBounds(bounds, {
      bearing: options.camera.bearing,
      duration: 0,
      padding: 72,
      pitch: options.camera.pitch,
    });
    options.container.current?.setAttribute('data-camera-fit-layer', options.fitLayerId ?? '');
  }, [options.camera.bearing, options.camera.pitch, options.container, options.fitLayerId, options.fitLayerRequest, options.layers, options.map]);

  useEffect(() => {
    const request = options.fitImportRequest ?? 0;
    if (!(request > handledFitImportRequest.current && options.fitImportBounds && options.map.current)) return;
    handledFitImportRequest.current = request;
    options.map.current.fitBounds(options.fitImportBounds, {
      bearing: options.camera.bearing,
      duration: 0,
      padding: 72,
      pitch: options.camera.pitch,
    });
    options.container.current?.setAttribute('data-camera-fit-import', String(request));
  }, [options.camera.bearing, options.camera.pitch, options.container, options.fitImportBounds, options.fitImportRequest, options.map]);
}
