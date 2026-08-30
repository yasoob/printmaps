import {
  insertRouteVertex,
  moveRouteVertex,
  removeRouteVertex,
  replaceRouteGeometry,
  setArcSegmentCurvature,
} from "../domain/routeGeometry";
import { createArcGeometry } from "../domain/routeArcGeometry";
import type { ContentLayer } from "../domain/project";
import type { ProjectState } from "./store";
import {
  commitDocument,
  replaceLayers,
  type ProjectSet,
} from "./storeDocument";

type RouteGeometryActions = Pick<
  ProjectState,
  | "insertRouteVertex"
  | "removeRouteVertex"
  | "replaceAuthoredRoute"
  | "replaceRouteGeometry"
  | "setArcSegmentCurvature"
  | "setRouteVertex"
>;

function commitRouteGeometry(
  set: ProjectSet,
  id: string,
  update: (
    layer: ProjectState["document"]["layers"][number] | undefined,
  ) => ProjectState["document"]["layers"][number] | null,
) {
  set((state) => {
    const layer = state.document.layers.find(
      (candidate) => candidate.id === id,
    );
    if (layer?.type !== "route" || layer.locked || !layer.visible) return state;
    const updatedLayer = update(layer);
    if (!updatedLayer) return state;
    return commitDocument(
      state,
      replaceLayers(
        state.document,
        state.document.layers.map((candidate) =>
          candidate.id === id ? updatedLayer : candidate,
        ),
      ),
    );
  });
}

function validateAuthoredRoute(
  current: ContentLayer | undefined,
  expectedLayer: ContentLayer,
):
  | {
      ok: true;
      layer: ContentLayer;
      appearance: Extract<
        NonNullable<ContentLayer["appearance"]>,
        { kind: "route" }
      >;
    }
  | { ok: false; error: string } {
  if (current !== expectedLayer) {
    return {
      ok: false,
      error:
        "This route changed while it was being edited. Reopen Extend/Edit route and try again.",
    };
  }
  if (
    current.type !== "route" ||
    current.locked ||
    !current.visible ||
    current.appearance?.kind !== "route"
  ) {
    return {
      ok: false,
      error: "Unlock and show this route before extending it.",
    };
  }
  return { ok: true, layer: current, appearance: current.appearance };
}

function authoredRouteGeometry(
  current: ContentLayer,
  candidate: Parameters<ProjectState["replaceAuthoredRoute"]>[1],
) {
  if (candidate.type === "Arc") {
    return (
      createArcGeometry(candidate.anchors, candidate.curvatures) ?? undefined
    );
  }
  const updated = replaceRouteGeometry(
    {
      ...current,
      geometry: {
        type: "LineString",
        coordinates:
          current.geometry?.type === "LineString"
            ? current.geometry.coordinates
            : candidate.coordinates,
      },
    },
    candidate.coordinates,
  );
  return updated?.geometry;
}

export function createRouteGeometryActions(
  set: ProjectSet,
): RouteGeometryActions {
  return {
    insertRouteVertex: (id, vertexIndex, coordinate) =>
      commitRouteGeometry(set, id, (layer) =>
        insertRouteVertex(layer, vertexIndex, coordinate),
      ),
    removeRouteVertex: (id, vertexIndex) =>
      commitRouteGeometry(set, id, (layer) =>
        removeRouteVertex(layer, vertexIndex),
      ),
    replaceRouteGeometry: (id, coordinates) =>
      commitRouteGeometry(set, id, (layer) =>
        replaceRouteGeometry(layer, coordinates),
      ),
    replaceAuthoredRoute: (id, candidate, travelMarker, expectedLayer) => {
      let result: ReturnType<ProjectState["replaceAuthoredRoute"]> = {
        ok: false,
        error:
          "The route update is invalid. Review the draft points and try again.",
      };
      set((state) => {
        const current = state.document.layers.find((layer) => layer.id === id);
        const validation = validateAuthoredRoute(current, expectedLayer);
        if (!validation.ok) {
          result = validation;
          return state;
        }
        const geometry = authoredRouteGeometry(validation.layer, candidate);
        if (!geometry) return state;
        const updated: ContentLayer = {
          ...validation.layer,
          appearance: { ...validation.appearance, travelMarker },
          geometry,
        };
        delete updated.provenance;
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
          selectedId: id,
        };
      });
      return result;
    },
    setRouteVertex: (id, vertexIndex, coordinates) =>
      commitRouteGeometry(set, id, (layer) =>
        moveRouteVertex(layer, vertexIndex, coordinates),
      ),
    setArcSegmentCurvature: (id, segmentIndex, curvature) =>
      commitRouteGeometry(set, id, (layer) =>
        setArcSegmentCurvature(layer, segmentIndex, curvature),
      ),
  };
}
