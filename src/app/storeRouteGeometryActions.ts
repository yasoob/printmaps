import {
  insertRouteVertex,
  moveRouteVertex,
  removeRouteVertex,
  replaceRouteGeometry,
  setArcSegmentCurvature,
} from "../domain/routeGeometry";
import { createArcGeometry } from "../domain/routeArcGeometry";
import type { ContentLayer } from "../domain/project";
import { isCompleteRouteLayer } from "../domain/routeModel";
import { markerAppearanceFor } from "../domain/routeProfiles";
import { mutationRejected } from "../domain/projectMutation";
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
  isUnchanged?: (layer: ContentLayer) => boolean,
) {
  return set((state) => {
    const layer = state.document.layers.find(
      (candidate) => candidate.id === id,
    );
    if (layer?.type !== "route" || layer.locked || !layer.visible) return mutationRejected("Unlock and show this route before editing it.", 'unavailable');
    if (isUnchanged?.(layer)) return state;
    const updatedLayer = update(layer);
    if (!updatedLayer || !isCompleteRouteLayer(updatedLayer)) return mutationRejected("This route edit is invalid. The original route was kept.");
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

function geometryPoints(layer: ContentLayer) {
  return layer.geometry?.type === 'Arc' ? layer.geometry.anchors
    : (layer.geometry?.type === 'LineString' ? layer.geometry.coordinates : null);
}

function sameRoutePositions(layer: ContentLayer, positions: readonly (readonly [number, number])[]) {
  const current = geometryPoints(layer);
  if (!current) return false;
  const closing = layer.route?.closed && positions.length > 1
    && positions[0][0] === positions.at(-1)![0] && positions[0][1] === positions.at(-1)![1];
  const length = positions.length - (closing ? 1 : 0);
  return length === current.length - (layer.route?.closed ? 1 : 0)
    && positions.slice(0, length).every(([lng, lat], index) => current[index][0] === lng && current[index][1] === lat);
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
      commitRouteGeometry(set, id,
        (layer) => replaceRouteGeometry(layer, coordinates),
        (layer) => sameRoutePositions(layer, coordinates),
      ),
    replaceAuthoredRoute: (id, candidate, travelMarker, expectedLayer) => {
      let result: ReturnType<ProjectState["replaceAuthoredRoute"]> = {
        ok: false,
        error:
          "The route update is invalid. Review the draft points and try again.",
      };
      const admission = set((state) => {
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
          route: {
            kind: geometry.type === "Arc" ? "arc" : "straight",
            closed: false,
          },
          appearance: {
            ...validation.appearance,
            marker: markerAppearanceFor(travelMarker),
            segmentStyles: Array.from({
              length: (geometry.type === "Arc"
                ? geometry.anchors
                : geometry.coordinates).length - 1,
            }, (_unused, index) => validation.appearance.segmentStyles[index] ?? null),
          },
          geometry,
        };
        delete updated.provenance;
        if (!isCompleteRouteLayer(updated)) return state;
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
      return admission.ok ? result : admission;
    },
    setRouteVertex: (id, vertexIndex, coordinates) =>
      commitRouteGeometry(set, id,
        (layer) => moveRouteVertex(layer, vertexIndex, coordinates),
        (layer) => {
          const point = geometryPoints(layer)?.[vertexIndex];
          return Boolean(point && point[0] === coordinates[0] && point[1] === coordinates[1]);
        },
      ),
    setArcSegmentCurvature: (id, segmentIndex, curvature) =>
      commitRouteGeometry(set, id,
        (layer) => setArcSegmentCurvature(layer, segmentIndex, curvature),
        (layer) => layer.geometry?.type === 'Arc'
          && Number.isSafeInteger(segmentIndex) && segmentIndex >= 0 && segmentIndex < layer.geometry.curvatures.length
          && layer.geometry.curvatures[segmentIndex] === curvature,
      ),
  };
}
