import { useCallback, useMemo, useState } from 'react';
import { MAX_MERCATOR_LATITUDE, normalizeCameraPrecision } from '../../domain/project';
import { isValidPosition } from '../../domain/routeGeometry';
import type { ShapeAuthoringMode } from '../components/ShapeDrawingPanel';
import { isCoordinateInputInvalid } from '../components/coordinateInput';

type ShapeDrawingDraft = {
  documentEpoch: number;
  mode: ShapeAuthoringMode;
  points: [number, number][];
  coordinates: [string, string];
  coordinateBaseline: [string, string];
  error: string | null;
  lastPointSource: 'map' | 'coordinates' | null;
};

function emptyDrawingDraft(documentEpoch: number, center: readonly [number, number]): ShapeDrawingDraft {
  return {
    documentEpoch, mode: 'administrative', points: [],
    coordinates: [String(center[0]), String(center[1])],
    coordinateBaseline: [String(center[0]), String(center[1])],
    error: null, lastPointSource: null,
  };
}

function coordinateErrors(coordinates: readonly [string, string]): [string | null, string | null] {
  return [
    isCoordinateInputInvalid(coordinates[0], -180, 180)
      ? 'Longitude must be between -180 and 180.' : null,
    isCoordinateInputInvalid(coordinates[1], -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE)
      ? `Latitude must be between -${MAX_MERCATOR_LATITUDE} and ${MAX_MERCATOR_LATITUDE}.` : null,
  ];
}

function appendPoint(
  current: ShapeDrawingDraft,
  coordinate: readonly [number, number],
  source: NonNullable<ShapeDrawingDraft['lastPointSource']>,
): ShapeDrawingDraft {
  if (!isValidPosition(coordinate[0], coordinate[1])) {
    return { ...current, error: 'Enter valid area coordinates within the map bounds.' };
  }
  const point: [number, number] = [
    normalizeCameraPrecision(coordinate[0]), normalizeCameraPrecision(coordinate[1]),
  ];
  if (current.points.some(([longitude, latitude]) => longitude === point[0] && latitude === point[1])) {
    return { ...current, error: 'That area point is already present. Choose a different location.' };
  }
  return { ...current, points: [...current.points, point], error: null, lastPointSource: source };
}

export function useShapeDrawingDraft(documentEpoch: number, center: readonly [number, number]) {
  const [longitude, latitude] = center;
  const emptyDraft = useMemo(() => emptyDrawingDraft(documentEpoch, [longitude, latitude]), [documentEpoch, longitude, latitude]);
  const [storedDraft, setStoredDraft] = useState(emptyDraft);
  const draft = storedDraft.documentEpoch === documentEpoch ? storedDraft : emptyDraft;
  const update = useCallback((updateDraft: (current: ShapeDrawingDraft) => ShapeDrawingDraft) => {
    setStoredDraft((current) => current.documentEpoch > documentEpoch ? current : updateDraft(
      current.documentEpoch === documentEpoch ? current : emptyDraft,
    ));
  }, [documentEpoch, emptyDraft]);
  const addPoint = useCallback((coordinate: readonly [number, number]) => {
    update((current) => appendPoint(current, coordinate, 'map'));
  }, [update]);
  const setCoordinate = useCallback((axis: 0 | 1, value: string) => {
    update((current) => {
      const coordinates: [string, string] = [...current.coordinates];
      coordinates[axis] = value;
      return { ...current, coordinates, error: null };
    });
  }, [update]);
  const addEnteredPoint = useCallback(() => {
    update((current) => {
      const error = coordinateErrors(current.coordinates).find(Boolean);
      if (error) return { ...current, error };
      return appendPoint(current, [Number(current.coordinates[0]), Number(current.coordinates[1])], 'coordinates');
    });
  }, [update]);
  const setMode = useCallback((mode: ShapeAuthoringMode) => {
    update((current) => current.mode === mode ? current : { ...current, mode });
  }, [update]);
  const clear = useCallback(() => {
    update((current) => ({ ...emptyDraft, mode: current.mode }));
  }, [emptyDraft, update]);
  const undo = useCallback(() => {
    update((current) => {
      const removed = current.points.at(-1);
      return removed ? {
        ...current,
        points: current.points.slice(0, -1),
        coordinates: [String(removed[0]), String(removed[1])],
        coordinateBaseline: [String(removed[0]), String(removed[1])],
        error: null,
      } : current;
    });
  }, [update]);

  return {
    addPoint, clear, mode: draft.mode, points: draft.points, setMode, undo,
    error: draft.error,
    hasUnfinishedWork: draft.points.length > 0
      || draft.coordinates.some((value, axis) => value !== draft.coordinateBaseline[axis]),
    lastPointSource: draft.lastPointSource,
    pointInput: {
      coordinates: draft.coordinates,
      errors: coordinateErrors(draft.coordinates),
      onChange: setCoordinate,
      onAdd: addEnteredPoint,
    },
  };
}
