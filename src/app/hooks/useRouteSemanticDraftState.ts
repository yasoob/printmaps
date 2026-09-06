import { useCallback, useLayoutEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import type { DirectionsRouteInput } from '../../domain/project';
import type { RoadTravelMode } from '../../domain/routeProfiles';
import { createRouteSemanticDraft, type RouteSemanticDraft } from './routeSemanticDraft';

type RoadPreview = {
  input: DirectionsRouteInput;
  mode: RoadTravelMode;
  revision: number;
};

export function useRouteSemanticDraftState(documentEpoch: number) {
  const empty = useMemo(() => ({ documentEpoch, draft: createRouteSemanticDraft() }), [documentEpoch]);
  const [stored, setStored] = useState(empty);
  const draft = stored.documentEpoch === documentEpoch ? stored.draft : empty.draft;
  const setDraft = useCallback((change: SetStateAction<RouteSemanticDraft>) => {
    setStored((current) => {
      if (current.documentEpoch > documentEpoch) return current;
      const previous = current.documentEpoch === documentEpoch ? current.draft : empty.draft;
      const next = typeof change === 'function' ? change(previous) : change;
      return previous === next && current.documentEpoch === documentEpoch
        ? current : { documentEpoch, draft: next };
    });
  }, [documentEpoch, empty]);
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
  }, [setDraft]);
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
    beginMove, draft, focusRequest, getCurrentDraft, resetDraft, requestTerraSync,
    roadPreview, setDraft, setFocusRequest, setRoadPreview, takeMoveOrigin, terraSyncRevision,
  };
}
