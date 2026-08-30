import {
  MAX_MERCATOR_LATITUDE,
  ROUTE_KINDS,
  type ContentLayer,
  type DirectionsProvenance,
  type RouteKind,
  type RouteMetadata,
} from './project';
import {
  isRouteAppearanceValid,
  type RouteAppearance,
} from './layerAppearance';
import { partitionRoadGeometry } from './routeRoadGeometry';

export type RoutePosition = [number, number];
export type CompleteRouteLayer = ContentLayer & {
  type: 'route';
  route: RouteMetadata;
  appearance: RouteAppearance;
  geometry:
    | NonNullable<Extract<ContentLayer['geometry'], { type: 'Arc' }>>
    | { type: 'LineString'; coordinates: RoutePosition[] };
};

export const ROUTE_POINT_LIMITS: Readonly<Record<RouteKind, number>> = {
  straight: 50_000,
  arc: 8334,
  road: 25,
};

export function parseRouteMetadata(
  value: unknown,
  isRouteLayer: boolean,
  label: string,
  fail: (message: string) => never,
): RouteMetadata | undefined {
  if (!isRouteLayer) {
    if (value !== undefined) fail(`${label} route metadata is only valid for Route layers.`);
    return;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${label} route metadata must be a JSON object.`);
  }
  const route = value as Record<string, unknown>;
  const unexpected = Object.keys(route).find((key) => !['kind', 'closed'].includes(key));
  if (unexpected) fail(`${label} route metadata contains unsupported field "${unexpected}".`);
  if (!ROUTE_KINDS.includes(route.kind as RouteKind)) {
    fail(`${label} route kind must be straight, arc, or road.`);
  }
  if (typeof route.closed !== 'boolean') fail(`${label} route closed state must be true or false.`);
  return { kind: route.kind as RouteKind, closed: route.closed as boolean };
}

export function arePositionsEqual(
  left: readonly [number, number],
  right: readonly [number, number],
): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

export function routePositionKey([longitude, latitude]: readonly [number, number]): string {
  return `${longitude},${latitude}`;
}

export function semanticLegCount(points: readonly (readonly [number, number])[]): number {
  return Math.max(0, points.length - 1);
}

export function semanticRoutePoints(
  layer: Pick<ContentLayer, 'geometry' | 'provenance' | 'route' | 'type'>,
): readonly (readonly [number, number])[] | null {
  if (layer.type !== 'route') return null;
  if (layer.route?.kind === 'road') {
    return layer.provenance?.service === 'directions-v5'
      ? layer.provenance.waypoints
      : null;
  }
  if (layer.geometry?.type === 'Arc') return layer.geometry.anchors;
  if (layer.geometry?.type === 'LineString') return layer.geometry.coordinates;
  return null;
}

function isValidRoutePosition([longitude, latitude]: readonly [number, number]) {
  return Number.isFinite(longitude)
    && Number.isFinite(latitude)
    && Math.abs(longitude) <= 180
    && Math.abs(latitude) <= MAX_MERCATOR_LATITUDE;
}

function routePointCountError(
  distinctPointCount: number,
  route: RouteMetadata,
): string | null {
  const minimum = route.closed ? 3 : 2;
  if (distinctPointCount < minimum) {
    return route.closed
      ? 'Closed routes need at least three distinct semantic points.'
      : 'Routes need at least two distinct semantic points.';
  }
  const maximum = route.closed && (route.kind === 'arc' || route.kind === 'road')
    ? ROUTE_POINT_LIMITS[route.kind] - 1
    : ROUTE_POINT_LIMITS[route.kind];
  if (distinctPointCount <= maximum) return null;
  const closedArcSuffix = route.kind === 'arc' && route.closed ? ' when closed' : '';
  const label = `${route.kind[0].toUpperCase()}${route.kind.slice(1)}`;
  return `${label} routes support at most ${maximum} distinct semantic points${closedArcSuffix}.`;
}

function routeLoopError(
  points: readonly (readonly [number, number])[],
  route: RouteMetadata,
): string | null {
  const isFirstRepeated = arePositionsEqual(points[0], points.at(-1)!);
  if (!isFirstRepeated && route.closed) {
    return 'Closed routes must repeat their first semantic point last.';
  }
  if (isFirstRepeated && !route.closed) {
    return 'Open routes may not repeat their first semantic point last.';
  }
  return null;
}

export function routePointValidationError(
  points: readonly (readonly [number, number])[],
  route: RouteMetadata,
): string | null {
  if (!ROUTE_KINDS.includes(route.kind) || typeof route.closed !== 'boolean') {
    return 'Route metadata is invalid.';
  }
  if (points.some((point) => !isValidRoutePosition(point))) {
    return 'Route semantic points must contain valid longitude and latitude values.';
  }
  const distinctPoints = route.closed ? points.slice(0, -1) : points;
  const countError = routePointCountError(distinctPoints.length, route);
  if (countError) return countError;
  const loopError = routeLoopError(points, route);
  if (loopError) return loopError;
  const keys = distinctPoints.map((point) => routePositionKey(point));
  return new Set(keys).size === keys.length
    ? null
    : 'Route semantic points must be distinct except for the canonical closing point.';
}

function arcKindValidationError(layer: ContentLayer): string | null {
  if (layer.geometry?.type !== 'Arc') return 'Arc routes require Arc geometry.';
  return layer.provenance?.service === 'directions-v5'
    || layer.provenance?.service === 'map-matching-v5'
    ? 'Arc routes may not retain provider route provenance.'
    : null;
}

function lineKindValidationError(layer: ContentLayer): string | null {
  const isRoad = layer.route?.kind === 'road';
  if (layer.geometry?.type !== 'LineString') {
    return `${isRoad ? 'Road' : 'Straight'} routes require LineString geometry.`;
  }
  if (isRoad) {
    return layer.provenance?.service === 'directions-v5'
      ? null
      : 'Road routes require Directions provenance.';
  }
  return layer.provenance?.service === 'directions-v5'
    ? 'Straight routes may not retain Directions provenance.'
    : null;
}

function routeKindValidationError(layer: ContentLayer): string | null {
  if (!layer.route) return 'Route layers require route metadata.';
  return layer.route.kind === 'arc'
    ? arcKindValidationError(layer)
    : lineKindValidationError(layer);
}

function roadStructureError(
  layer: CompleteRouteLayer,
  points: readonly (readonly [number, number])[],
): string | null {
  if (layer.geometry.type !== 'LineString') return 'Road routes require LineString geometry.';
  if (layer.geometry.coordinates.some((point) => !isValidRoutePosition(point))) {
    return 'Road geometry contains an invalid rendered position.';
  }
  const provenance = layer.provenance as DirectionsProvenance;
  if (provenance.waypoints.length !== points.length) {
    return 'Road waypoints must agree with route semantic points.';
  }
  return partitionRoadGeometry(layer.geometry.coordinates, points)
    ? null
    : 'Road geometry needs a monotonic partition with at least one non-zero rendered edge per semantic leg.';
}

function routeStructureError(
  layer: CompleteRouteLayer,
  points: readonly (readonly [number, number])[],
): string | null {
  const legs = semanticLegCount(points);
  if (layer.appearance.segmentStyles.length !== legs) {
    return 'Route appearance needs exactly one segment style entry per semantic leg.';
  }
  if (layer.route.kind === 'arc') {
    return layer.geometry.type === 'Arc' && layer.geometry.curvatures.length === legs
      ? null
      : 'Arc routes need exactly one curvature value per semantic leg.';
  }
  return layer.route.kind === 'road'
    ? roadStructureError(layer, points)
    : null;
}

export function routeLayerValidationError(layer: ContentLayer): string | null {
  if (layer.type !== 'route') return 'The layer is not a route.';
  const kindError = routeKindValidationError(layer);
  if (kindError) return kindError;
  if (layer.appearance?.kind !== 'route') return 'Route layers require route appearance.';
  if (!isRouteAppearanceValid(layer.appearance)) return 'Route appearance is invalid.';
  const points = semanticRoutePoints(layer);
  if (!points || !layer.route) return 'Route layers require semantic points.';
  const pointError = routePointValidationError(points, layer.route);
  if (pointError) return pointError;
  return routeStructureError(layer as CompleteRouteLayer, points);
}

export function isCompleteRouteLayer(layer: ContentLayer): layer is CompleteRouteLayer {
  return routeLayerValidationError(layer) === null;
}

export function assertCompleteRouteLayer(layer: ContentLayer): asserts layer is CompleteRouteLayer {
  const error = routeLayerValidationError(layer);
  if (error) throw new Error(error);
}
