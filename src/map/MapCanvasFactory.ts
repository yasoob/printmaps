import { Map, type Map as MapLibreMap } from 'maplibre-gl';
import type { CameraSettings } from '../domain/project';

type InteractiveMapOptions = {
  camera: CameraSettings;
  container: HTMLDivElement;
  onError: (message: string) => void;
  styleUrl: string;
};

export function createInteractiveMap({ camera, container, onError, styleUrl }: InteractiveMapOptions): MapLibreMap | null {
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2')) {
    queueMicrotask(() => onError('WebGL 2 is unavailable in this browser. Your project can still be edited.'));
    return null;
  }
  try {
    return new Map({
      attributionControl: false,
      bearing: camera.bearing,
      canvasContextAttributes: { preserveDrawingBuffer: true },
      center: camera.center,
      container,
      pitch: camera.pitch,
      style: styleUrl,
      zoom: camera.zoom,
    });
  } catch {
    queueMicrotask(() => onError('The map renderer is unavailable in this browser. Your project can still be edited.'));
    return null;
  }
}
