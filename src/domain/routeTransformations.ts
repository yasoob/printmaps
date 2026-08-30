import type {
  ContentLayer,
  DirectionsRouteInput,
  RouteKind,
} from './project';
import { DEFAULT_ARC_CURVATURE } from './routeArcGeometry';
import type { CompleteRouteLayer } from './routeModel';
import { arePositionsEqual, semanticRoutePoints } from './routeModel';
import { extendRoute, insertRoutePoint } from './routePointTransformations';
import {
  removeRoutePoint,
  reorderRoutePoints,
  replaceRouteSemanticPoints,
} from './routePointRemovalTransformations';
import {
  defaultCurvatures,
  reversedCopy,
  routeCandidate,
  sourceCurvatures,
  sourcePoints,
  sourceRoute,
} from './routeTransformationCandidate';

export {
  extendRoute,
  insertRoutePoint,
  removeRoutePoint,
  replaceRouteSemanticPoints,
  reorderRoutePoints,
  type RouteEndpoint,
} from './routePointTransformations';

function arePointListsEqual(
  left: readonly (readonly [number, number])[],
  right: readonly (readonly [number, number])[],
): boolean {
  return left.length === right.length
    && left.every((point, index) => arePositionsEqual(point, right[index]));
}

function insertedPointIndex(
  draftPoints: readonly (readonly [number, number])[],
  currentPoints: readonly (readonly [number, number])[],
): number | null {
  if (draftPoints.length !== currentPoints.length + 1) return null;
  const index = draftPoints.findIndex((_point, candidateIndex) =>
    arePointListsEqual(
      draftPoints.filter((_candidate, index) => index !== candidateIndex),
      currentPoints,
    )
  );
  return index > 0 && index < draftPoints.length - 1 ? index : null;
}

export function replaceRouteDraftPoints(
  layer: ContentLayer,
  draftPoints: readonly (readonly [number, number])[],
  road?: DirectionsRouteInput,
): CompleteRouteLayer | null {
  const source = sourceRoute(layer);
  if (!source) return null;
  const current = semanticRoutePoints(source)!;
  const unique = source.route.closed ? current.slice(0, -1) : current;

  if (draftPoints.length > unique.length) {
    if (arePointListsEqual(draftPoints.slice(0, unique.length), unique)) {
      return extendRoute(source, 'end', draftPoints.slice(unique.length), road);
    }
    if (arePointListsEqual(draftPoints.slice(draftPoints.length - unique.length), unique)) {
      return extendRoute(
        source,
        'start',
        reversedCopy(draftPoints.slice(0, draftPoints.length - unique.length)),
        road,
      );
    }
  }

  if (draftPoints.length === unique.length - 1) {
    const removedIndex = unique.findIndex((_point, index) => (
      arePointListsEqual(unique.filter((_candidate, candidateIndex) => candidateIndex !== index), draftPoints)
    ));
    if (removedIndex !== -1) return removeRoutePoint(source, removedIndex, road);
  }

  const insertedIndex = insertedPointIndex(draftPoints, unique);
  if (insertedIndex !== null) {
    return insertRoutePoint(
      source,
      insertedIndex - 1,
      draftPoints[insertedIndex],
      road,
    );
  }

  if (
    draftPoints.length === unique.length
    && draftPoints.every((point) => unique.some((candidate) => arePositionsEqual(candidate, point)))
  ) {
    const order = draftPoints.map((point) => (
      unique.findIndex((candidate) => arePositionsEqual(candidate, point))
    ));
    return reorderRoutePoints(source, order, road);
  }

  return replaceRouteSemanticPoints(source, draftPoints, road);
}

export function convertRoute(
  layer: ContentLayer,
  kind: RouteKind,
  road?: DirectionsRouteInput,
): CompleteRouteLayer | null {
  const source = sourceRoute(layer);
  if (!source) return null;
  const points = sourcePoints(source);
  const curvatures = kind === 'arc'
    ? (source.route.kind === 'arc' ? sourceCurvatures(source) : defaultCurvatures(points.length))
    : undefined;
  return routeCandidate({
    source,
    kind,
    points,
    styles: source.appearance.segmentStyles,
    curvatures,
    road,
  });
}

export function reverseRoute(
  layer: ContentLayer,
  road?: DirectionsRouteInput,
): CompleteRouteLayer | null {
  const source = sourceRoute(layer);
  if (!source) return null;
  return routeCandidate({
    source,
    kind: source.route.kind,
    points: reversedCopy(sourcePoints(source)),
    styles: reversedCopy(source.appearance.segmentStyles),
    curvatures: source.route.kind === 'arc'
      ? reversedCopy(sourceCurvatures(source))
      : undefined,
    road,
  });
}

export function closeRoute(
  layer: ContentLayer,
  road?: DirectionsRouteInput,
): CompleteRouteLayer | null {
  const source = sourceRoute(layer);
  if (!source || source.route.closed) return null;
  const points = sourcePoints(source);
  if (points.length < 3) return null;
  points.push([...points[0]]);
  const closedSource = { ...source, route: { ...source.route, closed: true } };
  return routeCandidate({
    source: closedSource,
    kind: source.route.kind,
    points,
    styles: [...source.appearance.segmentStyles, null],
    curvatures: source.route.kind === 'arc'
      ? [...sourceCurvatures(source), DEFAULT_ARC_CURVATURE]
      : undefined,
    road,
  });
}

export function openRoute(
  layer: ContentLayer,
  road?: DirectionsRouteInput,
): CompleteRouteLayer | null {
  const source = sourceRoute(layer);
  if (!source || !source.route.closed) return null;
  const openSource = { ...source, route: { ...source.route, closed: false } };
  return routeCandidate({
    source: openSource,
    kind: source.route.kind,
    points: sourcePoints(source).slice(0, -1),
    styles: source.appearance.segmentStyles.slice(0, -1),
    curvatures: source.route.kind === 'arc'
      ? sourceCurvatures(source).slice(0, -1)
      : undefined,
    road,
  });
}
