import {
  MAX_MERCATOR_LATITUDE,
  type ContentLayer,
  type DirectionsRouteInput,
} from './project';
import type { RouteSegmentStyleOverride } from './layerAppearance';
import {
  arePositionsEqual,
  type CompleteRouteLayer,
  type RoutePosition,
} from './routeModel';
import {
  clonedRoutePoints,
  defaultCurvatures,
  reversedCopy,
  routeCandidate,
  sourceCurvatures,
  sourcePoints,
  sourceRoute,
} from './routeTransformationCandidate';

export type RouteEndpoint = 'start' | 'end';
export {
  removeRoutePoint,
  replaceRouteSemanticPoints,
  reorderRoutePoints,
} from './routePointRemovalTransformations';
type RouteParts = {
  points: RoutePosition[];
  styles: (RouteSegmentStyleOverride | null)[];
  curvatures?: number[];
};

function isValidPosition(longitude: number, latitude: number): boolean {
  return Number.isFinite(longitude)
    && Number.isFinite(latitude)
    && longitude >= -180
    && longitude <= 180
    && latitude >= -MAX_MERCATOR_LATITUDE
    && latitude <= MAX_MERCATOR_LATITUDE;
}

function isNewPointValid(
  points: readonly (readonly [number, number])[],
  point: readonly [number, number],
): boolean {
  const comparisonPoints = arePositionsEqual(points[0], points.at(-1)!)
    ? points.slice(0, -1)
    : points;
  return isValidPosition(point[0], point[1])
    && comparisonPoints.every((candidate) => !arePositionsEqual(candidate, point));
}

function openExtensionParts(
  source: CompleteRouteLayer,
  endpoint: RouteEndpoint,
  additions: RoutePosition[],
): RouteParts {
  const original = sourcePoints(source);
  const inherited = Array.from({ length: additions.length }, () => null);
  const addedCurves = defaultCurvatures(additions.length + 1).slice(0, additions.length);
  if (endpoint === 'start') {
    return {
      points: [...reversedCopy(additions), ...original],
      styles: [...inherited, ...source.appearance.segmentStyles],
      curvatures: source.route.kind === 'arc'
        ? [...addedCurves, ...sourceCurvatures(source)]
        : undefined,
    };
  }
  return {
    points: [...original, ...additions],
    styles: [...source.appearance.segmentStyles, ...inherited],
    curvatures: source.route.kind === 'arc'
      ? [...sourceCurvatures(source), ...addedCurves]
      : undefined,
  };
}

function closingStyles(
  source: CompleteRouteLayer,
  count: number,
): (RouteSegmentStyleOverride | null)[] {
  const style = source.appearance.segmentStyles.at(-1) ?? null;
  return Array.from({ length: count }, () => style && { ...style });
}

function closedEndExtensionParts(
  source: CompleteRouteLayer,
  additions: RoutePosition[],
): RouteParts {
  const original = sourcePoints(source);
  const closingCurvature = sourceCurvatures(source).at(-1);
  return {
    points: [...original.slice(0, -1), ...additions, [...original[0]]],
    styles: [
      ...source.appearance.segmentStyles.slice(0, -1),
      ...closingStyles(source, additions.length + 1),
    ],
    curvatures: source.route.kind === 'arc'
      ? [
          ...sourceCurvatures(source).slice(0, -1),
          ...Array.from(
            { length: additions.length + 1 },
            () => closingCurvature!,
          ),
        ]
      : undefined,
  };
}

function closedStartExtensionParts(
  source: CompleteRouteLayer,
  additions: RoutePosition[],
): RouteParts {
  const original = sourcePoints(source);
  const reversed = reversedCopy(additions);
  const newStart = reversed[0];
  const closingCurvature = sourceCurvatures(source).at(-1);
  return {
    points: [newStart, ...reversed.slice(1), ...original.slice(0, -1), [...newStart]],
    styles: [
      ...closingStyles(source, additions.length),
      ...source.appearance.segmentStyles.slice(0, -1),
      ...closingStyles(source, 1),
    ],
    curvatures: source.route.kind === 'arc'
      ? [
          ...Array.from({ length: additions.length }, () => closingCurvature!),
          ...sourceCurvatures(source).slice(0, -1),
          closingCurvature!,
        ]
      : undefined,
  };
}

function closedExtensionParts(
  source: CompleteRouteLayer,
  endpoint: RouteEndpoint,
  additions: RoutePosition[],
): RouteParts {
  return endpoint === 'end'
    ? closedEndExtensionParts(source, additions)
    : closedStartExtensionParts(source, additions);
}

export function extendRoute(
  layer: ContentLayer,
  endpoint: RouteEndpoint,
  addedPoints: readonly (readonly [number, number])[],
  road?: DirectionsRouteInput,
): CompleteRouteLayer | null {
  const source = sourceRoute(layer);
  if (!source || addedPoints.length === 0) return null;
  const original = sourcePoints(source);
  const unique = source.route.closed ? original.slice(0, -1) : original;
  const additions = clonedRoutePoints(addedPoints);
  const areAdditionsValid = additions.every((point, index) =>
    isNewPointValid([...unique, ...additions.slice(0, index)], point)
  );
  if (!areAdditionsValid) return null;
  const parts = source.route.closed
    ? closedExtensionParts(source, endpoint, additions)
    : openExtensionParts(source, endpoint, additions);
  return routeCandidate({
    source,
    kind: source.route.kind,
    ...parts,
    road,
  });
}

export function insertRoutePoint(
  layer: ContentLayer,
  legIndex: number,
  point: readonly [number, number],
  road?: DirectionsRouteInput,
): CompleteRouteLayer | null {
  const source = sourceRoute(layer);
  if (!source
    || !Number.isSafeInteger(legIndex)
    || legIndex < 0
    || legIndex >= source.appearance.segmentStyles.length) return null;
  const points = sourcePoints(source);
  if (!isNewPointValid(points, point)) return null;
  points.splice(legIndex + 1, 0, [point[0], point[1]]);
  const splitStyle = source.appearance.segmentStyles[legIndex];
  const styles = source.appearance.segmentStyles.map((style) => style && { ...style });
  styles.splice(legIndex, 1, splitStyle && { ...splitStyle }, splitStyle && { ...splitStyle });
  const curvatures = source.route.kind === 'arc' ? sourceCurvatures(source) : undefined;
  if (curvatures) {
    const curvature = curvatures[legIndex];
    curvatures.splice(legIndex, 1, curvature, curvature);
  }
  return routeCandidate({
    source,
    kind: source.route.kind,
    points,
    styles,
    curvatures,
    road,
  });
}
