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
import type { ProjectState, ReplaceDirectionsRouteRequest } from "../store";

const ROAD_MODE: Record<ProviderTravelProfile, RoadTravelMode> = {
  driving: "car",
  walking: "walk",
  cycling: "bike",
};

export type PendingDirectionsEdit = {
  expectedDocumentEpoch: number;
  expectedLayer: ContentLayer;
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
        appearance?.kind === "route" ? appearance.travelMarker : null,
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
  layer: ContentLayer,
  documentEpoch: number,
): RebaseResult {
  if (layer === edit.expectedLayer) {
    return {
      ok: true,
      edit: { ...edit, expectedDocumentEpoch: documentEpoch },
    };
  }
  if (
    layer.geometry !== edit.expectedLayer.geometry ||
    layer.provenance !== edit.expectedLayer.provenance
  ) {
    return {
      ok: false,
      error:
        "This Road route changed after the waypoint edit. Cancel the pending edit and try again.",
    };
  }
  return {
    ok: true,
    edit: { ...edit, expectedDocumentEpoch: documentEpoch, expectedLayer: layer },
  };
}

export function baseDirectionsEdit(
  layer: ContentLayer,
  pending: PendingDirectionsEdit | null,
  documentEpoch: number,
): RebaseResult {
  if (pending?.expectedLayer.id === layer.id) {
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
  return layer?.provenance?.service === "directions-v5" ? layer : null;
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
  const waypoints = copyWaypoints(edit.waypoints);
  waypoints[waypointIndex] = [coordinate[0], coordinate[1]];
  return { ok: true, edit: { ...edit, waypoints } };
}

export function removedWaypointEdit(
  edit: PendingDirectionsEdit,
  waypointIndex: number,
): RebaseResult {
  if (
    waypointIndex <= 0 ||
    waypointIndex >= edit.waypoints.length - 1
  ) {
    return {
      ok: false,
      error: "Only a middle Road waypoint can be deleted.",
    };
  }
  const waypoints = copyWaypoints(edit.waypoints);
  waypoints.splice(waypointIndex, 1);
  return { ok: true, edit: { ...edit, waypoints } };
}
