import type { ComponentProps } from "react";
import type { RouteLineShape } from "../../domain/routeProfiles";
import { createArcGeometry } from "../../domain/routeArcGeometry";
import { snapRouteCoordinate } from "../../map/RouteSnapping";
import type { RouteDrawingPanel } from "../components/RouteDrawingPanel";
import {
  appendRoutePoint,
  MAX_ROAD_ROUTE_WAYPOINTS,
  routeFinishExplanation,
} from "../components/routeAuthoringActions";
import type { RouteCommitActions } from "./useCanvasRouteAuthoring";
import type { RouteCoreState } from "./useRouteCoreState";
import type { RouteAuthoringParameters } from "./canvasRouteAuthoringSupport";
import { canonicalDraftPoints } from "./routeSemanticDraft";

function pointsAfterAddition(
  core: RouteCoreState,
  base: [number, number][],
  points: [number, number][],
) {
  const added = points.at(-1);
  return added && core.extension?.endpoint === "start"
    ? [added, ...base]
    : points;
}

function closedArcAdditionError(
  core: RouteCoreState,
  points: [number, number][],
) {
  if (!core.isClosed || !core.extension || core.lineShape !== "arc") return null;
  return createArcGeometry(canonicalDraftPoints(points, true))
    ? null
    : "This point would create an impossible Arc return leg. Choose a different location.";
}

export function routeInputActions(
  parameters: RouteAuthoringParameters,
  core: RouteCoreState,
  exit: () => void,
) {
  const addPoint = (
    coordinate: readonly [number, number],
    label: string,
    shouldSnap = false,
  ) => {
    core.directions.cancel();
    parameters.setToolDocumentEpoch(parameters.documentEpoch);
    const snapped =
      shouldSnap && core.isSnapEnabled
        ? snapRouteCoordinate(
            coordinate,
            core.snapCandidates,
            parameters.camera.zoom,
          )
        : {
            coordinate: [coordinate[0], coordinate[1]] as [number, number],
            label: null,
          };
    const base =
      parameters.toolDocumentEpoch === parameters.documentEpoch
        ? core.points
        : [];
    const next = appendRoutePoint(base, snapped.coordinate, core.lineShape);
    core.setError(next.error);
    if (next.error) return;
    const editedPoints = pointsAfterAddition(core, base, next.points);
    const arcError = closedArcAdditionError(core, editedPoints);
    if (arcError) {
      core.setError(arcError);
      return;
    }
    core.editPoints(editedPoints);
    core.setAnnouncement(
      snapped.label
        ? `Snapped route point to ${snapped.label}.`
        : `Added route point from ${label}.`,
    );
  };

  const requestToolChange = (id: string) => {
    if (
      id !== "route" &&
      parameters.activeTool === "route" &&
      core.currentDraft.history.length > 0
    ) {
      core.setDiscardTrigger(
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
      );
      core.setToolAfterDiscard(id);
      core.setIsDiscardOpen(true);
      return false;
    }
    if (id === "route" && parameters.toolDocumentEpoch !== parameters.documentEpoch) {
      core.resetPoints([]);
      core.setAnnouncement(null);
      core.setError(null);
      core.setExtension(null);
    }
    if (id !== "route") core.directions.cancel();
    return true;
  };

  const changeLineShape = (shape: RouteLineShape) => {
    if (core.extension || shape === core.lineShape) return;
    core.directions.cancel();
    core.setRoadPreview(null);
    if (
      shape === "road" &&
      core.currentPoints.length > MAX_ROAD_ROUTE_WAYPOINTS
    ) {
      core.setError(
        "Road routes support up to 25 waypoints. Remove points before switching to Road.",
      );
      return;
    }
    core.setError(null);
    core.setLineShape(shape);
  };

  const discard = () => {
    const nextTool = core.toolAfterDiscard;
    core.setIsDiscardOpen(false);
    core.setToolAfterDiscard(null);
    exit();
    return nextTool;
  };
  const keepEditing = () => {
    core.setIsDiscardOpen(false);
    core.setToolAfterDiscard(null);
    window.setTimeout(() => core.discardTrigger?.focus(), 0);
  };
  return { addPoint, changeLineShape, discard, keepEditing, requestToolChange };
}

export function routePanelProps(
  parameters: RouteAuthoringParameters,
  core: RouteCoreState,
  actions: {
    input: ReturnType<typeof routeInputActions>;
    commit: RouteCommitActions;
    point: {
    focusPoint: (index: number) => void;
    removePoint: (index: number) => void;
    reorderPoint: (index: number, offset: -1 | 1) => void;
    };
  },
): ComponentProps<typeof RouteDrawingPanel> {
  const { commit, input, point } = actions;
  return {
    announcement: core.announcement,
    canFinish: core.canFinish,
    error: core.error ?? core.directions.error,
    finishExplanation:
      core.extension && core.currentPoints.length === 0
        ? "Add at least one new point to finish this extension."
        : routeFinishExplanation(
            core.commitPoints,
            core.options,
            core.directions.isRouting,
          ),
    initialCoordinate: parameters.camera.center,
    isRouting: core.directions.isRouting,
    lineShape: core.lineShape,
    onAddPoint: (coordinate, label) => input.addPoint(coordinate, label),
    onCancel: () => commit.requestCancel(),
    onFinish: commit.finish,
    onFocusPoint: point.focusPoint,
    onLineShapeChange: input.changeLineShape,
    onRoadTravelModeChange: (mode) => {
      core.directions.cancel();
      core.setRoadPreview(null);
      core.setRoadTravelMode(mode);
    },
    onPreviewRoad: commit.preview,
    onRemovePoint: point.removePoint,
    onSnapChange: (isEnabled) => {
      core.setIsSnapEnabled(isEnabled);
      core.setAnnouncement(
        `Route snapping ${isEnabled ? "enabled" : "disabled"}.`,
      );
    },
    onTravelMarkerChange: core.setTravelMarker,
    onMovePointDown: (index) => point.reorderPoint(index, 1),
    onMovePointUp: (index) => point.reorderPoint(index, -1),
    onUndo: () => {
      core.setError(null);
      commit.undo();
    },
    pathLocked: core.extension !== null,
    canUndo: core.currentDraft.history.length > 0,
    closed: core.isClosed,
    pointCount: core.currentPoints.length,
    points: core.currentPoints,
    pois: parameters.layers.filter(
      (layer) => layer.type === "poi" && layer.geometry?.type === "Point",
    ),
    roadTravelMode: core.roadTravelMode,
    snapEnabled: core.isSnapEnabled,
    title: core.extension
      ? `Extend ${core.extension.layer.name} from ${core.extension.endpoint}`
      : "Route",
    travelMarker: core.travelMarker,
    hasRoadPreview: core.roadPreview?.revision === core.currentDraft.revision
      && core.roadPreview.mode === core.roadTravelMode,
    showRoadPreview: core.extension === null,
    minimumPointCount: core.extension ? (core.isClosed ? 3 : 2) : 0,
  };
}
