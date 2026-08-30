import {
  closeRoute,
  convertRoute,
  openRoute,
  reverseRoute,
  replaceRouteDraftPoints,
} from "../domain/routeTransformations";
import { markerAppearanceFor } from "../domain/routeProfiles";
import type {
  ProjectState,
  RouteMutationResult,
  RouteTransformOperation,
  TransformRouteRequest,
} from "./store";
import { commitDocument, replaceLayers, type ProjectSet } from "./storeDocument";

function failure(error: string): RouteMutationResult {
  return { ok: false, error };
}

function candidateFor(request: TransformRouteRequest) {
  const { expectedLayer: layer, operation, road } = request;
  switch (operation.type) {
    case "convert": {
      if (layer.route?.kind === operation.targetKind) return null;
      return convertRoute(layer, operation.targetKind, road);
    }
    case "reverse": {
      return reverseRoute(layer, road);
    }
    case "close": {
      return closeRoute(layer, road);
    }
    case "open": {
      return openRoute(layer, road);
    }
  }
}

function invalidOperationMessage(operation: RouteTransformOperation): string {
  if (operation.type === "close") {
    return "This route cannot be closed. A loop needs at least three distinct points.";
  }
  if (operation.type === "open") return "This route is already open.";
  if (operation.type === "reverse") return "This route cannot be reversed.";
  return "This route cannot be converted to the selected path type.";
}

export function createRouteTransformActions(
  set: ProjectSet,
): Pick<ProjectState, "replaceRouteDraft" | "transformRoute"> {
  const transformRoute: ProjectState["transformRoute"] = (request) => {
    let result = failure(invalidOperationMessage(request.operation));
    set((state) => {
      if (state.documentEpoch !== request.expectedDocumentEpoch) {
        result = failure(
          "The project changed before the route operation finished. Review the route and try again.",
        );
        return state;
      }
      const current = state.document.layers.find(({ id }) => id === request.id);
      if (current !== request.expectedLayer) {
        result = failure(
          "This route changed before the operation finished. Review the route and try again.",
        );
        return state;
      }
      if (
        current.type !== "route"
        || current.locked
        || !current.visible
        || current.appearance?.kind !== "route"
      ) {
        result = failure("Unlock and show this route before changing its structure.");
        return state;
      }
      const candidate = candidateFor(request);
      if (!candidate) return state;
      const layers = state.document.layers.map((layer) =>
        layer === current ? candidate : layer
      );
      result = { ok: true, routeId: current.id };
      return commitDocument(state, replaceLayers(state.document, layers));
    });
    return result;
  };
  const replaceRouteDraft: ProjectState["replaceRouteDraft"] = (request) => {
    let result = failure("The route draft is invalid. Review its points and try again.");
    set((state) => {
      if (state.documentEpoch !== request.expectedDocumentEpoch) {
        result = failure(
          "The project changed while this draft was open. Cancel it and try again.",
        );
        return state;
      }
      const current = state.document.layers.find(({ id }) => id === request.id);
      if (current !== request.expectedLayer) {
        result = failure(
          "This route changed while this draft was open. Cancel it and try again.",
        );
        return state;
      }
      if (
        current.type !== "route"
        || current.locked
        || !current.visible
        || current.appearance?.kind !== "route"
      ) {
        result = failure("Unlock and show this route before finishing its draft.");
        return state;
      }
      const candidate = replaceRouteDraftPoints(
        current,
        request.points,
        request.road,
      );
      if (!candidate) return state;
      const currentMarker = current.appearance.marker;
      if ((currentMarker?.pictogram ?? null) !== request.travelMarker) {
        candidate.appearance = {
          ...candidate.appearance,
          marker: markerAppearanceFor(request.travelMarker),
        };
      }
      result = { ok: true, routeId: current.id };
      return {
        ...commitDocument(
          state,
          replaceLayers(
            state.document,
            state.document.layers.map((layer) =>
              layer === current ? candidate : layer
            ),
          ),
        ),
        selectedId: current.id,
      };
    });
    return result;
  };
  return { replaceRouteDraft, transformRoute };
}
