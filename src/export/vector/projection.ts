import type { MapRenderSnapshot } from '../../map/MapRenderSnapshot';
import { vectorUnsupported, type VectorPoint } from './scene';

export function mercatorPoint(coordinate: readonly [number, number]): VectorPoint {
  const [longitude, latitude] = coordinate;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(latitude) > 85.051129) {
    vectorUnsupported('A coordinate is outside the finite Web Mercator world.');
  }
  return {
    x: (longitude + 180) / 360,
    y: (1 - Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360)) / Math.PI) / 2,
  };
}

export function snapshotVectorProjection(snapshot: MapRenderSnapshot) {
  const { camera, style, viewport: canvas, frame, footprint } = snapshot;
  if (camera.pitch !== 0 || camera.roll !== 0 || style.terrain
    || (style.projection && style.projection.type !== 'mercator')) {
    vectorUnsupported('Use an unpitched, unrolled Mercator map with terrain disabled.');
  }
  const rect = frame, left = frame.x, top = frame.y;
  if ([canvas.width, canvas.height, rect.width, rect.height].some((value) => !(Number.isFinite(value) && value > 0))
    || left < -1 || top < -1 || left + rect.width > canvas.width + 1 || top + rect.height > canvas.height + 1) {
    vectorUnsupported('The entire print frame must be visible inside the map.');
  }
  const origin = mercatorPoint(camera.center);
  const worldSize = 512 * 2 ** camera.zoom;
  const angle = camera.bearing * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const projectWorld = (point: VectorPoint): VectorPoint => {
    const x = (point.x - origin.x) * worldSize, y = (point.y - origin.y) * worldSize;
    return { x: cos * x + sin * y + canvas.width / 2 - left, y: -sin * x + cos * y + canvas.height / 2 - top };
  };
  const corners = footprint.corners.map((coordinate) => mercatorPoint(coordinate));
  return {
    width: rect.width,
    height: rect.height,
    zoom: camera.zoom,
    referenceLongitude: snapshot.referenceLongitude,
    corners,
    projectWorld,
    projectToFrame: (coordinate: readonly [number, number]) => {
      const point = projectWorld(mercatorPoint(coordinate));
      return { x: point.x / rect.width, y: point.y / rect.height };
    },
  };
}

export type VectorProjection = ReturnType<typeof snapshotVectorProjection>;
