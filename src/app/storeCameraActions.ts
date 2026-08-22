import type { ProjectState } from './store';
import { commitDocument, type ProjectSet } from './storeDocument';

type CameraActions = Pick<ProjectState, 'setCameraBearing' | 'setCameraPitch'>;

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
