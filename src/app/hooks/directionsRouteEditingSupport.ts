import type { ContentLayer } from "../../domain/project";
import {
  isValidPosition,
  semanticRoutePositions,
} from "../../domain/routeGeometry";
import type { RoadTravelMode } from "../../domain/routeProfiles";
import type {
  DirectionsProvider,
  ProviderTravelProfile,
} from "../../services/mapbox/contracts";
import { MapboxProviderError } from "../../services/mapbox/errors";
import { arePositionsEqual } from "../../domain/routeModel";
import { routePointRemovalError } from "../../domain/routePointConstraints";
import type { ProjectState, ReplaceDirectionsRouteRequest } from "../store";
import { normalizedDraftPosition } from "./routeSemanticDraft";

const ROAD_MODE: Record<ProviderTravelProfile, RoadTravelMode> = {
  driving: "car",
  walking: "walk",
  cycling: "bike",
};

export type DirectionsEditOwner = {
  expectedDocumentEpoch: number;
  expectedLayer: ContentLayer;
};

export type PendingDirectionsEdit = DirectionsEditOwner & {
  waypoints: [number, number][];
};

export type DirectionsRouteEditingOptions = {
  documentEpoch: number;
  layers: ContentLayer[];
  provider?: DirectionsProvider;
  replaceDirectionsRoute: ProjectState["replaceDirectionsRoute"];
};

export type RebaseResult =
  | { ok: true; edit: PendingDirectionsEdit }
  | { ok: false; error: string };

export function directionsRouteErrorMessage(error: unknown) {
  return error instanceof MapboxProviderError || error instanceof Error
    ? error.message
    : "The road route could not be updated. Retry or cancel this waypoint edit.";
}

export async function requestDirectionsEdit(provider: DirectionsProvider, edit: PendingDirectionsEdit, signal: AbortSignal) {
  const provenance = edit.expectedLayer.provenance;
  if (provenance?.service !== "directions-v5") throw new Error("This route no longer has Road waypoint data.");
  const response = await provider.directions({ profile: provenance.profile, signal, waypoints: edit.waypoints });
  const route = response.routes[0];
  if (!route) throw new Error("No road route matched these waypoints. Adjust the waypoint and retry.");
  return { route, profile: provenance.profile };
}

export function directionsReplacementRequest(
  edit: PendingDirectionsEdit,
  route: Awaited<
    ReturnType<DirectionsProvider["directions"]>
  >["routes"][number],
  profile: ProviderTravelProfile,
): ReplaceDirectionsRouteRequest {
  const appearance = edit.expectedLayer.appearance;
  return {
    id: edit.expectedLayer.id,
    input: {
      geometry: route.geometry.map(([longitude, latitude]) => [
        longitude,
        latitude,
      ]),
      waypoints: edit.waypoints,
      profile,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
    },
    options: {
      lineShape: "road",
      roadTravelMode: ROAD_MODE[profile],
      travelMarker:
        appearance?.kind === "route" ? appearance.marker?.pictogram ?? null : null,
    },
    expectedDocumentEpoch: edit.expectedDocumentEpoch,
    expectedLayer: edit.expectedLayer,
  };
}

function copyWaypoints(
  waypoints: readonly (readonly [number, number])[],
): [number, number][] {
  return waypoints.map(
    ([longitude, latitude]) => [longitude, latitude] as [number, number],
  );
}

export function rebasePendingDirectionsEdit(
  edit: PendingDirectionsEdit,
  layer: ContentLayer | undefined,
  documentEpoch: number,
): RebaseResult {
  if (!isCurrentDirectionsEdit(edit, layer, documentEpoch)) {
    return {
      ok: false,
      error:
        "This Road route changed after the waypoint edit. Cancel the pending edit and try again.",
    };
  }
  return {
    ok: true,
    edit: layer === edit.expectedLayer ? edit : { ...edit, expectedLayer: layer! },
  };
}

export function isCurrentDirectionsEdit(
  owner: DirectionsEditOwner,
  layer: ContentLayer | undefined,
  documentEpoch: number,
): boolean {
  if (!isDirectionsLayer(layer)) return false;
  return documentEpoch === owner.expectedDocumentEpoch
    && layer.id === owner.expectedLayer.id
    && layer.route?.closed === owner.expectedLayer.route?.closed
    && layer.geometry === owner.expectedLayer.geometry
    && layer.provenance === owner.expectedLayer.provenance;
}

function isDirectionsLayer(layer: ContentLayer | undefined): layer is ContentLayer {
  return layer?.type === "route" && layer.route?.kind === "road"
    && layer.geometry?.type === "LineString" && layer.provenance?.service === "directions-v5";
}

export function baseDirectionsEdit(
  layer: ContentLayer,
  pending: PendingDirectionsEdit | null,
  documentEpoch: number,
): RebaseResult {
  if (pending && isCurrentDirectionsEdit(pending, layer, documentEpoch)) {
    return rebasePendingDirectionsEdit(pending, layer, documentEpoch);
  }
  return {
    ok: true,
    edit: {
      expectedDocumentEpoch: documentEpoch,
      expectedLayer: layer,
      waypoints: copyWaypoints(semanticRoutePositions(layer) ?? []),
    },
  };
}

export function directionsLayer(layers: ContentLayer[], id: string) {
  const layer = layers.find((candidate) => candidate.id === id);
  return isDirectionsLayer(layer) ? layer : null;
}

export function changedWaypointEdit(
  edit: PendingDirectionsEdit,
  waypointIndex: number,
  coordinate: readonly [number, number],
): RebaseResult {
  if (
    !Number.isSafeInteger(waypointIndex) ||
    !isValidPosition(coordinate[0], coordinate[1])
  ) {
    return {
      ok: false,
      error: "Enter a valid Road waypoint longitude and latitude.",
    };
  }
  if (waypointIndex < 0 || waypointIndex >= edit.waypoints.length) {
    return {
      ok: false,
      error:
        "That Road waypoint no longer exists. Cancel this edit and try again.",
    };
  }
  const normalized = normalizedDraftPosition(coordinate);
  if (arePositionsEqual(normalizedDraftPosition(edit.waypoints[waypointIndex]), normalized)) {
    return { ok: true, edit };
  }
  const waypoints = copyWaypoints(edit.waypoints);
  waypoints[waypointIndex] = normalized;
  if (edit.expectedLayer.route?.closed === true) {
    if (waypointIndex === 0) {
      waypoints[waypoints.length - 1] = [...normalized];
    } else if (waypointIndex === waypoints.length - 1) {
      waypoints[0] = [...normalized];
    }
  }
  return { ok: true, edit: { ...edit, waypoints } };
}

export function removedWaypointEdit(
  edit: PendingDirectionsEdit,
  waypointIndex: number,
): RebaseResult {
  const error = routePointRemovalError({
    pointCount: edit.waypoints.length,
    pointIndex: waypointIndex,
    isClosed: edit.expectedLayer.route?.closed === true,
    isMiddleOnly: true,
  });
  if (error) return { ok: false, error };
  const waypoints = copyWaypoints(edit.waypoints);
  waypoints.splice(waypointIndex, 1);
  return { ok: true, edit: { ...edit, waypoints } };
}
