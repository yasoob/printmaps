import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_ROUTE_AUTHORING_OPTIONS,
  type RoadTravelMode,
  type RouteAuthoringOptions,
  type RouteLineShape,
  type RouteTravelMarker,
} from "../../domain/routeProfiles";
import { routeSnapCandidates } from "../../map/RouteSnapping";
import {
  canFinishRoute,
  extendedLocalRouteGeometry,
  extendedRoutePoints,
} from "../components/routeAuthoringActions";
import { useDirectionsAuthoring } from "./useDirectionsAuthoring";
import {
  extensionDraftPoints,
  useRouteExtensionActivation,
  useRouteKeyboard,
  type RouteAuthoringParameters,
  type RouteExtensionRequest,
  type RouteStateSetters,
} from "./canvasRouteAuthoringSupport";
import { routeInputActions, routePanelProps } from "./canvasRouteInputActions";

export type { RouteExtensionRequest } from "./canvasRouteAuthoringSupport";

function useRouteCoreState(parameters: RouteAuthoringParameters) {
  const [points, setPoints] = useState<[number, number][]>([]);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [isSnapEnabled, setIsSnapEnabled] = useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [toolAfterDiscard, setToolAfterDiscard] = useState<string | null>(null);
  const [discardTrigger, setDiscardTrigger] = useState<HTMLElement | null>(
    null,
  );
  const [extension, setExtension] = useState<RouteExtensionRequest | null>(
    null,
  );
  const [lineShape, setLineShape] = useState<RouteLineShape>(
    DEFAULT_ROUTE_AUTHORING_OPTIONS.lineShape,
  );
  const [roadTravelMode, setRoadTravelMode] = useState<RoadTravelMode>(
    DEFAULT_ROUTE_AUTHORING_OPTIONS.roadTravelMode,
  );
  const [travelMarker, setTravelMarker] = useState<RouteTravelMarker | null>(
    DEFAULT_ROUTE_AUTHORING_OPTIONS.travelMarker,
  );
  const options = useMemo<RouteAuthoringOptions>(
    () => ({ lineShape, roadTravelMode, travelMarker }),
    [lineShape, roadTravelMode, travelMarker],
  );
  const directions = useDirectionsAuthoring({
    active: parameters.activeTool === "route" && lineShape === "road",
    documentEpoch: parameters.documentEpoch,
    onCreate: (input, routeOptions, expectedDocumentEpoch) =>
      extension
        ? parameters.onReplaceDirectionsRoute({
            id: extension.layer.id,
            input,
            options: routeOptions,
            expectedDocumentEpoch,
            expectedLayer: extension.layer,
            selectRoute: true,
          })
        : parameters.onCreateDirectionsRoute(
            input,
            routeOptions,
            expectedDocumentEpoch,
          ),
    provider: parameters.directionsProvider,
  });
  const setters = useMemo<RouteStateSetters>(
    () => ({
      setAnnouncement,
      setError,
      setExtension,
      setLineShape,
      setPoints,
      setRoadTravelMode,
      setTravelMarker,
    }),
    [],
  );
  useRouteExtensionActivation(parameters, extension, setters);
  const currentPoints = useMemo(
    () =>
      parameters.toolDocumentEpoch === parameters.documentEpoch ? points : [],
    [parameters.documentEpoch, parameters.toolDocumentEpoch, points],
  );
  const commitPoints = useMemo(
    () =>
      extension
        ? (extendedRoutePoints(
            extension.layer,
            currentPoints,
            extension.endpoint,
          ) ?? [])
        : currentPoints,
    [currentPoints, extension],
  );
  const canFinish =
    (!extension || currentPoints.length > 0) &&
    canFinishRoute(commitPoints, options);
  const snapCandidates = useMemo(
    () => routeSnapCandidates(parameters.layers),
    [parameters.layers],
  );
  return {
    announcement,
    canFinish,
    commitPoints,
    currentPoints,
    directions,
    discardTrigger,
    error,
    extension,
    isDiscardOpen,
    isSnapEnabled,
    lineShape,
    options,
    points,
    roadTravelMode,
    snapCandidates,
    setAnnouncement,
    setError,
    setExtension,
    setIsDiscardOpen,
    setIsSnapEnabled,
    setLineShape,
    setPoints,
    setRoadTravelMode,
    setDiscardTrigger,
    setToolAfterDiscard,
    setTravelMarker,
    toolAfterDiscard,
    travelMarker,
  };
}

