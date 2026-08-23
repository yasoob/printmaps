import type { CameraSettings } from './project';
import { MAX_MAP_ZOOM, MAX_MERCATOR_LATITUDE, normalizeCameraPrecision } from './project';

type Fail = (message: string) => never;

function cameraObject(value: unknown, fail: Fail): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail('Project camera must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

function cameraNumber(value: unknown, label: string, fail: Fail): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fail(`${label} must be a finite number.`);
  }
  return value;
}

export function parseProjectCamera(value: unknown, fail: Fail): CameraSettings {
  const camera = cameraObject(value, fail);
  const bearing = cameraNumber(camera.bearing, 'Camera bearing', fail);
  if (Math.abs(bearing) > 180) return fail('Camera bearing must be between -180 and 180.');
  const pitch = cameraNumber(camera.pitch, 'Camera pitch', fail);
  if (pitch < 0 || pitch > 60) return fail('Camera pitch must be between 0 and 60.');
  if (!Array.isArray(camera.center) || camera.center.length !== 2) {
    return fail('Camera center must contain exactly longitude and latitude.');
  }
  const longitude = cameraNumber(camera.center[0], 'Camera center longitude', fail);
  if (Math.abs(longitude) > 180) return fail('Camera center longitude must be between -180 and 180.');
  const latitude = cameraNumber(camera.center[1], 'Camera center latitude', fail);
  if (Math.abs(latitude) > MAX_MERCATOR_LATITUDE) {
    return fail(`Camera center latitude must be between -${MAX_MERCATOR_LATITUDE} and ${MAX_MERCATOR_LATITUDE}.`);
  }
  const zoom = cameraNumber(camera.zoom, 'Camera zoom', fail);
  if (zoom < 0 || zoom > MAX_MAP_ZOOM) return fail(`Camera zoom must be between 0 and ${MAX_MAP_ZOOM}.`);
  if (typeof camera.locked !== 'boolean') return fail('Map area lock state must be true or false.');
  return {
    bearing,
    center: [normalizeCameraPrecision(longitude), normalizeCameraPrecision(latitude)],
    locked: camera.locked,
    pitch,
    zoom: normalizeCameraPrecision(zoom),
  };
}
