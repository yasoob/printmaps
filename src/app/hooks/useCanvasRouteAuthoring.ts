import { useCallback } from "react";
import {
  useRouteKeyboard,
  type RouteAuthoringParameters,
} from "./canvasRouteAuthoringSupport";
import { routeInputActions, routePanelProps } from "./canvasRouteInputActions";
import {
  areDraftPointsEqual,
  draftValidationError,
  moveDraftPoint,
  removeDraftPoint,
  undoRouteSemanticDraft,
} from "./routeSemanticDraft";
import {
  useRouteCoreState,
  type RouteCoreState,
} from "./useRouteCoreState";

export type { RouteExtensionRequest } from "./canvasRouteAuthoringSupport";

function useRouteCommitActions(
  parameters: RouteAuthoringParameters,
  core: RouteCoreState,
) {
  const exit = useCallback(() => {
    const extensionTrigger = core.extension?.trigger;
    core.directions.cancel();
    core.resetPoints([]);
    core.setError(null);
    core.setAnnouncement(null);
    core.setExtension(null);
    parameters.setActiveTool("select");
    parameters.onAuthoringChange(parameters.documentEpoch, false);
    window.setTimeout(() => {
      if (
        extensionTrigger?.isConnected
        && extensionTrigger.offsetParent !== null
      ) extensionTrigger.focus();
      else parameters.selectToolRef.current?.focus();
    }, 0);
  }, [core, parameters]);

  const undo = useCallback(() => {
    core.directions.cancel();
    core.setRoadPreview(null);
    const hasHistory = core.currentDraft.history.length > 0;
    core.setDraft(undoRouteSemanticDraft(core.currentDraft));
    core.requestTerraSync();
    if (hasHistory) {
      core.setAnnouncement("Undid the latest draft edit.");
    }
  }, [core]);

  const commitRoad = useCallback(async () => {
    const cached = core.roadPreview;
    const revision = core.currentDraft.revision;
    const mode = core.roadTravelMode;
    const input = cached?.revision === revision
      && cached.mode === mode
      ? cached.input
      : await core.directions.resolve(core.commitPoints, core.options);
    if (
      !input
      || core.getCurrentDraft().revision !== revision
      || core.currentRoadTravelMode() !== mode
    ) return;
    const result = core.directions.commit(input, core.options);
    if (result.ok) exit();
    else core.setError(result.error);
  }, [core, exit]);

  const finish = useCallback(() => {
    if (!core.canFinish) return;
    if (core.lineShape === "road") {
      void commitRoad();
      return;
    }
    const result = core.extension
      ? parameters.onReplaceRouteDraft({
          id: core.extension.layer.id,
          points: core.currentPoints,
          travelMarker: core.options.travelMarker,
          expectedDocumentEpoch: parameters.documentEpoch,
          expectedLayer: core.extension.layer,
        })
      : parameters.onCreateRoute(core.currentPoints, core.options);
    if (result.ok) exit();
    else core.setError(result.error);
  }, [commitRoad, core, exit, parameters]);

  const preview = useCallback(async () => {
    if (
      core.lineShape !== "road"
      || draftValidationError(
        core.currentPoints,
        "road",
        core.isClosed,
      )
    ) return;
    const revision = core.currentDraft.revision;
    const mode = core.roadTravelMode;
    const input = await core.directions.resolve(core.commitPoints, core.options);
    if (
      !input
      || core.getCurrentDraft().revision !== revision
      || core.currentRoadTravelMode() !== mode
    ) return;
    core.setRoadPreview({ input, mode, revision });
    core.setAnnouncement("Road preview updated.");
  }, [core]);

  const requestCancel = useCallback(
    (trigger: HTMLElement | null = null) => {
      if (core.currentDraft.history.length === 0) {
        exit();
        return;
      }
      core.setDiscardTrigger(
        trigger
        ?? (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null),
      );
      core.setToolAfterDiscard(null);
      core.setIsDiscardOpen(true);
    },
    [core, exit],
  );
  return { exit, finish, preview, requestCancel, undo };
}

export type RouteCommitActions = ReturnType<typeof useRouteCommitActions>;

export function useCanvasRouteAuthoring(parameters: RouteAuthoringParameters) {
  const core = useRouteCoreState(parameters);
  const commitActions = useRouteCommitActions(parameters, core);
  const inputActions = routeInputActions(parameters, core, commitActions.exit);
  useRouteKeyboard({
    active: parameters.activeTool === "route",
    canFinish: core.canFinish,
    canUndo: core.currentDraft.history.length > 0,
    isDiscardOpen: core.isDiscardOpen,
    isRouting: core.directions.isRouting,
    onCancel: commitActions.requestCancel,
    onFinish: commitActions.finish,
    onUndo: commitActions.undo,
  });
  const removePoint = useCallback((index: number) => {
    const minimum = core.extension ? (core.isClosed ? 3 : 2) : 0;
    if (core.currentPoints.length <= minimum) return;
    core.editPoints(removeDraftPoint(core.currentPoints, index));
    core.setAnnouncement(`Removed draft point ${index + 1}.`);
  }, [core]);
  const reorderPoint = useCallback((index: number, offset: -1 | 1) => {
    const nextIndex = index + offset;
    const next = moveDraftPoint(core.currentPoints, index, nextIndex);
    if (areDraftPointsEqual(next, core.currentPoints)) return;
    core.editPoints(next);
    core.setAnnouncement(
      `Moved draft point ${index + 1} ${offset < 0 ? "up" : "down"}.`,
    );
  }, [core]);
  const focusPoint = useCallback((index: number) => {
    core.setFocusRequest((current) => ({
      index,
      request: current.request + 1,
    }));
  }, [core]);
  return {
    addPoint: inputActions.addPoint,
    discard: inputActions.discard,
    draftEditing: {
      active: parameters.activeTool === "route" && core.currentPoints.length > 0,
      focusRequest: core.focusRequest,
      onMoveBegin: core.beginPointMove,
      onMoveCommit: core.commitPointMove,
      onMovePreview: core.previewPointMove,
      points: core.currentPoints,
    },
    draftPoints: core.commitPoints,
    extensionLayerId: core.extension?.layer.id ?? null,
    isClosed: core.isClosed,
    isDiscardOpen: core.isDiscardOpen,
    keepEditing: inputActions.keepEditing,
    options: core.options,
    panelProps: routePanelProps(
      parameters,
      core,
      {
        commit: commitActions,
        input: inputActions,
        point: { focusPoint, removePoint, reorderPoint },
      },
    ),
    points: core.currentPoints,
    preview: core.roadPreview?.input ?? null,
    requestToolChange: inputActions.requestToolChange,
    terraAuthoring: {
      active: parameters.activeTool === "route" && !core.extension,
      lineShape: core.lineShape === "road" ? "straight" as const : core.lineShape,
      onFinish: (points: [number, number][]) => core.editPoints(points, false),
      onPreview: (points: [number, number][]) => core.editPoints(points, false),
      points: core.currentPoints,
      revision: core.terraSyncRevision,
      undoRequest: 0,
    },
  };
}
