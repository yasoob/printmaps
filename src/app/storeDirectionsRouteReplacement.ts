import type {
  ContentLayer,
  DirectionsRouteInput,
} from "../domain/project";
import {
  arePositionsEqual,
  isCompleteRouteLayer,
  semanticRoutePoints,
} from "../domain/routeModel";
import {
  markerAppearanceFor,
  type RouteAuthoringOptions,
} from "../domain/routeProfiles";
import { replaceRouteDraftPoints } from "../domain/routeTransformations";

type ReplacementInput = DirectionsRouteInput & {
  options: RouteAuthoringOptions;
};

function isMoveOnly(
  current: readonly (readonly [number, number])[],
  next: readonly (readonly [number, number])[],
) {
  return current.length === next.length
    && next.some((point) =>
      current.every((candidate) => !arePositionsEqual(candidate, point))
    );
}

export function replacementDirectionsRoute(
  current: ContentLayer,
  input: ReplacementInput,
  isClosed: boolean,
): ContentLayer | null {
  if (current.appearance?.kind !== "route") return null;
  const currentPoints = semanticRoutePoints(current);
  if (!currentPoints) return null;
  const currentSemanticPoints = isClosed
    ? currentPoints.slice(0, -1)
    : currentPoints;
  const nextSemanticPoints = isClosed
    ? input.waypoints.slice(0, -1)
    : input.waypoints;
  const updated = replaceRouteDraftPoints(current, nextSemanticPoints, input);
  if (!updated) return null;
  if (isMoveOnly(currentSemanticPoints, nextSemanticPoints)) {
    updated.appearance.segmentStyles = current.appearance.segmentStyles.map(
      (style) => style && { ...style },
    );
  }
  if (
    (current.appearance.marker?.pictogram ?? null)
    !== input.options.travelMarker
  ) {
    updated.appearance.marker = markerAppearanceFor(input.options.travelMarker);
  }
  return isCompleteRouteLayer(updated) ? updated : null;
}
