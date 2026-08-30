import type { ComponentProps } from "react";
import type { RouteLineShape } from "../../domain/routeProfiles";
import { snapRouteCoordinate } from "../../map/RouteSnapping";
import type { RouteDrawingPanel } from "../components/RouteDrawingPanel";
import {
  appendRoutePoint,
  appendRouteExtensionPoint,
  MAX_ROAD_ROUTE_WAYPOINTS,
  routeFinishExplanation,
} from "../components/routeAuthoringActions";
import type {
  RouteCommitActions,
  RouteCoreState,
} from "./useCanvasRouteAuthoring";
import type { RouteAuthoringParameters } from "./canvasRouteAuthoringSupport";

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
    const next = core.extension
      ? appendRouteExtensionPoint({
          additions: base,
          coordinate: snapped.coordinate,
          endpoint: core.extension.endpoint,
          layer: core.extension.layer,
          lineShape: core.lineShape,
        })
      : appendRoutePoint(base, snapped.coordinate, core.lineShape);
    core.setError(next.error);
    if (next.error) return;
    core.setPoints(next.points);
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
      core.currentPoints.length > 0
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
      core.setPoints([]);
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
  actions: ReturnType<typeof routeInputActions>,
  commitActions: RouteCommitActions,
): ComponentProps<typeof RouteDrawingPanel> {
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
    onAddPoint: (coordinate, label) => actions.addPoint(coordinate, label),
    onCancel: () => commitActions.requestCancel(),
    onFinish: commitActions.finish,
    onLineShapeChange: actions.changeLineShape,
    onRoadTravelModeChange: (mode) => {
      core.directions.cancel();
      core.setRoadTravelMode(mode);
    },
    onSnapChange: (isEnabled) => {
      core.setIsSnapEnabled(isEnabled);
      core.setAnnouncement(
        `Route snapping ${isEnabled ? "enabled" : "disabled"}.`,
      );
    },
    onTravelMarkerChange: core.setTravelMarker,
    onUndo: () => {
      core.setError(null);
      commitActions.undo();
    },
    pathLocked: core.extension !== null,
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
  };
}
