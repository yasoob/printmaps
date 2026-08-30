import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  ContentLayer,
  DirectionsRouteInput,
  RouteKind,
} from "../../domain/project";
import { semanticRoutePoints } from "../../domain/routeModel";
import {
  ROAD_TRAVEL_MODES,
  type RoadTravelMode,
} from "../../domain/routeProfiles";
import type {
  DirectionsProvider,
  ProviderTravelProfile,
} from "../../services/mapbox/contracts";
import { createMapboxDirectionsProvider } from "../../services/mapbox/directions";
import { MapboxProviderError } from "../../services/mapbox/errors";
import type {
  ProjectState,
  RouteTransformOperation,
} from "../store";

const defaultProvider = createMapboxDirectionsProvider({
  token: import.meta.env.VITE_MAPBOX_PUBLIC_ACCESS,
});

const PROFILE_BY_MODE: Record<RoadTravelMode, ProviderTravelProfile> = {
  car: "driving",
  walk: "walking",
  bike: "cycling",
};
const MODE_BY_PROFILE: Record<ProviderTravelProfile, RoadTravelMode> = {
  driving: "car",
  walking: "walk",
  cycling: "bike",
};

type OperationState = {
  documentEpoch: number;
  layerId: string;
  operation: RouteTransformOperation;
  phase: "confirming" | "routing" | "error";
  scopeToken: object;
  error?: string;
};
type RouteTransformOptions = {
  documentEpoch: number;
  layer: ContentLayer;
  provider?: DirectionsProvider;
  transformRoute: ProjectState["transformRoute"];
};

function reversedCopy<T>(values: readonly T[]): T[] {
  return values.map((_, index) => values[values.length - index - 1]);
}

function transformedWaypoints(
  layer: ContentLayer,
  operation: RouteTransformOperation,
): [number, number][] {
  const points = (semanticRoutePoints(layer) ?? []).map(
    ([longitude, latitude]) => [longitude, latitude] as [number, number],
  );
  if (operation.type === "reverse") return reversedCopy(points);
  if (operation.type === "close" && points[0]) return [...points, [...points[0]]];
  if (operation.type === "open") return points.slice(0, -1);
  return points;
}

function requiresProvider(
  layer: ContentLayer,
  operation: RouteTransformOperation,
) {
  if (operation.type === "convert") return operation.targetKind === "road";
  return layer.route?.kind === "road";
}

function requestErrorMessage(error: unknown): string {
  return error instanceof MapboxProviderError || error instanceof Error
    ? error.message
    : "The road route could not be calculated. Check the route and try again.";
}

function operationError(
  options: RouteTransformOptions,
  operation: RouteTransformOperation,
  scopeToken: object,
  error: string,
): OperationState {
  return {
    documentEpoch: options.documentEpoch,
    layerId: options.layer.id,
    operation,
    phase: "error",
    scopeToken,
    error,
  };
}

function profileFor(
  layer: ContentLayer,
  operation: RouteTransformOperation,
  mode: RoadTravelMode,
): ProviderTravelProfile {
  if (operation.type === "convert") return PROFILE_BY_MODE[mode];
  if (layer.provenance?.service === "directions-v5") {
    return layer.provenance.profile;
  }
  return PROFILE_BY_MODE[mode];
}

async function roadInputFor({
  layer,
  operation,
  profile,
  provider,
  signal,
}: {
  layer: ContentLayer;
  operation: RouteTransformOperation;
  profile: ProviderTravelProfile;
  provider: DirectionsProvider;
  signal: AbortSignal;
}): Promise<DirectionsRouteInput> {
  const waypoints = transformedWaypoints(layer, operation);
  const response = await provider.directions({ profile, signal, waypoints });
  const selected = response.routes[0];
  if (!selected) {
    throw new Error("No road route matched these points. Adjust the route and try again.");
  }
  return {
    geometry: selected.geometry.map(([longitude, latitude]) => [longitude, latitude]),
    waypoints,
    profile,
    distanceMeters: selected.distanceMeters,
    durationSeconds: selected.durationSeconds,
  };
}

