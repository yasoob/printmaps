import { useCallback, useEffect, useRef, useState } from "react";
import { createMapboxDirectionsProvider } from "../../services/mapbox/directions";
import {
  baseDirectionsEdit,
  changedWaypointEdit,
  directionsLayer,
  directionsReplacementRequest,
  directionsRouteErrorMessage,
  rebasePendingDirectionsEdit,
  removedWaypointEdit,
  type DirectionsRouteEditingOptions,
  type PendingDirectionsEdit,
} from "./directionsRouteEditingSupport";
import { useLatestValue } from "./useLatestValue";

const defaultProvider = createMapboxDirectionsProvider({
  token: import.meta.env.VITE_MAPBOX_PUBLIC_ACCESS,
});

function useDirectionsRouteRequest(options: DirectionsRouteEditingOptions) {
  const [pending, setPending] = useState<PendingDirectionsEdit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorLayerId, setErrorLayerId] = useState<string | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<PendingDirectionsEdit | null>(null);
  const requestIdRef = useRef(0);
  const provider = options.provider ?? defaultProvider;

  const clearPending = useCallback(() => {
    pendingRef.current = null;
    setPending(null);
  }, []);

  const reportError = useCallback((layerId: string, message: string) => {
    setError(message);
    setErrorLayerId(layerId);
  }, []);

  const cancel = useCallback(() => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    pendingRef.current = null;
    setPending(null);
    setError(null);
    setErrorLayerId(null);
    setIsRouting(false);
  }, []);

  useEffect(() => cancel, [cancel]);

  const replaceDirectionsRoute = options.replaceDirectionsRoute;
  const routePending = useCallback(async (edit: PendingDirectionsEdit) => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      pendingRef.current = edit;
      setPending(edit);
      setError(null);
      setErrorLayerId(null);
      setIsRouting(true);
      const provenance = edit.expectedLayer.provenance;
      if (provenance?.service !== "directions-v5") {
        reportError(
          edit.expectedLayer.id,
          "This route no longer has Road waypoint data. Cancel this edit and try again.",
        );
        setIsRouting(false);
        return;
      }
      try {
        const response = await provider.directions({
          profile: provenance.profile,
          signal: controller.signal,
          waypoints: edit.waypoints,
        });
        if (controller.signal.aborted || requestId !== requestIdRef.current)
          return;
        const route = response.routes[0];
        if (!route)
          throw new Error(
            "No road route matched these waypoints. Adjust the waypoint and retry.",
          );
        const result = replaceDirectionsRoute(
          directionsReplacementRequest(edit, route, provenance.profile),
        );
        if (!result.ok) {
          reportError(edit.expectedLayer.id, result.error);
          return;
        }
        clearPending();
        setError(null);
        setErrorLayerId(null);
      } catch (routeError) {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          reportError(edit.expectedLayer.id, directionsRouteErrorMessage(routeError));
        }
      } finally {
        if (requestId === requestIdRef.current) {
          controllerRef.current = null;
          setIsRouting(false);
        }
      }
  }, [clearPending, provider, replaceDirectionsRoute, reportError]);

  const currentPending = useCallback(() => pendingRef.current, []);
  return {
    cancel,
    currentPending,
    error,
    errorLayerId,
    isRouting,
    pending,
    reportError,
    routePending,
  };
}

export function useDirectionsRouteEditing(options: DirectionsRouteEditingOptions) {
  const request = useDirectionsRouteRequest(options);
  const getCurrentEditScope = useLatestValue({
    documentEpoch: options.documentEpoch,
    layers: options.layers,
  });
  const {
    cancel,
    currentPending,
    error,
    errorLayerId,
    isRouting,
    pending,
    reportError,
    routePending,
  } = request;

  const preparedEdit = useCallback((id: string) => {
    const { documentEpoch, layers } = getCurrentEditScope();
    const layer = directionsLayer(layers, id);
    if (!layer) return null;
    const prepared = baseDirectionsEdit(
      layer,
      currentPending(),
      documentEpoch,
    );
    if (!prepared.ok) reportError(id, prepared.error);
    return prepared;
  }, [currentPending, getCurrentEditScope, reportError]);

  const changeWaypoint = useCallback((id: string, waypointIndex: number, coordinate: readonly [number, number]) => {
    const prepared = preparedEdit(id);
    if (!prepared) return false;
    if (!prepared.ok) return true;
    const changed = changedWaypointEdit(prepared.edit, waypointIndex, coordinate);
    if (changed.ok) void routePending(changed.edit);
    else reportError(id, changed.error);
    return true;
  }, [preparedEdit, reportError, routePending]);

  const removeWaypoint = useCallback((id: string, waypointIndex: number) => {
    const prepared = preparedEdit(id);
    if (!prepared) return false;
    if (!prepared.ok) return true;
    const removed = removedWaypointEdit(prepared.edit, waypointIndex);
    if (removed.ok) void routePending(removed.edit);
    else reportError(id, removed.error);
    return true;
  }, [preparedEdit, reportError, routePending]);

  const retry = useCallback(() => {
    const edit = currentPending();
    if (!edit) return;
    const { documentEpoch, layers } = getCurrentEditScope();
    const layer = layers.find(({ id }) => id === edit.expectedLayer.id);
    if (!layer) {
      reportError(
        edit.expectedLayer.id,
        "This Road route no longer exists. Cancel the pending edit.",
      );
      return;
    }
    const rebased = rebasePendingDirectionsEdit(edit, layer, documentEpoch);
    if (rebased.ok) void routePending(rebased.edit);
    else reportError(edit.expectedLayer.id, rebased.error);
  }, [currentPending, getCurrentEditScope, reportError, routePending]);

  return {
    cancel,
    changeWaypoint,
    error,
    isRouting,
    pendingWaypoints: pending?.waypoints ?? null,
    pendingLayerId: pending?.expectedLayer.id ?? null,
    removeWaypoint,
    statusLayerId:
      pending?.expectedLayer.id ?? errorLayerId,
    retry,
  };
}
