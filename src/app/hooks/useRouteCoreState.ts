import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { createArcGeometry } from "../../domain/routeArcGeometry";
import { trackEditorAction } from "../../analytics/editorAnalytics";
import { semanticRoutePositions } from "../../domain/routeGeometry";
import {
  DEFAULT_ROUTE_AUTHORING_OPTIONS,
  type RoadTravelMode,
  type RouteAuthoringOptions,
  type RouteLineShape,
  type RouteTravelMarker,
} from "../../domain/routeProfiles";
import { routeSnapCandidates } from "../../map/RouteSnapping";
import { canFinishRoute } from "../components/routeAuthoringActions";
import { useLatestValue } from "./useLatestValue";
import {
  useRouteExtensionActivation,
  type RouteAuthoringParameters,
  type RouteExtensionRequest,
  type RouteStateSetters,
} from "./canvasRouteAuthoringSupport";
import { useDirectionsAuthoring } from "./useDirectionsAuthoring";
import { useRoutePointInput } from "./useRoutePointInput";
import { useRouteSemanticDraftState } from "./useRouteSemanticDraftState";
import {
  areDraftPointsEqual,
  canonicalDraftPoints,
  commitRouteSemanticPreview,
  createRouteSemanticDraft,
  draftValidationError,
  editRouteSemanticDraft,
  editableSemanticPoints,
  previewRouteSemanticDraft,
  replaceDraftPoint,
} from "./routeSemanticDraft";

function useRouteUIState() {
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [isSnapEnabled, setIsSnapEnabled] = useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [toolAfterDiscard, setToolAfterDiscard] = useState<string | null>(null);
  const [discardTrigger, setDiscardTrigger] = useState<HTMLElement | null>(null);
  const [extension, setExtension] = useState<RouteExtensionRequest | null>(null);
  const [lineShape, setLineShape] = useState<RouteLineShape>(
    DEFAULT_ROUTE_AUTHORING_OPTIONS.lineShape,
  );
  const [roadTravelMode, setRoadTravelMode] = useState<RoadTravelMode>(
    DEFAULT_ROUTE_AUTHORING_OPTIONS.roadTravelMode,
  );
  const [travelMarker, setTravelMarker] = useState<RouteTravelMarker | null>(
    DEFAULT_ROUTE_AUTHORING_OPTIONS.travelMarker,
  );
  return {
    announcement,
    discardTrigger,
    error,
    extension,
    isDiscardOpen,
    isSnapEnabled,
    lineShape,
    roadTravelMode,
    setAnnouncement,
    setDiscardTrigger,
    setError,
    setExtension,
    setIsDiscardOpen,
    setIsSnapEnabled,
    setLineShape,
    setRoadTravelMode,
    setToolAfterDiscard,
    setTravelMarker,
    toolAfterDiscard,
    travelMarker,
  };
}

function useDraftMovement(
  options: {
    currentPoints: [number, number][];
    directions: ReturnType<typeof useDirectionsAuthoring>;
    isClosed: boolean;
    lineShape: RouteLineShape;
    semantic: ReturnType<typeof useRouteSemanticDraftState>;
  },
) {
  const { currentPoints, directions, isClosed, lineShape, semantic } = options;
  const editPoints = useCallback((
    points: [number, number][],
    shouldSynchronizeTerra = true,
  ) => {
    directions.cancel();
    semantic.setRoadPreview(null);
    semantic.setDraft((current) => editRouteSemanticDraft(current, points));
    if (shouldSynchronizeTerra) semantic.requestTerraSync();
  }, [directions, semantic]);
  const beginPointMove = useCallback(() => {
    semantic.beginMove(currentPoints);
  }, [currentPoints, semantic]);
  const previewPointMove = useCallback((
    index: number,
    coordinate: readonly [number, number],
  ) => {
    const next = replaceDraftPoint(
      semantic.getCurrentDraft().points,
      index,
      coordinate,
    );
    const hasDuplicate = next.some((point, pointIndex) =>
      next.some((candidate, candidateIndex) =>
        pointIndex !== candidateIndex && areDraftPointsEqual([point], [candidate])
      )
    );
    if (
      hasDuplicate
      || (lineShape === "arc"
        && next.length >= 2
        && !createArcGeometry(canonicalDraftPoints(next, isClosed)))
    ) return false;
    directions.cancel();
    semantic.setRoadPreview(null);
    semantic.setDraft((current) => previewRouteSemanticDraft(current, next));
    semantic.requestTerraSync();
    return true;
  }, [directions, isClosed, lineShape, semantic]);
  const commitPointMove = useCallback(() => {
    const origin = semantic.takeMoveOrigin();
    if (!origin) return;
    if (!areDraftPointsEqual(origin, semantic.getCurrentDraft().points)) {
      trackEditorAction("routeDraftPointMoved");
    }
    directions.cancel();
    semantic.setRoadPreview(null);
    semantic.setDraft((current) =>
      commitRouteSemanticPreview(current, origin)
    );
  }, [directions, semantic]);
  return { beginPointMove, commitPointMove, editPoints, previewPointMove };
}

