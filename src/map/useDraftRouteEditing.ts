import { useEffect, useLayoutEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  installDraftRouteEditing,
  type DraftRouteEditing,
  type DraftRouteEditingSession,
} from "./DraftRouteEditing";

export function useDraftRouteEditing(
  map: MapLibreMap | null,
  editing: DraftRouteEditing | undefined,
) {
  const session = useRef<DraftRouteEditingSession | null>(null);
  const callbacks = useRef(editing);
  useLayoutEffect(() => {
    callbacks.current = editing;
  }, [editing]);
  const isActive = editing?.active === true;
  const pointCount = editing?.points.length ?? 0;
  useEffect(() => {
    const current = callbacks.current;
    if (!map || !isActive || !current || pointCount === 0) return;
    const stableEditing: DraftRouteEditing = {
      ...current,
      onMoveBegin: () => callbacks.current?.onMoveBegin(),
      onMoveCommit: () => callbacks.current?.onMoveCommit(),
      onMovePreview: (index, coordinate) =>
        callbacks.current?.onMovePreview(index, coordinate) ?? false,
    };
    const owned = installDraftRouteEditing(map, stableEditing);
    session.current = owned;
    return () => {
      owned.destroy();
      if (session.current === owned) session.current = null;
    };
  }, [isActive, map, pointCount]);
  useLayoutEffect(() => {
    if (editing?.active) session.current?.update(editing.points);
  }, [editing?.active, editing?.points]);
  useEffect(() => {
    if (!editing?.active || editing.focusRequest.index < 0) return;
    session.current?.focusPoint(editing.focusRequest.index);
  }, [
    editing?.active,
    editing?.focusRequest.index,
    editing?.focusRequest.request,
  ]);
}
