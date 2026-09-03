import type { ProjectState } from './store';
import {
  MAX_MAP_ZOOM,
  MAX_MERCATOR_LATITUDE,
  normalizeCameraPrecision,
  type CameraSettings,
} from '../domain/project';
import { commitDocument, type ProjectSet } from './storeDocument';

type CameraActions = Pick<ProjectState, 'setCameraBearing' | 'setCameraPitch' | 'setCameraViewport' | 'setMapAreaLocked'>;
type CameraOrientation = Pick<CameraSettings, 'bearing' | 'pitch'>;

function isValidCameraViewport(
  center: readonly [number, number],
  zoom: number,
) {
  const [longitude, latitude] = center;
  return Number.isFinite(longitude)
    && Math.abs(longitude) <= 180
    && Number.isFinite(latitude)
    && Math.abs(latitude) <= MAX_MERCATOR_LATITUDE
    && Number.isFinite(zoom)
    && zoom >= 0
    && zoom <= MAX_MAP_ZOOM;
}

function isValidCameraOrientation(orientation?: CameraOrientation) {
  if (!orientation) return true;
  return Number.isFinite(orientation.bearing)
    && orientation.bearing >= -180
    && orientation.bearing <= 180
    && Number.isFinite(orientation.pitch)
    && orientation.pitch >= 0
    && orientation.pitch <= 60;
}

function normalizedViewportCamera(
  current: CameraSettings,
  center: readonly [number, number],
  zoom: number,
  orientation?: CameraOrientation,
): CameraSettings {
  const normalizedCenter: [number, number] = [
    normalizeCameraPrecision(center[0]),
    normalizeCameraPrecision(center[1]),
  ];
  const hasSameCenter = current.center[0] === normalizedCenter[0]
    && current.center[1] === normalizedCenter[1];
  return {
    ...current,
    bearing: normalizeCameraPrecision(orientation?.bearing ?? current.bearing),
    center: hasSameCenter ? current.center : normalizedCenter,
    pitch: normalizeCameraPrecision(orientation?.pitch ?? current.pitch),
    zoom: normalizeCameraPrecision(zoom),
  };
}

function hasSameCamera(left: CameraSettings, right: CameraSettings) {
  return left === right
    || (
      left.bearing === right.bearing
      && left.center === right.center
      && left.pitch === right.pitch
      && left.zoom === right.zoom
    );
}

export function createCameraActions(set: ProjectSet): CameraActions {
  return {
    setCameraBearing: (bearing) => set((state) => {
      if (!Number.isFinite(bearing) || bearing < -180 || bearing > 180 || state.document.camera.bearing === bearing) {
        return state;
      }
      return commitDocument(state, {
        ...state.document,
        camera: { ...state.document.camera, bearing },
      });
    }),
    setCameraViewport: (center, zoom, mode = 'history', orientation) => set((state) => {
      if (!isValidCameraViewport(center, zoom) || !isValidCameraOrientation(orientation)) return state;
      const camera = normalizedViewportCamera(state.document.camera, center, zoom, orientation);
      if (hasSameCamera(state.document.camera, camera)) return state;
      const document = {
        ...state.document,
        camera,
      };
      return mode === 'amend' ? { document } : commitDocument(state, document);
    }),
    setMapAreaLocked: (isLocked) => set((state) => {
      if (state.document.camera.locked === isLocked) return state;
      return commitDocument(state, {
        ...state.document,
        camera: { ...state.document.camera, locked: isLocked },
      });
    }),
    setCameraPitch: (pitch) => set((state) => {
      if (!Number.isFinite(pitch) || pitch < 0 || pitch > 60 || state.document.camera.pitch === pitch) {
        return state;
      }
      return commitDocument(state, {
        ...state.document,
        camera: { ...state.document.camera, pitch },
      });
    }),
  };
}