function useRouteOperationRequest(
  options: RouteTransformOptions,
  roadTravelMode: RoadTravelMode,
) {
  const provider = options.provider ?? defaultProvider;
  const [operationState, setOperationState] = useState<OperationState | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const scopeToken = useMemo(
    () => ({ documentEpoch: options.documentEpoch, layerId: options.layer.id }),
    [options.documentEpoch, options.layer.id],
  );
  const state = operationState?.layerId === options.layer.id
    && operationState.documentEpoch === options.documentEpoch
    && operationState.scopeToken === scopeToken
    ? operationState
    : null;
  const cancel = useCallback(() => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setOperationState(null);
  }, []);
  useLayoutEffect(() => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, [options.documentEpoch, options.layer.id]);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const execute = useCallback(async (operation: RouteTransformOperation) => {
    const commit = (road?: DirectionsRouteInput) => options.transformRoute({
      id: options.layer.id,
      operation,
      expectedDocumentEpoch: options.documentEpoch,
      expectedLayer: options.layer,
      ...(road && { road }),
    });
    if (!requiresProvider(options.layer, operation)) {
      const result = commit();
      setOperationState(result.ok
        ? null
        : operationError(options, operation, scopeToken, result.error));
      return result;
    }
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setOperationState({
      documentEpoch: options.documentEpoch,
      layerId: options.layer.id,
      operation,
      phase: "routing",
      scopeToken,
    });
    try {
      const road = await roadInputFor({
        provider,
        layer: options.layer,
        operation,
        profile: profileFor(options.layer, operation, roadTravelMode),
        signal: controller.signal,
      });
      if (controller.signal.aborted || requestId !== requestIdRef.current) return null;
      const result = commit(road);
      setOperationState(result.ok
        ? null
        : operationError(options, operation, scopeToken, result.error));
      return result;
    } catch (error) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return null;
      setOperationState(operationError(options, operation, scopeToken, requestErrorMessage(error)));
      return null;
    } finally {
      if (requestId === requestIdRef.current) controllerRef.current = null;
    }
  }, [options, provider, roadTravelMode, scopeToken]);
  const begin = useCallback((operation: RouteTransformOperation) => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (requiresProvider(options.layer, operation)) {
      setOperationState({
        documentEpoch: options.documentEpoch,
        layerId: options.layer.id,
        operation,
        phase: "confirming",
        scopeToken,
      });
    } else {
      void execute(operation);
    }
  }, [execute, options.documentEpoch, options.layer, scopeToken]);
  const confirm = useCallback(() => {
    if (state?.phase === "confirming") void execute(state.operation);
  }, [execute, state]);
  const retry = useCallback(() => {
    if (state?.phase === "error") void execute(state.operation);
  }, [execute, state]);
  return { begin, cancel, confirm, retry, state };
}

function useRouteSelections(layer: ContentLayer) {
  const initialTarget = layer.route?.kind === "straight" ? "arc" : "straight";
  const profile = layer.provenance?.service === "directions-v5"
    ? layer.provenance.profile
    : "driving";
  const [target, setTarget] = useState({ layerId: layer.id, value: initialTarget as RouteKind });
  const [mode, setMode] = useState({ layerId: layer.id, value: MODE_BY_PROFILE[profile] });
  const targetKind = target.layerId === layer.id ? target.value : initialTarget;
  const roadTravelMode = mode.layerId === layer.id ? mode.value : MODE_BY_PROFILE[profile];
  const setTargetKind = useCallback((value: RouteKind) => {
    setTarget({ layerId: layer.id, value });
  }, [layer.id]);
  const setRoadTravelMode = useCallback((value: RoadTravelMode) => {
    if (ROAD_TRAVEL_MODES.includes(value)) setMode({ layerId: layer.id, value });
  }, [layer.id]);
  return { roadTravelMode, setRoadTravelMode, setTargetKind, targetKind };
}

export function useRouteTransformOperations(options: RouteTransformOptions) {
  const selections = useRouteSelections(options.layer);
  const request = useRouteOperationRequest(options, selections.roadTravelMode);
  return {
    beginClose: () => request.begin({ type: "close" }),
    beginConvert: () => request.begin({
      type: "convert",
      targetKind: selections.targetKind,
    }),
    beginOpen: () => request.begin({ type: "open" }),
    beginReverse: () => request.begin({ type: "reverse" }),
    cancel: request.cancel,
    confirm: request.confirm,
    retry: request.retry,
    state: request.state,
    ...selections,
  };
}
