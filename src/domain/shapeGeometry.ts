import type { ContentLayer } from './project';
import { isValidPosition } from './routeGeometry';

function isSamePosition(
  first: readonly [number, number],
  second: readonly [number, number],
) {
  return first[0] === second[0] && first[1] === second[1];
}

export function isEditableShapeRing(
  ring: readonly (readonly [number, number])[] | undefined,
) {
  if (!ring || ring.length < 4) return false;
  const first = ring[0];
  const last = ring.at(-1);
  return first !== undefined && last !== undefined && isSamePosition(first, last);
}

function closedRingAt(layer: ContentLayer | undefined, ringIndex: number) {
  if (
    layer?.type !== 'shape'
    || layer.geometry?.type !== 'Polygon'
    || !Number.isSafeInteger(ringIndex)
    || ringIndex < 0
  ) return null;
  const ring = layer.geometry.coordinates[ringIndex];
  return isEditableShapeRing(ring) ? ring : null;
}

function movedRing(
  ring: readonly (readonly [number, number])[],
  vertexIndex: number,
  coordinates: readonly [number, number],
) {
  return ring.map((position, candidateVertexIndex) => (
    candidateVertexIndex === vertexIndex || (vertexIndex === 0 && candidateVertexIndex === ring.length - 1)
      ? [...coordinates] as [number, number]
      : [position[0], position[1]] as [number, number]
  ));
}

function hasAtLeastThreeDistinctVertices(ring: readonly (readonly [number, number])[]) {
  const distinctVertices = new Set(ring.slice(0, -1).map((position) => `${position[0]},${position[1]}`));
  return distinctVertices.size >= 3;
}

function isValidVertexInput(vertexIndex: number, longitude: number, latitude: number) {
  return Number.isSafeInteger(vertexIndex)
    && vertexIndex >= 0
    && isValidPosition(longitude, latitude);
}

export function moveShapeVertex(
  layer: ContentLayer | undefined,
  ringIndex: number,
  vertexIndex: number,
  [longitude, latitude]: readonly [number, number],
): ContentLayer | null {
  if (!isValidVertexInput(vertexIndex, longitude, latitude)) return null;

  const ring = closedRingAt(layer, ringIndex);
  const polygon = layer?.geometry?.type === 'Polygon' ? layer.geometry : null;
  if (
    !layer
    || !ring
    || !polygon
    || vertexIndex >= ring.length - 1
    || isSamePosition(ring[vertexIndex], [longitude, latitude])
  ) return null;

  const updatedRing = movedRing(ring, vertexIndex, [longitude, latitude]);
  if (!hasAtLeastThreeDistinctVertices(updatedRing)) return null;

  const rings = polygon.coordinates.map((candidate, candidateIndex) => (
    candidateIndex === ringIndex ? updatedRing : candidate
  ));
  return { ...layer, geometry: { type: 'Polygon', coordinates: rings } };
}
