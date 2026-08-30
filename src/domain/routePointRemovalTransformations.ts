import type { ContentLayer, DirectionsRouteInput } from './project';
import { DEFAULT_ARC_CURVATURE } from './routeArcGeometry';
import type {
  ResolvedRouteSegmentStyle,
  RouteAppearance,
  RouteSegmentStyleOverride,
} from './layerAppearance';
import {
  routePositionKey,
  type CompleteRouteLayer,
  type RoutePosition,
} from './routeModel';
import {
  routeCandidate,
  sourceCurvatures,
  sourcePoints,
  sourceRoute,
} from './routeTransformationCandidate';

type RouteParts = {
  points: RoutePosition[];
  styles: (RouteSegmentStyleOverride | null)[];
  curvatures?: number[];
};

function resolvedStyle(
  appearance: RouteAppearance,
  override: RouteSegmentStyleOverride | null,
): ResolvedRouteSegmentStyle {
  return {
    color: override?.color ?? appearance.color,
    width: override?.width ?? appearance.width,
    strokeStyle: override?.strokeStyle ?? appearance.strokeStyle,
  };
}

function mergedStyle(
  appearance: RouteAppearance,
  left: RouteSegmentStyleOverride | null,
  right: RouteSegmentStyleOverride | null,
): RouteSegmentStyleOverride | null {
  const leftResolved = resolvedStyle(appearance, left);
  const rightResolved = resolvedStyle(appearance, right);
  const merged: RouteSegmentStyleOverride = {};
  if (leftResolved.color === rightResolved.color && leftResolved.color !== appearance.color) {
    merged.color = leftResolved.color;
  }
  if (leftResolved.width === rightResolved.width && leftResolved.width !== appearance.width) {
    merged.width = leftResolved.width;
  }
  if (leftResolved.strokeStyle === rightResolved.strokeStyle
    && leftResolved.strokeStyle !== appearance.strokeStyle) {
    merged.strokeStyle = leftResolved.strokeStyle;
  }
  return Object.keys(merged).length === 0 ? null : merged;
}

function openRemovalParts(
  source: CompleteRouteLayer,
  pointIndex: number,
): RouteParts {
  const points = sourcePoints(source);
  const styles = source.appearance.segmentStyles.map((style) => style && { ...style });
  const curvatures = source.route.kind === 'arc' ? sourceCurvatures(source) : undefined;
  points.splice(pointIndex, 1);
  if (pointIndex === 0) {
    styles.shift();
    curvatures?.shift();
  } else if (pointIndex === points.length) {
    styles.pop();
    curvatures?.pop();
  } else {
    styles.splice(
      pointIndex - 1,
      2,
      mergedStyle(source.appearance, styles[pointIndex - 1], styles[pointIndex]),
    );
    curvatures?.splice(pointIndex - 1, 2, DEFAULT_ARC_CURVATURE);
  }
  return { points, styles, curvatures };
}

function closedRemovalParts(
  source: CompleteRouteLayer,
  pointIndex: number,
): RouteParts {
  const points = sourcePoints(source);
  const unique = points.slice(0, -1);
  let styles = source.appearance.segmentStyles.map((style) => style && { ...style });
  let curvatures = source.route.kind === 'arc' ? sourceCurvatures(source) : undefined;
  unique.splice(pointIndex, 1);
  if (pointIndex === 0) {
    styles = [
      ...styles.slice(1, -1),
      mergedStyle(source.appearance, styles.at(-1)!, styles[0]),
    ];
    if (curvatures) {
      curvatures = [...curvatures.slice(1, -1), DEFAULT_ARC_CURVATURE];
    }
  } else {
    styles.splice(
      pointIndex - 1,
      2,
      mergedStyle(source.appearance, styles[pointIndex - 1], styles[pointIndex]),
    );
    curvatures?.splice(pointIndex - 1, 2, DEFAULT_ARC_CURVATURE);
  }
  return { points: [...unique, [...unique[0]]], styles, curvatures };
}

