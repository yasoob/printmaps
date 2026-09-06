import { createArcGeometry, sampleArc } from "../domain/routeArcGeometry";
import type { ContentLayer } from "../domain/project";
import { isValidPosition, moveRouteVertex, semanticRoutePositions } from "../domain/routeGeometry";

export function normalizedMapCoordinate(longitude: number, latitude: number): [number, number] | null {
  if (!isValidPosition(longitude, latitude)) return null;
  return [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))];
}

export function canonicalRouteCoordinates(layer: ContentLayer) {
  return (semanticRoutePositions(layer) ?? [])
    .map((coordinate) => [...coordinate] as [number, number]);
}

export function editedRouteVertexCoordinates(
  layer: ContentLayer | undefined,
  vertexIndex: number,
  coordinate: readonly [number, number],
) {
  const current = layer && semanticRoutePositions(layer)?.[vertexIndex];
  const isUnchanged = current && current[0] === coordinate[0] && current[1] === coordinate[1];
  const moved = isUnchanged ? layer : moveRouteVertex(layer, vertexIndex, coordinate);
  const geometry = moved?.geometry;
  if (!geometry) return null;
  if (geometry.type === 'LineString') return geometry.coordinates;
  if (geometry.type === 'Arc') return geometry.anchors;
  return null;
}

export function displayCoordinates(layer: ContentLayer, coordinates: [number, number][]) {
  if (layer.geometry?.type !== 'Arc') return coordinates;
  const arc = createArcGeometry(coordinates, layer.geometry.curvatures);
  return arc ? sampleArc(arc) : null;
}

export function arcInsertionCoordinates(
  geometry: Extract<
    NonNullable<ContentLayer["geometry"]>,
    { type: "Arc" }
  >,
) {
  const coordinates = sampleArc(geometry);
  const samplesPerSegment =
    (coordinates.length - 1) / geometry.curvatures.length;
  return geometry.curvatures.map((_curvature, segmentIndex) =>
    coordinates[
      segmentIndex * samplesPerSegment + Math.floor(samplesPerSegment / 2)
    ]!);
}
