import { useCallback, useMemo, useState } from 'react';
import { MAX_MERCATOR_LATITUDE } from '../../domain/project';
import { isCoordinateInputInvalid } from '../components/coordinateInput';

type PointInputDraft = {
  documentEpoch: number;
  coordinates: [string, string];
  baseline: [string, string];
  poiId: string;
};

export function useRoutePointInput(documentEpoch: number, center: readonly [number, number]) {
  const [longitude, latitude] = center;
  const empty = useMemo<PointInputDraft>(() => ({
    documentEpoch,
    coordinates: [String(longitude), String(latitude)],
    baseline: [String(longitude), String(latitude)],
    poiId: '',
  }), [documentEpoch, longitude, latitude]);
  const [stored, setStored] = useState(empty);
  const draft = stored.documentEpoch === documentEpoch ? stored : empty;
  const update = useCallback((change: (current: PointInputDraft) => PointInputDraft) => {
    setStored((current) => current.documentEpoch > documentEpoch
      ? current : change(current.documentEpoch === documentEpoch ? current : empty));
  }, [documentEpoch, empty]);
  const onChange = useCallback((axis: 0 | 1, value: string) => {
    update((current) => {
      const coordinates: [string, string] = [...current.coordinates];
      coordinates[axis] = value;
      return { ...current, coordinates };
    });
  }, [update]);
  const onPoiChange = useCallback((poiId: string) => {
    update((current) => ({ ...current, poiId }));
  }, [update]);
  const acknowledgeCoordinates = useCallback(() => {
    update((current) => ({ ...current, baseline: current.coordinates }));
  }, [update]);
  const reset = useCallback(() => update(() => empty), [empty, update]);
  const errors: [string | null, string | null] = [
    isCoordinateInputInvalid(draft.coordinates[0], -180, 180)
      ? 'Longitude must be between -180 and 180.' : null,
    isCoordinateInputInvalid(draft.coordinates[1], -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE)
      ? `Latitude must be between -${MAX_MERCATOR_LATITUDE} and ${MAX_MERCATOR_LATITUDE}.` : null,
  ];
  return {
    coordinates: draft.coordinates,
    poiId: draft.poiId,
    errors,
    hasUnfinishedInput: draft.poiId !== ''
      || draft.coordinates.some((value, axis) => value !== draft.baseline[axis]),
    onChange, onPoiChange, acknowledgeCoordinates, reset,
  };
}

export type RoutePointInput = ReturnType<typeof useRoutePointInput>;
