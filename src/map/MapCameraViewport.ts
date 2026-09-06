import type { Map as MapLibreMap } from 'maplibre-gl';
import { normalizeCameraPrecision, type CameraSettings } from '../domain/project';
import { mutationRejected, type ProjectMutationResult } from '../domain/projectMutation';

export type CameraViewportChangeMode = 'amend' | 'history';

export type MapCameraViewport = Omit<CameraSettings, 'locked'>;

export type CameraViewportPublication = {
  cameraViewportChange: { current: ((
    center: readonly [number, number],
    zoom: number,
    mode: CameraViewportChangeMode,
    orientation: Pick<CameraSettings, 'bearing' | 'pitch'>,
  ) => ProjectMutationResult) | undefined };
  cameraViewportChangeMode: { current: CameraViewportChangeMode };
};

export function readMapCameraViewport(map: MapLibreMap): MapCameraViewport {
  const center = map.getCenter();
  const longitude = Math.abs(center.lng) <= 180
    ? center.lng
    : ((center.lng + 180) % 360 + 360) % 360 - 180;
  return {
    center: [normalizeCameraPrecision(longitude), normalizeCameraPrecision(center.lat)],
    zoom: normalizeCameraPrecision(map.getZoom()),
    bearing: normalizeCameraPrecision(map.getBearing()),
    pitch: normalizeCameraPrecision(map.getPitch()),
  };
}

export function hasSameMapCameraViewport(left: MapCameraViewport, right: MapCameraViewport) {
  return left.center[0] === right.center[0] && left.center[1] === right.center[1]
    && left.zoom === right.zoom && left.bearing === right.bearing && left.pitch === right.pitch;
}

export function writeCameraViewportAttributes(container: HTMLElement | null, viewport: MapCameraViewport) {
  if (!container) return;
  container.dataset.mapBearing = String(viewport.bearing);
  container.dataset.mapCenter = viewport.center.join(',');
  container.dataset.mapPitch = String(viewport.pitch);
  container.dataset.mapZoom = String(viewport.zoom);
}

export function publishCameraViewport(viewport: MapCameraViewport, references: CameraViewportPublication) {
  const mode = references.cameraViewportChangeMode.current;
  references.cameraViewportChangeMode.current = 'history';
  const commit = references.cameraViewportChange.current;
  if (!commit) return mutationRejected('Camera editing is not available in this view.', 'unavailable');
  return commit(viewport.center, viewport.zoom, mode, { bearing: viewport.bearing, pitch: viewport.pitch });
}
