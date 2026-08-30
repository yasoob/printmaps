import type {
  ResolvedRouteSegmentStyle,
  RouteMarkerAppearance,
} from './layerAppearance';
import { MAX_RENDERED_ROUTE_MARKERS, MIN_ROUTE_MARKER_REPEAT_SPACING } from './routeAppearance';
import type { ContentLayer } from './project';
import {
  DEFAULT_ARC_SEGMENTS,
  arcSegmentPoint,
  rebasePathLongitudes,
} from './routeArcGeometry';
import { partitionRoadGeometry } from './routeRoadGeometry';
import {
  isCompleteRouteLayer,
  semanticRoutePoints,
  type CompleteRouteLayer,
  type RoutePosition,
} from './routeModel';

type ProjectedPosition = { x: number; y: number };

export type RenderedRouteLeg = {
  index: number;
  path: RoutePosition[];
  style: ResolvedRouteSegmentStyle;
};

export type RenderedRouteMarker = {
  position: RoutePosition;
  bearing: number;
  tangent: {
    start: RoutePosition;
    end: RoutePosition;
  };
  fraction: number;
  legIndex: number;
  style: ResolvedRouteSegmentStyle;
};

export type RenderedRoute = {
  path: RoutePosition[];
  legs: RenderedRouteLeg[];
  markers: RenderedRouteMarker[];
};

export function rebaseRenderedRouteMarker(
  marker: RenderedRouteMarker,
  referenceLongitude?: number,
): RenderedRouteMarker {
  const rebased = rebasePathLongitudes(
    [marker.tangent.start, marker.position, marker.tangent.end],
    referenceLongitude,
  );
  return {
    ...marker,
    position: rebased[1]!,
    tangent: { start: rebased[0]!, end: rebased[2]! },
  };
}

export function projectedRouteMarkerBearing(
  marker: Pick<RenderedRouteMarker, 'tangent'>,
  appearance: RouteMarkerAppearance,
  projectPoint: (position: RoutePosition) => ProjectedPosition,
  yAxis: 'down' | 'up',
): number {
  if (!appearance.orientToPath) return 0;
  const start = projectPoint(marker.tangent.start);
  const end = projectPoint(marker.tangent.end);
  const deltaY = yAxis === 'down' ? start.y - end.y : end.y - start.y;
  const bearing = Math.atan2(end.x - start.x, deltaY) * 180 / Math.PI;
  return ((bearing + (appearance.reverseFacing ? 180 : 0)) % 360 + 360) % 360;
}

