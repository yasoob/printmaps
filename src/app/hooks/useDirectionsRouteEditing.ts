import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createMapboxDirectionsProvider } from "../../services/mapbox/directions";
import {
  baseDirectionsEdit,
  changedWaypointEdit,
  directionsLayer,
  directionsReplacementRequest,
  directionsRouteErrorMessage,
  isCurrentDirectionsEdit,
  rebasePendingDirectionsEdit,
  requestDirectionsEdit,
  removedWaypointEdit,
  type DirectionsRouteEditingOptions,
  type PendingDirectionsEdit,
  type DirectionsEditOwner,
} from "./directionsRouteEditingSupport";
import { useLatestValue } from "./useLatestValue";
import { mutationRejected, type GeometryEditResult } from "../../domain/projectMutation";

const defaultProvider = createMapboxDirectionsProvider({
  token: import.meta.env.VITE_MAPBOX_PUBLIC_ACCESS,
});

function useDirectionsRouteRequest(options: DirectionsRouteEditingOptions) {
  const [pending, setPending] = useState<PendingDirectionsEdit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorOwner, setErrorOwner] = useState<DirectionsEditOwner | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<PendingDirectionsEdit | null>(null);
  const requestIdRef = useRef(0);
  const provider = options.provider ?? defaultProvider;
  const getCurrentScope = useLatestValue(options);
  const rebaseCurrent = useCallback((edit: PendingDirectionsEdit) => {
    const { layers, documentEpoch } = getCurrentScope();
    return rebasePendingDirectionsEdit(edit, layers.find(({ id }) => id === edit.expectedLayer.id), documentEpoch);
  }, [getCurrentScope]);

  const clearPending = useCallback(() => {
    pendingRef.current = null;
    setPending(null);
  }, []);

  const reportError = useCallback((owner: DirectionsEditOwner, message: string) => {
    if (pendingRef.current && pendingRef.current.expectedLayer.id !== owner.expectedLayer.id) return;
    setError(message);
    setErrorOwner(owner);
  }, []);

  const retireRequest = useCallback(() => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    pendingRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    retireRequest();
    setPending(null);
    setError(null);
    setErrorOwner(null);
    setIsRouting(false);
  }, [retireRequest]);

  useEffect(() => cancel, [cancel]);
  const owner = pending ?? errorOwner;
  const isOwnerCurrent = !owner || isCurrentDirectionsEdit(
    owner, options.layers.find(({ id }) => id === owner.expectedLayer.id), options.documentEpoch,
  );
  // Retire editor values before consumers render; dispose requests after commit.
  if (!isOwnerCurrent) {
    setPending(null);
    setError(null);
    setErrorOwner(null);
    setIsRouting(false);
  }
  useLayoutEffect(() => {
    const active = pendingRef.current;
    if (active && !rebaseCurrent(active).ok) retireRequest();
  }, [options.documentEpoch, options.layers, rebaseCurrent, retireRequest]);

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
    setErrorOwner(null);
    setIsRouting(true);
    try {
      const { route, profile } = await requestDirectionsEdit(provider, edit, controller.signal);
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      const current = rebaseCurrent(edit);
      if (!current.ok) return cancel();
      const result = replaceDirectionsRoute(
        directionsReplacementRequest(current.edit, route, profile),
      );
      if (requestId === requestIdRef.current) {
        if (!result.ok) {
          reportError(current.edit, result.error);
          return;
        }
        clearPending();
        setError(null);
        setErrorOwner(null);
      }
    } catch (routeError) {
      if (!controller.signal.aborted && requestId === requestIdRef.current) {
        const current = rebaseCurrent(edit);
        if (!current.ok) return cancel();
        reportError(current.edit, directionsRouteErrorMessage(routeError));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        controllerRef.current = null;
        setIsRouting(false);
      }
    }
  }, [cancel, clearPending, provider, rebaseCurrent, replaceDirectionsRoute, reportError]);

  const currentPending = useCallback(() => {
    const current = pendingRef.current;
    if (!current) return null;
    const rebased = rebaseCurrent(current);
    return rebased.ok ? rebased.edit : null;
  }, [rebaseCurrent]);
  return {
    cancel,
    currentPending,
    error: isOwnerCurrent ? error : null,
    errorLayerId: isOwnerCurrent ? errorOwner?.expectedLayer.id ?? null : null,
    isRouting: isOwnerCurrent && isRouting,
    pending: isOwnerCurrent ? pending : null,
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
    if (layer.locked || !layer.visible) {
      const error = "Unlock and show this route before editing its waypoints.";
      reportError({ expectedLayer: layer, expectedDocumentEpoch: documentEpoch }, error);
      return { ok: false as const, error };
    }
    const prepared = baseDirectionsEdit(
      layer,
      currentPending(),
      documentEpoch,
    );
    if (!prepared.ok) reportError({ expectedLayer: layer, expectedDocumentEpoch: documentEpoch }, prepared.error);
    return prepared;
  }, [currentPending, getCurrentEditScope, reportError]);

  const changeWaypoint = useCallback((id: string, waypointIndex: number, coordinate: readonly [number, number]): GeometryEditResult | null => {
    const prepared = preparedEdit(id);
    if (!prepared) return null;
    if (!prepared.ok) return mutationRejected(prepared.error);
    const changed = changedWaypointEdit(prepared.edit, waypointIndex, coordinate);
    if (changed.ok) {
      if (changed.edit === prepared.edit) return { ok: true, changed: false };
      void routePending(changed.edit);
      return { pending: true };
    }
    reportError(prepared.edit, changed.error);
    return mutationRejected(changed.error);
  }, [preparedEdit, reportError, routePending]);

  const removeWaypoint = useCallback((id: string, waypointIndex: number): GeometryEditResult | null => {
    const prepared = preparedEdit(id);
    if (!prepared) return null;
    if (!prepared.ok) return mutationRejected(prepared.error);
    const removed = removedWaypointEdit(prepared.edit, waypointIndex);
    if (removed.ok) {
      void routePending(removed.edit);
      return { pending: true };
    }
    reportError(prepared.edit, removed.error);
    return mutationRejected(removed.error);
  }, [preparedEdit, reportError, routePending]);

  const retry = useCallback(() => {
    const edit = currentPending();
    if (!edit) return;
    const prepared = preparedEdit(edit.expectedLayer.id);
    if (prepared?.ok) void routePending(prepared.edit);
  }, [currentPending, preparedEdit, routePending]);

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
