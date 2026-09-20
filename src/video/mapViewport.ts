import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapRenderSnapshot } from '../map/MapRenderSnapshot';
import type { VideoCamera } from './camera';
import type { VideoFrame, VideoPlan } from './types';

export const MAX_VIDEO_VIEWPORT_EDGE = 4096;
export const MAX_VIDEO_VIEWPORT_PIXELS = 3840 * 2160;

export function planVideoViewport(snapshot: MapRenderSnapshot, plan: VideoPlan) {
  const { viewport, frame } = snapshot;
  if ([viewport.width, viewport.height, frame.width, frame.height].some((size) => !Number.isFinite(size) || size <= 0)
    || !Number.isFinite(frame.x) || !Number.isFinite(frame.y)) {
    throw new Error('The video snapshot has invalid viewport or frame dimensions.');
  }
  if (frame.x < 0 || frame.y < 0 || frame.x + frame.width > viewport.width + 0.01 || frame.y + frame.height > viewport.height + 0.01) {
    throw new Error('The print frame extends outside the map viewport. Fit the page inside the editor and retry.');
  }
  const width = Math.round(viewport.width), height = Math.round(viewport.height);
  if (Math.abs(width - viewport.width) > 0.01 || Math.abs(height - viewport.height) > 0.01) {
    throw new Error('The map viewport is CSS-scaled. Reset the editor layout before recording.');
  }
  const pixelRatio = Math.max(plan.poster.width / frame.width, plan.poster.height / frame.height);
  const canvasWidth = Math.floor(width * pixelRatio), canvasHeight = Math.floor(height * pixelRatio);
  if (Math.max(canvasWidth, canvasHeight) > MAX_VIDEO_VIEWPORT_EDGE || canvasWidth * canvasHeight > MAX_VIDEO_VIEWPORT_PIXELS) {
    throw new Error('Preserving the map perspective exceeds the video viewport budget. Enlarge the print frame in the editor or choose Standard quality.');
  }
  return { width, height, pixelRatio, canvasWidth, canvasHeight };
}

export function createVideoFrameCrop(snapshot: MapRenderSnapshot, plan: VideoPlan, viewport: ReturnType<typeof planVideoViewport>) {
  const canvas = document.createElement('canvas');
  canvas.width = plan.poster.width;
  canvas.height = plan.poster.height;
  const context = canvas.getContext('2d');
  if (!context) {
    canvas.width = canvas.height = 0;
    throw new Error('A 2D canvas is required to crop the video print frame.');
  }
  const { frame } = snapshot;
  return {
    draw(map: MapLibreMap, camera: VideoCamera): VideoFrame {
      const source = map.getCanvas();
      if (source.width !== viewport.canvasWidth || source.height !== viewport.canvasHeight) {
        throw new Error('The video renderer could not allocate the requested viewport. Try Standard quality.');
      }
      const sx = source.width / viewport.width, sy = source.height / viewport.height;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, frame.x * sx, frame.y * sy, frame.width * sx, frame.height * sy, 0, 0, canvas.width, canvas.height);
      return {
        canvas,
        camera,
        project: (coordinate) => {
          const point = map.project([coordinate[0], coordinate[1]]);
          return {
            x: (point.x - frame.x) / frame.width * canvas.width,
            y: (point.y - frame.y) / frame.height * canvas.height,
          };
        },
      };
    },
    dispose: () => { canvas.width = canvas.height = 0; },
  };
}