export type RouteCoreState = ReturnType<typeof useRouteCoreState>;

function localRouteResult(
  parameters: RouteAuthoringParameters,
  core: RouteCoreState,
) {
  if (!core.extension)
    return parameters.onCreateRoute(core.currentPoints, core.options);
  const geometry = extendedLocalRouteGeometry(
    core.extension.layer,
    core.currentPoints,
    core.extension.endpoint,
  );
  if (!geometry) {
    return {
      ok: false,
      error:
        "This route extension has invalid geometry. Move the new endpoint and try again.",
    } as const;
  }
  return parameters.onReplaceAuthoredRoute(
    core.extension.layer.id,
    geometry,
    core.options.travelMarker,
    core.extension.layer,
  );
}

function useRouteCommitActions(
  parameters: RouteAuthoringParameters,
  core: RouteCoreState,
) {
  const exit = useCallback(() => {
    const extensionTrigger = core.extension?.trigger;
    core.directions.cancel();
    core.setPoints([]);
    core.setError(null);
    core.setAnnouncement(null);
    core.setExtension(null);
    parameters.setActiveTool("select");
    parameters.onAuthoringChange(parameters.documentEpoch, false);
    window.setTimeout(() => {
      if (
        extensionTrigger?.isConnected &&
        extensionTrigger.offsetParent !== null
      )
        extensionTrigger.focus();
      else parameters.selectToolRef.current?.focus();
    }, 0);
  }, [core, parameters]);

  const undo = useCallback(() => {
    core.setPoints(core.currentPoints.slice(0, -1));
    core.setAnnouncement("Removed the latest route point.");
  }, [core]);

  const finish = useCallback(() => {
    if (!core.canFinish) return;
    if (core.lineShape === "road") {
      void core.directions
        .route(core.commitPoints, core.options)
        .then((result) => {
          if (result?.ok) exit();
          else if (result) core.setError(result.error);
        });
      return;
    }
    const result = localRouteResult(parameters, core);
    if (result.ok) exit();
    else core.setError(result.error);
  }, [core, exit, parameters]);

  const requestCancel = useCallback(
    (trigger: HTMLElement | null = null) => {
      if (core.currentPoints.length === 0) {
        exit();
        return;
      }
      core.setDiscardTrigger(
        trigger ??
          (document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null),
      );
      core.setToolAfterDiscard(null);
      core.setIsDiscardOpen(true);
    },
    [core, exit],
  );
  return { exit, finish, requestCancel, undo };
}

export type RouteCommitActions = ReturnType<typeof useRouteCommitActions>;

export function useCanvasRouteAuthoring(parameters: RouteAuthoringParameters) {
  const core = useRouteCoreState(parameters);
  const commitActions = useRouteCommitActions(parameters, core);
  const inputActions = routeInputActions(parameters, core, commitActions.exit);
  useRouteKeyboard({
    active: parameters.activeTool === "route",
    canFinish: core.canFinish,
    canUndo: core.currentPoints.length > 0,
    isDiscardOpen: core.isDiscardOpen,
    isRouting: core.directions.isRouting,
    onCancel: commitActions.requestCancel,
    onFinish: commitActions.finish,
    onUndo: commitActions.undo,
  });

  return {
    addPoint: inputActions.addPoint,
    discard: inputActions.discard,
    draftPoints: extensionDraftPoints(core.extension, core.currentPoints),
    isDiscardOpen: core.isDiscardOpen,
    keepEditing: inputActions.keepEditing,
    options: core.options,
    panelProps: routePanelProps(parameters, core, inputActions, commitActions),
    points: core.currentPoints,
    requestToolChange: inputActions.requestToolChange,
  };
}