export function removeRoutePoint(
  layer: ContentLayer,
  pointIndex: number,
  road?: DirectionsRouteInput,
): CompleteRouteLayer | null {
  const source = sourceRoute(layer);
  if (!source || !Number.isSafeInteger(pointIndex)) return null;
  const uniqueCount = sourcePoints(source).length - (source.route.closed ? 1 : 0);
  const minimum = source.route.closed ? 3 : 2;
  if (pointIndex < 0 || pointIndex >= uniqueCount || uniqueCount <= minimum) return null;
  const parts = source.route.closed
    ? closedRemovalParts(source, pointIndex)
    : openRemovalParts(source, pointIndex);
  return routeCandidate({
    source,
    kind: source.route.kind,
    ...parts,
    road,
  });
}

function undirectedLegKey(
  start: readonly [number, number],
  end: readonly [number, number],
): string {
  const left = routePositionKey(start);
  const right = routePositionKey(end);
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

export function reorderRoutePoints(
  layer: ContentLayer,
  order: readonly number[],
  road?: DirectionsRouteInput,
): CompleteRouteLayer | null {
  const source = sourceRoute(layer);
  if (!source) return null;
  const current = sourcePoints(source);
  const unique = source.route.closed ? current.slice(0, -1) : current;
  if (order.length !== unique.length
    || order.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= unique.length)
    || new Set(order).size !== order.length) return null;
  const points = order.map((index) => [...unique[index]] as RoutePosition);
  if (source.route.closed) points.push([...points[0]]);
  const stylesByPair = new Map<string, RouteSegmentStyleOverride | null>();
  const curvatureByPair = new Map<string, number>();
  for (let index = 0; index < current.length - 1; index += 1) {
    const key = undirectedLegKey(current[index], current[index + 1]);
    stylesByPair.set(key, source.appearance.segmentStyles[index]);
    if (source.route.kind === 'arc') {
      curvatureByPair.set(key, sourceCurvatures(source)[index]);
    }
  }
  const styles = points.slice(1).map((point, index) => {
    const style = stylesByPair.get(undirectedLegKey(points[index], point));
    return style ? { ...style } : null;
  });
  const curvatures = source.route.kind === 'arc'
    ? points.slice(1).map((point, index) => (
        curvatureByPair.get(undirectedLegKey(points[index], point)) ?? DEFAULT_ARC_CURVATURE
      ))
    : undefined;
  return routeCandidate({
    source,
    kind: source.route.kind,
    points,
    styles,
    curvatures,
    road,
  });
}

export function replaceRouteSemanticPoints(
  layer: ContentLayer,
  semanticPoints: readonly (readonly [number, number])[],
  road?: DirectionsRouteInput,
): CompleteRouteLayer | null {
  const source = sourceRoute(layer);
  if (!source) return null;
  const current = sourcePoints(source);
  const points = semanticPoints.map(
    ([longitude, latitude]) => [longitude, latitude] as RoutePosition,
  );
  if (source.route.closed && points[0]) points.push([...points[0]]);
  const stylesByPair = new Map<string, RouteSegmentStyleOverride | null>();
  const curvatureByPair = new Map<string, number>();
  for (let index = 0; index < current.length - 1; index += 1) {
    const key = undirectedLegKey(current[index], current[index + 1]);
    stylesByPair.set(key, source.appearance.segmentStyles[index]);
    if (source.route.kind === "arc") {
      curvatureByPair.set(key, sourceCurvatures(source)[index]);
    }
  }
  const styles = points.slice(1).map((point, index) => {
    const style = stylesByPair.get(undirectedLegKey(points[index], point));
    return style ? { ...style } : null;
  });
  const curvatures = source.route.kind === "arc"
    ? points.slice(1).map((point, index) =>
        curvatureByPair.get(undirectedLegKey(points[index], point))
        ?? DEFAULT_ARC_CURVATURE
      )
    : undefined;
  return routeCandidate({
    source,
    kind: source.route.kind,
    points,
    styles,
    curvatures,
    road,
  });
}
