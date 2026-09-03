import {
  arcSegmentPoint,
  createArcGeometry,
} from "./routeArcGeometry";
import { MAX_MERCATOR_LATITUDE, type ContentLayer } from "./project";
import {
  arePositionsEqual,
  isCompleteRouteLayer,
  semanticRoutePoints,
  type CompleteRouteLayer,
} from "./routeModel";
import {
  convertRoute,
  insertRoutePoint,
  removeRoutePoint,
  replaceRouteSemanticPoints,
} from "./routeTransformations";

export function isValidPosition(longitude: number, latitude: number) {
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -MAX_MERCATOR_LATITUDE &&
    latitude <= MAX_MERCATOR_LATITUDE
  );
}

export function midpointPosition(
  start: readonly [number, number],
  end: readonly [number, number],
): [number, number] {
  const directLongitudeDelta = end[0] - start[0];
  const midpointLongitude =
    Math.abs(directLongitudeDelta) <= 180
      ? (start[0] + end[0]) / 2
      : start[0] + (((directLongitudeDelta + 540) % 360) - 180) / 2;
  const normalizedLongitude =
    midpointLongitude > 180 ? midpointLongitude - 360 : midpointLongitude;
  return [
    Number(normalizedLongitude.toFixed(6)),
    Number(((start[1] + end[1]) / 2).toFixed(6)),
  ];
}

export function semanticRoutePositions(
  layer: ContentLayer,
): readonly (readonly [number, number])[] | null {
  return semanticRoutePoints(layer);
}

export function semanticRoutePointLabel(
  layer: ContentLayer,
  index: number,
): string {
  return `${layer.route?.kind === "road" ? "Waypoint" : "Anchor"} ${index + 1}`;
}

type EditableRouteGeometry = Extract<
  NonNullable<ContentLayer["geometry"]>,
  { type: "Arc" | "LineString" }
>;

function editableRouteGeometry(
  layer: ContentLayer | undefined,
): EditableRouteGeometry | null {
  const geometry = layer?.type === "route" ? layer.geometry : undefined;
  return geometry?.type === "LineString" || geometry?.type === "Arc"
    ? geometry
    : null;
}

function isSegmentIndex(index: number, positionCount: number) {
  return Number.isSafeInteger(index) && index >= 0 && index < positionCount - 1;
}

function isVertexIndex(index: number, positionCount: number) {
  return Number.isSafeInteger(index) && index >= 0 && index < positionCount;
}

function editedRouteLayer(
  layer: ContentLayer,
  geometry: NonNullable<ContentLayer["geometry"]>,
): ContentLayer | null {
  const updated = { ...layer, geometry };
  if (
    updated.provenance?.service === "map-matching-v5" ||
    updated.provenance?.service === "directions-v5"
  ) {
    delete updated.provenance;
  }
  return isCompleteRouteLayer(updated) ? updated : null;
}

export function replaceRouteGeometry(
  layer: ContentLayer | undefined,
  positions: readonly (readonly [number, number])[],
): ContentLayer | null {
  const source = localEditableRoute(layer);
  if (!source || positions.length < 2) return null;
  const current = semanticRoutePoints(source);
  if (
    !current ||
    positions.some(
      ([longitude, latitude]) => !isValidPosition(longitude, latitude),
    )
  )
    return null;
  let coordinates = positions.map(
    ([longitude, latitude]) => [longitude, latitude] as [number, number],
  );
  if (source.route.closed && arePositionsEqual(coordinates[0], coordinates.at(-1)!)) {
    coordinates = coordinates.slice(0, -1);
  }
  const isUnchanged =
    coordinates.length === current.length - (source.route.closed ? 1 : 0) &&
    coordinates.every(
      ([longitude, latitude], index) =>
        current[index][0] === longitude && current[index][1] === latitude,
    );
  if (isUnchanged) return null;
  return replaceRouteSemanticPoints(source, coordinates);
}

function localEditableRoute(
  layer: ContentLayer | undefined,
): CompleteRouteLayer | null {
  if (!layer || !isCompleteRouteLayer(layer)) return null;
  return layer.route.kind === "road" ? convertRoute(layer, "straight") : layer;
}

