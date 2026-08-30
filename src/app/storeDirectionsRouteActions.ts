import {
  createDefaultRouteAppearance,
  normalizeCameraPrecision,
  type ContentLayer,
  type DirectionsRouteInput,
} from "../domain/project";
import { isValidPosition } from "../domain/routeGeometry";
import { arePositionsEqual, isCompleteRouteLayer } from "../domain/routeModel";
import {
  isRouteAuthoringOptions,
  markerAppearanceFor,
  type RouteAuthoringOptions,
} from "../domain/routeProfiles";
import type { ProjectState } from "./store";
import {
  commitDocument,
  replaceLayers,
  type ProjectSet,
} from "./storeDocument";
import { replacementDirectionsRoute } from "./storeDirectionsRouteReplacement";

type CanonicalDirectionsRoute = DirectionsRouteInput & {
  options: RouteAuthoringOptions;
};
type PositionLimits = {
  maximum: number;
  minimum: number;
  requireAllDistinct: boolean;
};

const PROFILE_BY_MODE = {
  car: "driving",
  walk: "walking",
  bike: "cycling",
} as const;

function canonicalPosition(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [longitude, latitude] = value;
  if (typeof longitude !== "number" || typeof latitude !== "number")
    return null;
  const normalized: [number, number] = [
    normalizeCameraPrecision(longitude),
    normalizeCameraPrecision(latitude),
  ];
  return isValidPosition(normalized[0], normalized[1]) ? normalized : null;
}

function canonicalPositions(
  value: unknown,
  limits: PositionLimits,
): [number, number][] | null {
  if (
    !Array.isArray(value) ||
    value.length < limits.minimum ||
    value.length > limits.maximum
  )
    return null;
  const positions: [number, number][] = [];
  for (const valuePosition of value) {
    const position = canonicalPosition(valuePosition);
    if (!position) return null;
    positions.push(position);
  }
  const distinct = new Set(
    positions.map((position) => `${position[0]},${position[1]}`),
  ).size;
  if (
    distinct < 2 ||
    (limits.requireAllDistinct && distinct !== positions.length)
  )
    return null;
  return positions;
}

function areWaypointsCanonical(
  waypoints: readonly (readonly [number, number])[],
  isClosed: boolean,
): boolean {
  const distinctWaypoints = isClosed ? waypoints.slice(0, -1) : waypoints;
  const keys = distinctWaypoints.map(([longitude, latitude]) => `${longitude},${latitude}`);
  if (new Set(keys).size !== keys.length) return false;
  if (!isClosed) return !arePositionsEqual(waypoints[0], waypoints.at(-1)!);
  return waypoints.length >= 4
    && distinctWaypoints.length <= 24
    && arePositionsEqual(waypoints[0], waypoints.at(-1)!);
}

function directionsInput(value: unknown): Partial<DirectionsRouteInput> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  return value as Partial<DirectionsRouteInput>;
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function canonicalDirectionsRoute(
  value: unknown,
  options: unknown,
  isClosed = false,
): CanonicalDirectionsRoute | null {
  if (!isRouteAuthoringOptions(options) || options.lineShape !== "road")
    return null;
  const input = directionsInput(value);
  if (!input) return null;
  const waypoints = canonicalPositions(input.waypoints, {
    minimum: 2,
    maximum: 25,
    requireAllDistinct: false,
  });
  const geometry = canonicalPositions(input.geometry, {
    minimum: 2,
    maximum: 50_000,
    requireAllDistinct: false,
  });
  if (!waypoints || !geometry) return null;
  if (!areWaypointsCanonical(waypoints, isClosed)) return null;
  const expectedProfile = PROFILE_BY_MODE[options.roadTravelMode];
  if (input.profile !== expectedProfile) return null;
  if (
    !isNonNegativeFinite(input.distanceMeters) ||
    !isNonNegativeFinite(input.durationSeconds)
  )
    return null;
  return {
    geometry,
    waypoints,
    profile: input.profile,
    distanceMeters: input.distanceMeters,
    durationSeconds: input.durationSeconds,
    options,
  };
}

