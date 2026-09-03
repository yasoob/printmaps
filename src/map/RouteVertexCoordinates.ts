import { sampleArc } from "../domain/routeArcGeometry";
import type { ContentLayer } from "../domain/project";
import { semanticRoutePositions } from "../domain/routeGeometry";

export function canonicalRouteCoordinates(layer: ContentLayer) {
  return (semanticRoutePositions(layer) ?? [])
    .map((coordinate) => [...coordinate] as [number, number]);
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
