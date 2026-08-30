import { normalizeCameraPrecision, type RouteKind } from "../../domain/project";
import { arePositionsEqual, routePointValidationError } from "../../domain/routeModel";

export type DraftPosition = [number, number];

export type RouteSemanticDraft = {
  history: DraftPosition[][];
  points: DraftPosition[];
  revision: number;
};

function copyPoints(
  points: readonly (readonly [number, number])[],
): DraftPosition[] {
  return points.map(([longitude, latitude]) => [longitude, latitude]);
}

export function editableSemanticPoints(
  points: readonly (readonly [number, number])[],
  isClosed: boolean,
): DraftPosition[] {
  return copyPoints(isClosed ? points.slice(0, -1) : points);
}

export function createRouteSemanticDraft(
  points: readonly (readonly [number, number])[] = [],
): RouteSemanticDraft {
  return { history: [], points: copyPoints(points), revision: 0 };
}

export function areDraftPointsEqual(
  left: readonly (readonly [number, number])[],
  right: readonly (readonly [number, number])[],
) {
  return left.length === right.length
    && left.every((point, index) => arePositionsEqual(point, right[index]));
}

export function editRouteSemanticDraft(
  draft: RouteSemanticDraft,
  points: readonly (readonly [number, number])[],
): RouteSemanticDraft {
  const next = copyPoints(points);
  if (areDraftPointsEqual(draft.points, next)) return draft;
  return {
    history: [...draft.history, copyPoints(draft.points)],
    points: next,
    revision: draft.revision + 1,
  };
}

export function previewRouteSemanticDraft(
  draft: RouteSemanticDraft,
  points: readonly (readonly [number, number])[],
): RouteSemanticDraft {
  const next = copyPoints(points);
  return areDraftPointsEqual(draft.points, next)
    ? draft
    : { ...draft, points: next };
}

export function commitRouteSemanticPreview(
  draft: RouteSemanticDraft,
  original: readonly (readonly [number, number])[],
): RouteSemanticDraft {
  if (areDraftPointsEqual(original, draft.points)) return draft;
  return {
    history: [...draft.history, copyPoints(original)],
    points: copyPoints(draft.points),
    revision: draft.revision + 1,
  };
}

export function undoRouteSemanticDraft(
  draft: RouteSemanticDraft,
): RouteSemanticDraft {
  const previous = draft.history.at(-1);
  if (!previous) return draft;
  return {
    history: draft.history.slice(0, -1),
    points: copyPoints(previous),
    revision: draft.revision + 1,
  };
}

export function normalizedDraftPosition(
  coordinate: readonly [number, number],
): DraftPosition {
  return [
    normalizeCameraPrecision(coordinate[0]),
    normalizeCameraPrecision(coordinate[1]),
  ];
}

export function canonicalDraftPoints(
  points: readonly (readonly [number, number])[],
  isClosed: boolean,
): DraftPosition[] {
  const copied = copyPoints(points);
  if (isClosed && copied[0]) copied.push([...copied[0]]);
  return copied;
}

export function draftValidationError(
  points: readonly (readonly [number, number])[],
  kind: RouteKind,
  isClosed: boolean,
) {
  return routePointValidationError(canonicalDraftPoints(points, isClosed), {
    kind,
    closed: isClosed,
  });
}

export function moveDraftPoint(
  points: readonly (readonly [number, number])[],
  from: number,
  to: number,
): DraftPosition[] {
  if (
    from === to
    || !Number.isSafeInteger(from)
    || !Number.isSafeInteger(to)
    || from < 0
    || from >= points.length
    || to < 0
    || to >= points.length
  ) return copyPoints(points);
  const next = copyPoints(points);
  const [point] = next.splice(from, 1);
  next.splice(to, 0, point);
  return next;
}

export function replaceDraftPoint(
  points: readonly (readonly [number, number])[],
  index: number,
  coordinate: readonly [number, number],
): DraftPosition[] {
  if (!Number.isSafeInteger(index) || index < 0 || index >= points.length) {
    return copyPoints(points);
  }
  const next = copyPoints(points);
  next[index] = normalizedDraftPosition(coordinate);
  return next;
}

export function removeDraftPoint(
  points: readonly (readonly [number, number])[],
  index: number,
): DraftPosition[] {
  if (!Number.isSafeInteger(index) || index < 0 || index >= points.length) {
    return copyPoints(points);
  }
  const next = copyPoints(points);
  next.splice(index, 1);
  return next;
}
