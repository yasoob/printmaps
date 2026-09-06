import type {
  ContentLayer,
  DirectionsRouteInput,
} from "../domain/project";
import {
  isCompleteRouteLayer,
  semanticRoutePoints,
} from "../domain/routeModel";
import {
  markerAppearanceFor,
  type RouteAuthoringOptions,
} from "../domain/routeProfiles";
import { replaceRouteDraftPoints } from "../domain/routeTransformations";
import { isRouteCoordinateMove, moveRouteSemanticPoints } from "../domain/routePointMovement";

type ReplacementInput = DirectionsRouteInput & {
  options: RouteAuthoringOptions;
};

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
  const updated = isRouteCoordinateMove(currentSemanticPoints, nextSemanticPoints)
    ? moveRouteSemanticPoints(current, nextSemanticPoints, input)
    : replaceRouteDraftPoints(current, nextSemanticPoints, input);
  if (!updated) return null;
  if (
    (current.appearance.marker?.pictogram ?? null)
    !== input.options.travelMarker
  ) {
    updated.appearance = {
      ...updated.appearance,
      marker: markerAppearanceFor(input.options.travelMarker),
    };
  }
  return isCompleteRouteLayer(updated) ? updated : null;
}
