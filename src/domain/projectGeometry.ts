import { createArcGeometry } from './routeArcGeometry';
import { MAX_MERCATOR_LATITUDE, type LayerGeometry } from './project';

export function geometryPositionCount(geometry: LayerGeometry | undefined): number {
  if (!geometry) return 0;
  if (geometry.type === 'Point') return 1;
  if (geometry.type === 'Arc') return 2;
  if (geometry.type === 'LineString') return geometry.coordinates.length;
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.reduce((total, ring) => total + ring.length, 0);
  }
  return geometry.coordinates.reduce((total, polygon) => (
    total + polygon.reduce((polygonTotal, ring) => polygonTotal + ring.length, 0)
  ), 0);
}

type CoordinateCounter = { value: number };
type GeometryParserOptions = Readonly<{
  fail: (message: string) => never;
  maximumCoordinates: number;
}>;
type JsonObject = Record<string, unknown>;

function objectAt(value: unknown, label: string, fail: GeometryParserOptions['fail']): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${label} must be a JSON object.`);
  }
  return value as JsonObject;
}

function finiteNumber(value: unknown, label: string, fail: GeometryParserOptions['fail']) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be a finite number.`);
  return value;
}

function positionAt(
  value: unknown,
  label: string,
  coordinateCount: CoordinateCounter,
  options: GeometryParserOptions,
): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    options.fail(`${label} must contain exactly longitude and latitude.`);
  }
  const longitude = finiteNumber(value[0], `${label} longitude`, options.fail);
  const latitude = finiteNumber(value[1], `${label} latitude`, options.fail);
  if (Math.abs(longitude) > 180) options.fail(`${label} longitude must be between -180 and 180.`);
  if (Math.abs(latitude) > MAX_MERCATOR_LATITUDE) {
    options.fail(`${label} latitude must be between -${MAX_MERCATOR_LATITUDE} and ${MAX_MERCATOR_LATITUDE}.`);
  }
  coordinateCount.value += 1;
  if (coordinateCount.value > options.maximumCoordinates) {
    options.fail(`Projects may contain at most ${options.maximumCoordinates.toLocaleString()} positions.`);
  }
  return [longitude, latitude];
}

function polygonCoordinatesAt(
  value: unknown,
  label: string,
  coordinateCount: CoordinateCounter,
  options: GeometryParserOptions,
) {
  if (!Array.isArray(value) || value.length === 0) options.fail(`${label} needs at least one ring.`);
  return value.map((candidateRing, ringIndex) => {
    if (!Array.isArray(candidateRing) || candidateRing.length < 4) {
      options.fail(`Each ${label} ring needs at least four positions.`);
    }
    const ring = candidateRing.map((position, positionIndex) => positionAt(
      position,
      `${label} ring ${ringIndex + 1} position ${positionIndex + 1}`,
      coordinateCount,
      options,
    ));
    const first = ring[0];
    const last = ring.at(-1);
    if (!last || first[0] !== last[0] || first[1] !== last[1]) {
      options.fail(`Each ${label} ring must end at its starting position.`);
    }
    return ring;
  });
}

function arcGeometryAt(
  value: unknown,
  label: string,
  coordinateCount: CoordinateCounter,
  options: GeometryParserOptions,
) {
  if (!Array.isArray(value) || value.length !== 2) options.fail('Arc geometry needs exactly two anchors.');
  const anchors = value.map((position, index) => positionAt(
    position, `${label} Arc anchor ${index + 1}`, coordinateCount, options,
  ));
  const arc = createArcGeometry(anchors);
  if (!arc) options.fail('Arc geometry anchors must be distinct and unambiguous.');
  return arc;
}

export function parseLayerGeometry(
  value: unknown,
  label: string,
  coordinateCount: CoordinateCounter,
  options: GeometryParserOptions,
): LayerGeometry {
  const geometry = objectAt(value, `${label} geometry`, options.fail);
  if (geometry.type === 'Point') {
    return { type: 'Point', coordinates: positionAt(geometry.coordinates, `${label} Point`, coordinateCount, options) };
  }
  if (geometry.type === 'Arc') return arcGeometryAt(geometry.anchors, label, coordinateCount, options);
  if (geometry.type === 'LineString') {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) {
      options.fail('LineString geometry needs at least two positions.');
    }
    return {
      type: 'LineString',
      coordinates: geometry.coordinates.map((position, index) => positionAt(
        position, `${label} LineString position ${index + 1}`, coordinateCount, options,
      )),
    };
  }
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: polygonCoordinatesAt(geometry.coordinates, 'Polygon geometry', coordinateCount, options) };
  }
  if (geometry.type === 'MultiPolygon') {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      options.fail('MultiPolygon geometry needs at least one polygon.');
    }
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((polygon, polygonIndex) => polygonCoordinatesAt(
        polygon, `MultiPolygon polygon ${polygonIndex + 1}`, coordinateCount, options,
      )),
    };
  }
  options.fail(`${label} geometry type must be Point, LineString, Polygon, or MultiPolygon.`);
}
