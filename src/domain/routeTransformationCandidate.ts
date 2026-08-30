import type {
  ContentLayer,
  DirectionsRouteInput,
  DirectionsProvenance,
  RouteKind,
} from './project';
import { cloneContentLayer, MAX_MERCATOR_LATITUDE } from './project';
import { createArcGeometry, DEFAULT_ARC_CURVATURE } from './routeArcGeometry';
import type {
  RouteAppearance,
  RouteSegmentStyleOverride,
} from './layerAppearance';
import {
  arePositionsEqual,
  isCompleteRouteLayer,
  routePointValidationError,
  semanticRoutePoints,
  type CompleteRouteLayer,
  type RoutePosition,
} from './routeModel';

type RouteCandidateInput = Readonly<{
  source: CompleteRouteLayer;
  kind: RouteKind;
  points: readonly (readonly [number, number])[];
  styles: readonly (RouteSegmentStyleOverride | null)[];
  curvatures?: readonly number[];
  road?: DirectionsRouteInput;
}>;

function isValidPosition(longitude: number, latitude: number): boolean {
  return Number.isFinite(longitude)
    && Number.isFinite(latitude)
    && longitude >= -180
    && longitude <= 180
    && latitude >= -MAX_MERCATOR_LATITUDE
    && latitude <= MAX_MERCATOR_LATITUDE;
}

export function clonedRoutePoints(
  points: readonly (readonly [number, number])[],
): RoutePosition[] {
  return points.map(([longitude, latitude]) => [longitude, latitude]);
}

function arePointListsEqual(
  left: readonly (readonly [number, number])[],
  right: readonly (readonly [number, number])[],
): boolean {
  return left.length === right.length
    && left.every((point, index) => arePositionsEqual(point, right[index]));
}

function directionsProvenance(input: DirectionsRouteInput): DirectionsProvenance {
  return {
    provider: 'mapbox',
    service: 'directions-v5',
    waypoints: clonedRoutePoints(input.waypoints),
    profile: input.profile,
    distanceMeters: input.distanceMeters,
    durationSeconds: input.durationSeconds,
  };
}

function isValidRoadInput(
  input: DirectionsRouteInput | undefined,
  points: readonly (readonly [number, number])[],
): input is DirectionsRouteInput {
  return Boolean(
    input
    && arePointListsEqual(input.waypoints, points)
    && input.geometry.length >= points.length
    && input.geometry.every(([longitude, latitude]) => isValidPosition(longitude, latitude))
    && Number.isFinite(input.distanceMeters)
    && input.distanceMeters >= 0
    && Number.isFinite(input.durationSeconds)
    && input.durationSeconds >= 0
    && (['driving', 'walking', 'cycling'] as const).includes(input.profile),
  );
}

function clonedAppearance(input: RouteCandidateInput): RouteAppearance {
  return {
    ...input.source.appearance,
    marker: input.source.appearance.marker && {
      ...input.source.appearance.marker,
      placement: { ...input.source.appearance.marker.placement },
    },
    segmentStyles: input.styles.map((style) => style && { ...style }),
  };
}

function arcCandidate(
  input: RouteCandidateInput,
  appearance: RouteAppearance,
): ContentLayer | null {
  const geometry = createArcGeometry(input.points, input.curvatures);
  if (!geometry) return null;
  const candidate: ContentLayer = {
    ...cloneContentLayer(input.source),
    route: { kind: 'arc', closed: input.source.route.closed },
    appearance,
    geometry,
  };
  delete candidate.provenance;
  return candidate;
}

function roadCandidate(
  input: RouteCandidateInput,
  appearance: RouteAppearance,
): ContentLayer | null {
  if (!isValidRoadInput(input.road, input.points)) return null;
  return {
    ...cloneContentLayer(input.source),
    route: { kind: 'road', closed: input.source.route.closed },
    appearance,
    geometry: { type: 'LineString', coordinates: clonedRoutePoints(input.road.geometry) },
    provenance: directionsProvenance(input.road),
  };
}

function straightCandidate(
  input: RouteCandidateInput,
  appearance: RouteAppearance,
): ContentLayer {
  const candidate: ContentLayer = {
    ...cloneContentLayer(input.source),
    route: { kind: 'straight', closed: input.source.route.closed },
    appearance,
    geometry: { type: 'LineString', coordinates: clonedRoutePoints(input.points) },
  };
  if (candidate.provenance?.service === 'directions-v5'
    || candidate.provenance?.service === 'map-matching-v5') delete candidate.provenance;
  return candidate;
}

export function routeCandidate(input: RouteCandidateInput): CompleteRouteLayer | null {
  const route = { kind: input.kind, closed: input.source.route.closed };
  if (routePointValidationError(input.points, route)
    || input.styles.length !== input.points.length - 1) return null;
  const appearance = clonedAppearance(input);
  let candidate: ContentLayer | null;
  if (input.kind === 'arc') candidate = arcCandidate(input, appearance);
  else if (input.kind === 'road') candidate = roadCandidate(input, appearance);
  else candidate = straightCandidate(input, appearance);
  return candidate && isCompleteRouteLayer(candidate) ? candidate : null;
}

export function sourceRoute(layer: ContentLayer): CompleteRouteLayer | null {
  return isCompleteRouteLayer(layer) ? layer : null;
}

export function sourcePoints(layer: CompleteRouteLayer): RoutePosition[] {
  return clonedRoutePoints(semanticRoutePoints(layer)!);
}

export function sourceCurvatures(layer: CompleteRouteLayer): number[] {
  return layer.geometry.type === 'Arc' ? [...layer.geometry.curvatures] : [];
}

export function defaultCurvatures(pointCount: number): number[] {
  return Array.from(
    { length: Math.max(0, pointCount - 1) },
    () => DEFAULT_ARC_CURVATURE,
  );
}

export function reversedCopy<T>(values: readonly T[]): T[] {
  return values.map((_, index) => values[values.length - index - 1]);
}
