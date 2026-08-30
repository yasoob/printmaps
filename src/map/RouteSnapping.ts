import type { ContentLayer } from '../domain/project';
import { semanticRoutePointLabel, semanticRoutePositions } from '../domain/routeGeometry';

export type RouteSnapCandidate = Readonly<{
  coordinate: readonly [number, number];
  key: string;
  label: string;
}>;

export type RouteSnapResult = Readonly<{
  coordinate: [number, number];
  label: string | null;
}>;

const TILE_SIZE = 512;
const SNAP_RADIUS_PIXELS = 22;

function mercatorY(latitude: number): number {
  const sine = Math.sin(latitude * Math.PI / 180);
  return 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI);
}

function longitudeDistance(first: number, second: number): number {
  const direct = Math.abs(first - second);
  return Math.min(direct, 360 - direct) / 360;
}

export function routeSnapCandidates(layers: readonly ContentLayer[]): RouteSnapCandidate[] {
  return layers.flatMap((layer) => {
    if (!layer.visible || !layer.geometry) return [];
    if (layer.type === 'poi' && layer.geometry.type === 'Point') {
      return [{
        coordinate: layer.geometry.coordinates,
        key: `${layer.id}:poi`,
        label: layer.name,
      }];
    }
    const positions = semanticRoutePositions(layer);
    if (!positions) return [];
    return positions.map((coordinate, index) => ({
      coordinate,
      key: `${layer.id}:route:${index}`,
      label: `${layer.name} ${semanticRoutePointLabel(layer, index).toLowerCase()}`,
    }));
  });
}

export function snapRouteCoordinate(
  coordinate: readonly [number, number],
  candidates: readonly RouteSnapCandidate[],
  zoom: number,
): RouteSnapResult {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const sourceY = mercatorY(coordinate[1]);
  let closest: RouteSnapCandidate | null = null;
  let closestDistance = Infinity;
  for (const candidate of candidates) {
    const x = longitudeDistance(coordinate[0], candidate.coordinate[0]) * worldSize;
    const y = Math.abs(sourceY - mercatorY(candidate.coordinate[1])) * worldSize;
    const distance = Math.hypot(x, y);
    if (distance <= SNAP_RADIUS_PIXELS && distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  }
  return closest
    ? { coordinate: [closest.coordinate[0], closest.coordinate[1]], label: closest.label }
    : { coordinate: [coordinate[0], coordinate[1]], label: null };
}
