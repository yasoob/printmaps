export function minimumRoutePointCount(isClosed: boolean): number {
  return isClosed ? 3 : 2;
}

export function routePointRemovalError({
  pointCount,
  pointIndex,
  isClosed,
  isMiddleOnly = false,
}: {
  pointCount: number;
  pointIndex: number;
  isClosed: boolean;
  isMiddleOnly?: boolean;
}): string | null {
  const distinctCount = pointCount - (isClosed ? 1 : 0);
  if (!Number.isSafeInteger(pointIndex) || pointIndex < 0 || pointIndex >= distinctCount) {
    return 'Choose a distinct route point to remove, not the repeated closing point.';
  }
  if (distinctCount <= minimumRoutePointCount(isClosed)) {
    return isClosed
      ? 'Closed routes need at least three distinct points.'
      : 'Routes need at least two distinct points.';
  }
  if (isMiddleOnly && (pointIndex === 0 || pointIndex === pointCount - 1)) {
    return 'Only a middle route point can be removed.';
  }
  return null;
}