function project([longitude, latitude]: readonly [number, number]): ProjectedPosition {
  const radians = latitude * Math.PI / 180;
  return {
    x: (longitude + 180) / 360,
    y: (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2,
  };
}

function unproject({ x, y }: ProjectedPosition): RoutePosition {
  return [
    Number((x * 360 - 180).toFixed(6)),
    Number((Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI).toFixed(6)),
  ];
}

function continuousProjectedPath(path: readonly (readonly [number, number])[]): ProjectedPosition[] {
  const projected: ProjectedPosition[] = [];
  for (const position of path) {
    const point = project(position);
    const previous = projected.at(-1);
    if (previous) {
      while (point.x - previous.x > 0.5) point.x -= 1;
      while (point.x - previous.x < -0.5) point.x += 1;
    }
    projected.push(point);
  }
  return projected;
}

export { partitionRoadGeometry } from './routeRoadGeometry';

function renderedLegPaths(layer: CompleteRouteLayer): RoutePosition[][] | null {
  const semantic = semanticRoutePoints(layer)!;
  if (layer.route.kind === 'road') {
    if (layer.geometry.type !== 'LineString') return null;
    return partitionRoadGeometry(layer.geometry.coordinates, semantic);
  }
  if (layer.route.kind === 'arc') {
    if (layer.geometry.type !== 'Arc') return null;
    const legs = layer.geometry.curvatures.map((_curvature, segmentIndex) => (
      Array.from(
        { length: DEFAULT_ARC_SEGMENTS + 1 },
        (_unused, pointIndex) => arcSegmentPoint(
          layer.geometry as Extract<CompleteRouteLayer['geometry'], { type: 'Arc' }>,
          segmentIndex,
          pointIndex / DEFAULT_ARC_SEGMENTS,
        ),
      )
    ));
    const complete = rebasePathLongitudes(legs.flatMap((leg, index) => leg.slice(index === 0 ? 0 : 1)));
    let offset = 0;
    return legs.map((leg) => {
      const start = offset;
      offset += leg.length - 1;
      return complete.slice(start, start + leg.length);
    });
  }
  const path = rebasePathLongitudes(semantic);
  return path.slice(1).map((end, index) => [[...path[index]], [...end]]);
}

function resolveStyle(layer: CompleteRouteLayer, index: number): ResolvedRouteSegmentStyle {
  const override = layer.appearance.segmentStyles[index];
  return {
    color: override?.color ?? layer.appearance.color,
    width: override?.width ?? layer.appearance.width,
    strokeStyle: override?.strokeStyle ?? layer.appearance.strokeStyle,
  };
}

function completePath(legs: readonly RenderedRouteLeg[]): RoutePosition[] {
  return legs.flatMap((leg, index) => leg.path.slice(index === 0 ? 0 : 1));
}

type RenderedEdge = {
  start: ProjectedPosition;
  end: ProjectedPosition;
  length: number;
  legIndex: number;
};

function renderedEdges(legs: readonly RenderedRouteLeg[]): RenderedEdge[] {
  return legs.flatMap((leg) => {
    const projected = continuousProjectedPath(leg.path);
    return projected.slice(1).map((end, index) => {
      const start = projected[index];
      return {
        start,
        end,
        length: Math.hypot(end.x - start.x, end.y - start.y),
        legIndex: leg.index,
      };
    }).filter((edge) => edge.length > 0);
  });
}

function normalizedBearing(edge: RenderedEdge, marker: RouteMarkerAppearance): number {
  if (!marker.orientToPath) return 0;
  const bearing = Math.atan2(edge.end.x - edge.start.x, edge.start.y - edge.end.y) * 180 / Math.PI;
  return ((bearing + (marker.reverseFacing ? 180 : 0)) % 360 + 360) % 360;
}

function markerFractions(marker: RouteMarkerAppearance): number[] {
  if (marker.placement.type === 'center') return [0.5];
  if (marker.placement.type === 'fraction') return [marker.placement.fraction];
  const spacing = marker.placement.spacing;
  if (!Number.isFinite(spacing) || spacing < MIN_ROUTE_MARKER_REPEAT_SPACING || spacing > 1) {
    return [];
  }
  return Array.from(
    { length: Math.min(MAX_RENDERED_ROUTE_MARKERS, Math.ceil(1 / spacing)) },
    (_unused, index) => spacing / 2 + index * spacing,
  ).filter((fraction) => fraction < 1);
}

function markerAtFraction(
  fraction: number,
  edges: readonly RenderedEdge[],
  legs: readonly RenderedRouteLeg[],
  marker: RouteMarkerAppearance,
): RenderedRouteMarker {
  const totalLength = edges.reduce((total, edge) => total + edge.length, 0);
  const target = totalLength * fraction;
  let traversed = 0;
  let selected = fraction === 1 ? edges.at(-1)! : edges[0];
  for (const edge of edges) {
    selected = edge;
    if (traversed + edge.length >= target) break;
    traversed += edge.length;
  }
  const edgeFraction = selected.length === 0
    ? 0
    : Math.max(0, Math.min(1, (target - traversed) / selected.length));
  return {
    position: unproject({
      x: selected.start.x + (selected.end.x - selected.start.x) * edgeFraction,
      y: selected.start.y + (selected.end.y - selected.start.y) * edgeFraction,
    }),
    bearing: normalizedBearing(selected, marker),
    tangent: {
      start: unproject(selected.start),
      end: unproject(selected.end),
    },
    fraction,
    legIndex: selected.legIndex,
    style: { ...legs[selected.legIndex].style },
  };
}

export function deriveRenderedRoute(layer: ContentLayer): RenderedRoute | null {
  if (!isCompleteRouteLayer(layer)) return null;
  const paths = renderedLegPaths(layer);
  if (!paths) return null;
  const legs = paths.map((path, index) => ({
    index,
    path,
    style: resolveStyle(layer, index),
  }));
  const edges = renderedEdges(legs);
  if (edges.length === 0) return null;
  const markers = layer.appearance.marker
    ? markerFractions(layer.appearance.marker).map((fraction) => markerAtFraction(
        fraction,
        edges,
        legs,
        layer.appearance.marker!,
      ))
    : [];
  return { path: completePath(legs), legs, markers };
}