function moveOpenRouteVertex(
  source: CompleteRouteLayer,
  vertexIndex: number,
  coordinate: [number, number],
) {
  const current = semanticRoutePoints(source);
  if (!current) return null;
  const coordinates = current.map((position, index) =>
    index === vertexIndex
      ? coordinate
      : [position[0], position[1]] as [number, number]);
  const geometry = source.geometry.type === "Arc"
    ? createArcGeometry(coordinates, source.geometry.curvatures)
    : { type: "LineString" as const, coordinates };
  if (!geometry) return null;
  return editedRouteLayer(source, geometry);
}

function isValidRouteVertexRequest(
  vertexIndex: number,
  longitude: number,
  latitude: number,
) {
  return Number.isSafeInteger(vertexIndex)
    && isValidPosition(longitude, latitude);
}

export function moveRouteVertex(
  layer: ContentLayer | undefined,
  vertexIndex: number,
  [longitude, latitude]: readonly [number, number],
): ContentLayer | null {
  if (!isValidRouteVertexRequest(vertexIndex, longitude, latitude)) return null;
  const source = localEditableRoute(layer);
  const current = source && semanticRoutePoints(source);
  if (!source || !current || vertexIndex < 0 || vertexIndex >= current.length) return null;
  if (arePositionsEqual(current[vertexIndex], [longitude, latitude])) return null;
  const semanticIndex = source.route.closed && vertexIndex === current.length - 1
    ? 0
    : vertexIndex;
  if (!source.route.closed) {
    return moveOpenRouteVertex(
      source,
      semanticIndex,
      [longitude, latitude],
    );
  }
  const unique = source.route.closed ? current.slice(0, -1) : current;
  const coordinates = unique.map((position, index) =>
    index === semanticIndex
      ? ([longitude, latitude] as [number, number])
      : position,
  );
  return replaceRouteSemanticPoints(source, coordinates);
}

export function insertRouteVertex(
  layer: ContentLayer | undefined,
  vertexIndex: number,
  requestedCoordinate?: readonly [number, number],
): ContentLayer | null {
  const source = localEditableRoute(layer);
  const geometry = editableRouteGeometry(source ?? undefined);
  if (!source || !geometry) return null;
  const positions =
    geometry.type === "Arc" ? geometry.anchors : geometry.coordinates;
  if (!isSegmentIndex(vertexIndex, positions.length)) return null;
  const start = positions[vertexIndex];
  const end = positions[vertexIndex + 1];
  let inserted: [number, number];
  if (requestedCoordinate)
    inserted = [requestedCoordinate[0], requestedCoordinate[1]];
  else if (geometry.type === "Arc")
    inserted = arcSegmentPoint(geometry, vertexIndex, 0.5);
  else inserted = midpointPosition(start, end);
  if (!isValidPosition(inserted[0], inserted[1])) return null;
  return insertRoutePoint(source, vertexIndex, inserted);
}

function canRemoveVertex(vertexIndex: number, count: number) {
  return (
    count > 2 &&
    vertexIndex > 0 &&
    vertexIndex < count - 1 &&
    isVertexIndex(vertexIndex, count)
  );
}

export function removeRouteVertex(
  layer: ContentLayer | undefined,
  vertexIndex: number,
): ContentLayer | null {
  const source = localEditableRoute(layer);
  const geometry = editableRouteGeometry(source ?? undefined);
  if (!source || !geometry) return null;
  const positions =
    geometry.type === "Arc" ? geometry.anchors : geometry.coordinates;
  if (!canRemoveVertex(vertexIndex, positions.length)) return null;
  return removeRoutePoint(source, vertexIndex);
}

export function setArcSegmentCurvature(
  layer: ContentLayer | undefined,
  segmentIndex: number,
  curvature: number,
): ContentLayer | null {
  if (
    layer?.type !== "route" ||
    layer.geometry?.type !== "Arc" ||
    !Number.isSafeInteger(segmentIndex) ||
    segmentIndex < 0 ||
    segmentIndex >= layer.geometry.curvatures.length ||
    layer.geometry.curvatures[segmentIndex] === curvature
  )
    return null;
  const curvatures = [...layer.geometry.curvatures];
  curvatures[segmentIndex] = curvature;
  const geometry = createArcGeometry(layer.geometry.anchors, curvatures);
  return geometry ? editedRouteLayer(layer, geometry) : null;
}
