import type { ContentLayer, DirectionsRouteInput } from './project';
import { arePositionsEqual, routePositionKey, type RoutePosition } from './routeModel';
import { clonedRoutePoints, routeCandidate, sourceCurvatures, sourceRoute } from './routeTransformationCandidate';

export function isRouteCoordinateMove(
  current: readonly (readonly [number, number])[],
  next: readonly (readonly [number, number])[],
): boolean {
  if (current.length !== next.length) return false;
  const existing = new Set(current.map((point) => routePositionKey(point)));
  return next.some((point) => !existing.has(routePositionKey(point)));
}

// Point order is the logical identity for a move, unlike a topology replacement.
export function moveRouteSemanticPoints(
  layer: ContentLayer,
  semanticPoints: readonly (readonly [number, number])[],
  road?: DirectionsRouteInput,
) {
  const source = sourceRoute(layer);
  if (!source) return null;
  const count = source.appearance.segmentStyles.length + (source.route.closed ? 0 : 1);
  if (semanticPoints.length !== count) return null;
  const points = clonedRoutePoints(semanticPoints);
  if (source.route.closed) points.push([...points[0]]);
  const candidate = routeCandidate({
    source,
    kind: source.route.kind,
    points,
    styles: source.appearance.segmentStyles,
    curvatures: source.route.kind === 'arc' ? sourceCurvatures(source) : undefined,
    road,
  });
  return candidate && { ...candidate, appearance: source.appearance };
}

// Native LineString editors expose the closing copy as an independent handle.
export function synchronizeRouteMoveClosure(
  previous: readonly (readonly [number, number])[],
  next: readonly (readonly [number, number])[],
): RoutePosition[] {
  const points = clonedRoutePoints(next);
  if (previous.length < 4 || previous.length !== points.length
    || !arePositionsEqual(previous[0], previous.at(-1)!)
    || arePositionsEqual(points[0], points.at(-1)!)) return points;
  if (arePositionsEqual(points.at(-1)!, previous[0])) points[points.length - 1] = [...points[0]];
  else if (arePositionsEqual(points[0], previous[0])) points[0] = [...points.at(-1)!];
  return points;
}