export function useRouteCoreState(parameters: RouteAuthoringParameters) {
  const ui = useRouteUIState();
  const semantic = useRouteSemanticDraftState(parameters.documentEpoch);
  const pointInput = useRoutePointInput(parameters.documentEpoch, parameters.camera.center);
  const { resetDraft } = semantic;
  const { setExtension, setIsDiscardOpen, setError, setAnnouncement } = ui;
  useLayoutEffect(() => {
    resetDraft([]);
    setExtension(null);
    setIsDiscardOpen(false);
    setError(null);
    setAnnouncement(null);
  }, [parameters.documentEpoch, resetDraft, setExtension, setIsDiscardOpen, setError, setAnnouncement]);
  const currentRoadTravelMode = useLatestValue(ui.roadTravelMode);
  const options = useMemo<RouteAuthoringOptions>(
    () => ({
      lineShape: ui.lineShape,
      roadTravelMode: ui.roadTravelMode,
      travelMarker: ui.travelMarker,
    }),
    [ui.lineShape, ui.roadTravelMode, ui.travelMarker],
  );
  const directions = useDirectionsAuthoring({
    active: parameters.activeTool === "route" && ui.lineShape === "road",
    documentEpoch: parameters.documentEpoch,
    onCreate: (input, routeOptions, expectedDocumentEpoch) => {
      if (!ui.extension) {
        return parameters.onCreateDirectionsRoute(
          input,
          routeOptions,
          expectedDocumentEpoch,
        );
      }
      return parameters.onReplaceRouteDraft({
        id: ui.extension.layer.id,
        points: editableSemanticPoints(
          input.waypoints,
          ui.extension.layer.route?.closed === true,
        ),
        road: input,
        travelMarker: routeOptions.travelMarker,
        expectedDocumentEpoch,
        expectedLayer: ui.extension.layer,
      });
    },
    provider: parameters.directionsProvider,
  });
  const resetPoints = useCallback((points: [number, number][]) => {
    semantic.resetDraft(points);
  }, [semantic]);
  const setters = useMemo<RouteStateSetters>(() => ({
    setAnnouncement: ui.setAnnouncement,
    setError: ui.setError,
    setExtension: ui.setExtension,
    setLineShape: ui.setLineShape,
    setPoints: resetPoints,
    setRoadTravelMode: ui.setRoadTravelMode,
    setTravelMarker: ui.setTravelMarker,
  }), [resetPoints, ui]);
  useRouteExtensionActivation(parameters, setters);
  const currentDraft = parameters.toolDocumentEpoch === parameters.documentEpoch
    ? semantic.draft
    : createRouteSemanticDraft();
  const currentPoints = currentDraft.points;
  const isClosed = ui.extension?.layer.route?.closed === true;
  const hasGeometryChanges = parameters.toolDocumentEpoch === parameters.documentEpoch && (
    ui.extension
      ? !areDraftPointsEqual(currentPoints, editableSemanticPoints(
          semanticRoutePositions(ui.extension.layer) ?? [], isClosed,
        ))
      : currentPoints.length > 0
  );
  const commitPoints = useMemo(
    () => canonicalDraftPoints(currentPoints, isClosed),
    [currentPoints, isClosed],
  );
  const canFinish = (!ui.extension || currentDraft.history.length > 0)
    && canFinishRoute(commitPoints, options)
    && draftValidationError(currentPoints, ui.lineShape, isClosed) === null;
  const snapCandidates = useMemo(
    () => routeSnapCandidates(parameters.layers),
    [parameters.layers],
  );
  const movement = useDraftMovement(
    { currentPoints, directions, isClosed, lineShape: ui.lineShape, semantic },
  );
  return {
    ...ui,
    ...semantic,
    ...movement,
    canFinish,
    commitPoints,
    currentDraft,
    currentPoints,
    directions,
    hasUnfinishedWork: hasGeometryChanges || pointInput.hasUnfinishedInput,
    pointInput,
    isClosed,
    options,
    points: currentPoints,
    resetPoints,
    currentRoadTravelMode,
    snapCandidates,
  };
}

export type RouteCoreState = ReturnType<typeof useRouteCoreState>;