function nextRouteIdentity(layers: readonly ContentLayer[]) {
  const usedIds = new Set(layers.map(({ id }) => id));
  let number = 1;
  while (usedIds.has(`route-${String(number).padStart(2, "0")}`)) number += 1;
  return { id: `route-${String(number).padStart(2, "0")}`, number };
}

function routeLayer(
  identity: ReturnType<typeof nextRouteIdentity>,
  input: CanonicalDirectionsRoute,
): ContentLayer | null {
  const appearance = createDefaultRouteAppearance(input.waypoints.length - 1);
  const candidate: ContentLayer = {
    id: identity.id,
    name: `Route ${String(identity.number).padStart(2, "0")}`,
    type: "route",
    route: { kind: "road", closed: false },
    visible: true,
    locked: false,
    opacity: 100,
    appearance: {
      ...appearance,
      marker: markerAppearanceFor(input.options.travelMarker),
    },
    geometry: { type: "LineString", coordinates: input.geometry },
    provenance: {
      provider: "mapbox",
      service: "directions-v5",
      waypoints: input.waypoints,
      profile: input.profile,
      distanceMeters: input.distanceMeters,
      durationSeconds: input.durationSeconds,
    },
  };
  return isCompleteRouteLayer(candidate) ? candidate : null;
}

function mutationFailure(
  error: string,
): ReturnType<ProjectState["createDirectionsRoute"]> {
  return { ok: false, error };
}

export function createDirectionsRouteActions(
  set: ProjectSet,
): Pick<ProjectState, "createDirectionsRoute" | "replaceDirectionsRoute"> {
  const createDirectionsRoute: ProjectState["createDirectionsRoute"] = (
    candidate,
    options,
    expectedDocumentEpoch,
  ) => {
    let result: ReturnType<ProjectState["createDirectionsRoute"]> = {
      ok: false,
      error:
        "The road route response was invalid. Keep the waypoints and try routing again.",
    };
    set((state) => {
      if (state.documentEpoch !== expectedDocumentEpoch) {
        result = {
          ok: false,
          error:
            "The project changed before the road route finished. Review the waypoints and try again.",
        };
        return state;
      }
      const input = canonicalDirectionsRoute(candidate, options);
      if (!input) return state;
      const route = routeLayer(nextRouteIdentity(state.document.layers), input);
      if (!route) return state;
      const layers = [...state.document.layers];
      const basemapIndex = layers.findIndex(({ type }) => type === "basemap");
      layers.splice(
        basemapIndex === -1 ? layers.length : basemapIndex,
        0,
        route,
      );
      result = { ok: true, routeId: route.id };
      return {
        ...commitDocument(state, replaceLayers(state.document, layers)),
        selectedId: route.id,
      };
    });
    return result;
  };

  const replaceDirectionsRoute: ProjectState["replaceDirectionsRoute"] = ({
    id,
    input: candidate,
    options,
    expectedDocumentEpoch,
    expectedLayer,
    selectRoute = false,
  }) => {
    let result = mutationFailure(
      "The road route response was invalid. Keep the waypoints and try routing again.",
    );
    set((state) => {
      if (state.documentEpoch !== expectedDocumentEpoch) {
        result = mutationFailure(
          "The project changed before the road route finished. Review the waypoints and try again.",
        );
        return state;
      }
      const current = state.document.layers.find((layer) => layer.id === id);
      if (current !== expectedLayer) {
        result = mutationFailure(
          "This route changed before routing finished. Review the route and try again.",
        );
        return state;
      }
      if (
        current.type !== "route" ||
        current.locked ||
        !current.visible ||
        current.appearance?.kind !== "route"
      ) {
        result = mutationFailure(
          "Unlock and show this route before editing its waypoints.",
        );
        return state;
      }
      const isClosed = current.route?.closed === true;
      const input = canonicalDirectionsRoute(candidate, options, isClosed);
      if (!input) return state;
      const updated = replacementDirectionsRoute(current, input, isClosed);
      if (!updated) return state;
      result = { ok: true, routeId: id };
      return {
        ...commitDocument(
          state,
          replaceLayers(
            state.document,
            state.document.layers.map((layer) =>
              layer.id === id ? updated : layer,
            ),
          ),
        ),
        selectedId: selectRoute ? id : state.selectedId,
      };
    });
    return result;
  };

  return { createDirectionsRoute, replaceDirectionsRoute };
}
