import type { ProjectState } from './store';
import { MAX_MAP_ZOOM, MAX_MERCATOR_LATITUDE, normalizeCameraPrecision } from '../domain/project';
import { commitDocument, type ProjectSet } from './storeDocument';

type CameraActions = Pick<ProjectState, 'setCameraBearing' | 'setCameraPitch' | 'setCameraViewport' | 'setMapAreaLocked'>;

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
    setCameraViewport: (center, zoom, mode = 'history') => set((state) => {
      if (!isValidCameraViewport(center, zoom)) return state;
      const [longitude, latitude] = center;
      const normalizedCenter: [number, number] = [
        normalizeCameraPrecision(longitude),
        normalizeCameraPrecision(latitude),
      ];
      const normalizedZoom = normalizeCameraPrecision(zoom);
      const hasSameCenter = state.document.camera.center[0] === normalizedCenter[0]
        && state.document.camera.center[1] === normalizedCenter[1];
      if (hasSameCenter && state.document.camera.zoom === normalizedZoom) return state;
      const document = {
        ...state.document,
        camera: {
          ...state.document.camera,
          center: hasSameCenter ? state.document.camera.center : normalizedCenter,
          zoom: normalizedZoom,
        },
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
