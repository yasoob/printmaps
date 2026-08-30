import {
  normalizeCameraPrecision,
  type ContentLayer,
  type DirectionsRouteInput,
} from "../../domain/project";
import {
  createArcGeometry,
  DEFAULT_ARC_CURVATURE,
} from "../../domain/routeArcGeometry";
import {
  isValidPosition,
  semanticRoutePositions,
} from "../../domain/routeGeometry";
import {
  buildRouteCoordinates,
  type RouteAuthoringOptions,
} from "../../domain/routeProfiles";
import type { RouteMutationResult } from "../store";
import { countDistinctPoints } from "./authoringDraftLayers";
import { roadProfileFor } from "../hooks/useDirectionsAuthoring";

export const MAX_ROAD_ROUTE_WAYPOINTS = 25;

export function appendRoutePoint(
  points: [number, number][],
  coordinate: readonly [number, number],
  lineShape: RouteAuthoringOptions["lineShape"],
) {
  if (!isValidPosition(coordinate[0], coordinate[1])) {
    return {
      error:
        "Enter a longitude from -180 to 180 and a latitude within the Web Mercator map bounds.",
      points,
    };
  }
  if (lineShape === "road" && points.length >= MAX_ROAD_ROUTE_WAYPOINTS) {
    return { error: "Road routes support up to 25 waypoints.", points };
  }
  const normalized = [
    normalizeCameraPrecision(coordinate[0]),
    normalizeCameraPrecision(coordinate[1]),
  ] as [number, number];
  if (
    points.some(
      ([longitude, latitude]) =>
        longitude === normalized[0] && latitude === normalized[1],
    )
  ) {
    return {
      error:
        "That route point is already present. Choose a different location.",
      points,
    };
  }
  const next = [
    ...points.map(
      ([longitude, latitude]) => [longitude, latitude] as [number, number],
    ),
    normalized,
  ];
  if (lineShape === "arc" && next.length >= 2 && !createArcGeometry(next)) {
    return {
      error:
        "This point would create an impossible Arc segment. Choose a different location.",
      points,
    };
  }
  return { error: null, points: next };
}

export const appendRoadSearchWaypoint = (
  points: [number, number][],
  coordinate: readonly [number, number],
) => appendRoutePoint(points, coordinate, "road");

export type RouteExtensionEndpoint = "start" | "end";

type AppendRouteExtensionPointOptions = {
  additions: [number, number][];
  coordinate: readonly [number, number];
  endpoint: RouteExtensionEndpoint;
  layer: ContentLayer;
  lineShape: RouteAuthoringOptions["lineShape"];
};

export function appendRouteExtensionPoint({
  additions,
  coordinate,
  endpoint,
  layer,
  lineShape,
}: AppendRouteExtensionPointOptions) {
  const next = appendRoutePoint(additions, coordinate, lineShape);
  if (next.error) return next;
  const base = semanticRoutePositions(layer);
  const added = next.points.at(-1);
  if (!base || !added) {
    return {
      error: "This route no longer has editable points. Cancel the extension and try again.",
      points: additions,
    };
  }
  const normalizedBase = base.map(
    ([longitude, latitude]) =>
      [
        normalizeCameraPrecision(longitude),
        normalizeCameraPrecision(latitude),
      ] as [number, number],
  );
  if (
    normalizedBase.some(
      ([longitude, latitude]) =>
        longitude === added[0] && latitude === added[1],
    )
  ) {
    return {
      error: "That route point is already present. Choose a different location.",
      points: additions,
    };
  }
  const combined = extendedRoutePoints(layer, next.points, endpoint);
  if (
    lineShape === "road" &&
    (!combined || combined.length > MAX_ROAD_ROUTE_WAYPOINTS)
  ) {
    return {
      error: "Road routes support up to 25 waypoints.",
      points: additions,
    };
  }
  if (
    lineShape === "arc" &&
    !extendedLocalRouteGeometry(layer, next.points, endpoint)
  ) {
    return {
      error:
        "This point would create an impossible Arc segment. Choose a different location.",
      points: additions,
    };
  }
  return next;
}

export function extendedRoutePoints(
  layer: ContentLayer,
  additions: readonly (readonly [number, number])[],
  endpoint: RouteExtensionEndpoint,
): [number, number][] | null {
  const base = semanticRoutePositions(layer);
  if (!base) return null;
  const copiedBase = base.map(
    ([longitude, latitude]) => [longitude, latitude] as [number, number],
  );
  const copiedAdditions = additions.map(
    ([longitude, latitude]) => [longitude, latitude] as [number, number],
  );
  const prepended: [number, number][] = [];
  for (let index = copiedAdditions.length - 1; index >= 0; index -= 1) {
    const point = copiedAdditions[index];
    if (point) prepended.push(point);
  }
  return endpoint === "start"
    ? [...prepended, ...copiedBase]
    : [...copiedBase, ...copiedAdditions];
}

export function extendedLocalRouteGeometry(
  layer: ContentLayer,
  additions: readonly (readonly [number, number])[],
  endpoint: RouteExtensionEndpoint,
) {
  const coordinates = extendedRoutePoints(layer, additions, endpoint);
  if (!coordinates) return null;
  if (layer.geometry?.type === "LineString")
    return { type: "LineString" as const, coordinates };
  if (layer.geometry?.type !== "Arc") return null;
  const defaults = Array.from(
    { length: additions.length },
    () => DEFAULT_ARC_CURVATURE,
  );
  return createArcGeometry(
    coordinates,
    endpoint === "start"
      ? [...defaults, ...layer.geometry.curvatures]
      : [...layer.geometry.curvatures, ...defaults],
  );
}

type RoadDirections = {
  route: (
    waypoints: readonly (readonly [number, number])[],
    options: RouteAuthoringOptions,
  ) => Promise<RouteMutationResult | null>;
};

type FinishRouteOptions = {
  coordinates: [number, number][];
  directions: RoadDirections;
  exit: () => void;
  onCreateRoute: (
    coordinates: readonly (readonly [number, number])[],
    options?: RouteAuthoringOptions,
  ) => RouteMutationResult;
  routeOptions: RouteAuthoringOptions;
};

export function canFinishRoute(
  points: readonly (readonly [number, number])[],
  options: RouteAuthoringOptions,
) {
  return (
    countDistinctPoints(points) >= 2 &&
    buildRouteCoordinates(points, options.lineShape).length >= 2 &&
    (options.lineShape !== "road" ||
      roadProfileFor(options.roadTravelMode) !== null)
  );
}

export function routeFinishExplanation(
  points: readonly (readonly [number, number])[],
  options: RouteAuthoringOptions,
  isRouting: boolean,
): string {
  if (isRouting) return "Wait for the current road request to finish.";
  if (countDistinctPoints(points) < 2)
    return "Add at least two distinct valid points to finish.";
  if (options.lineShape === "arc" && !createArcGeometry(points)) {
    return "Move an Arc endpoint so every segment has valid geometry.";
  }
  return "Ready to finish this route.";
}

export function finishRouteCoordinates(options: FinishRouteOptions) {
  if (countDistinctPoints(options.coordinates) < 2) return;
  if (options.routeOptions.lineShape === "road") {
    void options.directions
      .route(options.coordinates, options.routeOptions)
      .then((result) => {
        if (result?.ok) options.exit();
      });
    return;
  }
  const result = options.onCreateRoute(
    options.coordinates,
    options.routeOptions,
  );
  if (result.ok) options.exit();
}

export type CreateDirectionsRoute = (
  input: DirectionsRouteInput,
  options: RouteAuthoringOptions,
  expectedDocumentEpoch: number,
) => RouteMutationResult;
