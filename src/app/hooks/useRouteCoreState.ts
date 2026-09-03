import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createArcGeometry } from "../../domain/routeArcGeometry";
import type { DirectionsRouteInput } from "../../domain/project";
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
  type RouteSemanticDraft,
} from "./routeSemanticDraft";

type RoadPreview = {
  input: DirectionsRouteInput;
  mode: RoadTravelMode;
  revision: number;
};

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

function useSemanticDraftState() {
  const [draft, setDraft] = useState<RouteSemanticDraft>(() =>
    createRouteSemanticDraft()
  );
  const [roadPreview, setRoadPreview] = useState<RoadPreview | null>(null);
  const [focusRequest, setFocusRequest] = useState({ index: -1, request: 0 });
  const [terraSyncRevision, setTerraSyncRevision] = useState(0);
  const dragOriginRef = useRef<[number, number][] | null>(null);
  const draftRef = useRef(draft);
  useLayoutEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  const beginMove = useCallback((points: readonly [number, number][]) => {
    dragOriginRef.current = points.map((point) => [...point]);
  }, []);
  const resetDraft = useCallback((points: [number, number][]) => {
    setDraft(createRouteSemanticDraft(points));
    setRoadPreview(null);
    dragOriginRef.current = null;
  }, []);
  const takeMoveOrigin = useCallback(() => {
    const origin = dragOriginRef.current;
    dragOriginRef.current = null;
    return origin;
  }, []);
  const getCurrentDraft = useCallback(() => draftRef.current, []);
  const requestTerraSync = useCallback(() => {
    setTerraSyncRevision((revision) => revision + 1);
  }, []);
  return {
    beginMove,
    draft,
    focusRequest,
    getCurrentDraft,
    resetDraft,
    requestTerraSync,
    roadPreview,
    setDraft,
    setFocusRequest,
    setRoadPreview,
    takeMoveOrigin,
    terraSyncRevision,
  };
}

function useDraftMovement(
  options: {
    currentPoints: [number, number][];
    directions: ReturnType<typeof useDirectionsAuthoring>;
    isClosed: boolean;
    lineShape: RouteLineShape;
    semantic: ReturnType<typeof useSemanticDraftState>;
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
  const semantic = useSemanticDraftState();
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
  useRouteExtensionActivation(parameters, ui.extension, setters);
  const currentDraft = parameters.toolDocumentEpoch === parameters.documentEpoch
    ? semantic.draft
    : createRouteSemanticDraft();
  const currentPoints = currentDraft.points;
  const isClosed = ui.extension?.layer.route?.closed === true;
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
    isClosed,
    options,
    points: currentPoints,
    resetPoints,
    currentRoadTravelMode,
    snapCandidates,
  };
}

export type RouteCoreState = ReturnType<typeof useRouteCoreState>;
