import type { StudioCamera } from './studioLayout';
import type { DecorationSettings } from '../domain/studio';
import { canonicalStudioLongitude, type StudioBox, type StudioPoint, type StudioProjector } from './studioGeometry';
import { studioText, type StudioPrimitive } from './studioPrimitives';

function extent(center: readonly [number, number], project: StudioProjector, box: StudioBox) {
  const origin = project(center), east = project([center[0] + 0.001, center[1]]);
  const north = project([center[0], Math.min(85.051129, center[1] + 0.001)]);
  const diagonal = Math.hypot(box.width, box.height) * 1.5;
  return {
    // Avoid projecting both endpoints onto the same world copy at the +/-180 tie.
    longitude: Math.min(180 - 1e-9, diagonal / Math.hypot(east.x - origin.x, east.y - origin.y) * 0.001),
    latitude: Math.min(85, diagonal / Math.hypot(north.x - origin.x, north.y - origin.y) * 0.001),
  };
}

function isInBox(point: StudioPoint, box: StudioBox): boolean {
  return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
}

export function gridPrimitives(settings: DecorationSettings['grid'], camera: StudioCamera, box: StudioBox, project: StudioProjector): StudioPrimitive[] {
  if (!settings.enabled) return [];
  if (camera.pitch !== 0) throw new Error('Coordinate grids require a flat map. Set camera pitch to 0 before enabling the grid.');
  const range = extent(camera.center, project, box);
  const west = camera.center[0] - range.longitude, east = camera.center[0] + range.longitude;
  const south = Math.max(-85.051129, camera.center[1] - range.latitude), north = Math.min(85.051129, camera.center[1] + range.latitude);
  const interval = settings.intervalDegrees;
  if ((east - west + north - south) / interval > 200) {
    throw new Error('This coordinate grid would be too dense. Increase its interval or zoom in.');
  }
  const primitives: StudioPrimitive[] = [];
  const addLine = (points: StudioPoint[], label: string) => {
    primitives.push({ kind: 'path', points, closed: false, fill: 'none', stroke: settings.color, strokeWidth: 0.15, opacity: settings.opacity / 100, clip: box });
    const first = points.find((point) => isInBox(point, box));
    if (first && settings.showLabels) {
      const point = { x: Math.max(box.x + 5, Math.min(box.x + box.width - 5, first.x)), y: Math.max(box.y + 3, Math.min(box.y + box.height - 1, first.y)) };
      primitives.push({ ...studioText(label, point, { size: 2.3, maxWidth: 16, font: 'mono', color: settings.color }), clip: box });
    }
  };
  for (let lng = Math.ceil(west / interval) * interval; lng <= east; lng += interval) {
    const points = Array.from({ length: 65 }, (_, index) => project([lng, south + (north - south) * index / 64]));
    const normalized = canonicalStudioLongitude(lng);
    addLine(points, `${Math.abs(normalized).toFixed(2)} ${normalized < 0 ? 'W' : 'E'}`);
  }
  for (let lat = Math.ceil(south / interval) * interval; lat <= north; lat += interval) {
    const points = Array.from({ length: 65 }, (_, index) => project([west + (east - west) * index / 64, lat]));
    addLine(points, `${Math.abs(lat).toFixed(2)} ${lat < 0 ? 'S' : 'N'}`);
  }
  return primitives;
}
