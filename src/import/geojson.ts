import {
  createDefaultLayerAppearance,
  MAX_MERCATOR_LATITUDE,
  type ContentLayer,
  type LayerGeometry,
  type LayerType,
} from '../domain/project';

export const MAX_GEOJSON_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_GEOJSON_FEATURES = 1000;
export const MAX_GEOJSON_COORDINATES = 200_000;
export const MAX_GEOJSON_NAME_LENGTH = 100;

export type GeoJsonImportOptions = {
  existingLayerIds?: Iterable<string>;
};

type JsonObject = Record<string, unknown>;
type CoordinateCounter = { value: number };

export class GeoJsonImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeoJsonImportError';
  }
}

function objectAt(value: unknown, label: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new GeoJsonImportError(`${label} must be a JSON object.`);
  }
  return value as JsonObject;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new GeoJsonImportError(`${label} must be a finite number.`);
  }
  return value;
}

function positionAt(
  value: unknown,
  label: string,
  coordinateCount: CoordinateCounter,
): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new GeoJsonImportError(`${label} must contain exactly longitude and latitude.`);
  }
  const longitude = finiteNumber(value[0], `${label} longitude`);
  const latitude = finiteNumber(value[1], `${label} latitude`);
  if (Math.abs(longitude) > 180) {
    throw new GeoJsonImportError(`${label} longitude must be between -180 and 180.`);
  }
  if (Math.abs(latitude) > MAX_MERCATOR_LATITUDE) {
    throw new GeoJsonImportError(`${label} latitude must be between -${MAX_MERCATOR_LATITUDE} and ${MAX_MERCATOR_LATITUDE}.`);
  }
  coordinateCount.value += 1;
  if (coordinateCount.value > MAX_GEOJSON_COORDINATES) {
    throw new GeoJsonImportError(
      `GeoJSON may contain at most ${MAX_GEOJSON_COORDINATES} positions.`,
    );
  }
  return [longitude, latitude];
}

function geometryAt(
  value: unknown,
  featureLabel: string,
  coordinateCount: CoordinateCounter,
): LayerGeometry {
  const geometry = objectAt(value, `${featureLabel} geometry`);
  if (geometry.type === 'Point') {
    return {
      type: 'Point',
      coordinates: positionAt(geometry.coordinates, `${featureLabel} Point`, coordinateCount),
    };
  }
  if (geometry.type === 'LineString') {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) {
      throw new GeoJsonImportError(`${featureLabel} LineString needs at least two positions.`);
    }
    return {
      type: 'LineString',
      coordinates: geometry.coordinates.map((position, index) => (
        positionAt(position, `${featureLabel} LineString position ${index + 1}`, coordinateCount)
      )),
    };
  }
  if (geometry.type === 'Polygon') {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      throw new GeoJsonImportError(`${featureLabel} Polygon needs at least one ring.`);
    }
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.map((candidateRing, ringIndex) => {
        const ringLabel = `${featureLabel} Polygon ring ${ringIndex + 1}`;
        if (!Array.isArray(candidateRing) || candidateRing.length < 4) {
          throw new GeoJsonImportError(`${ringLabel} needs at least four positions.`);
        }
        const ring = candidateRing.map((position, positionIndex) => (
          positionAt(position, `${ringLabel} position ${positionIndex + 1}`, coordinateCount)
        ));
        const first = ring[0];
        const last = ring.at(-1);
        if (!last || first[0] !== last[0] || first[1] !== last[1]) {
          throw new GeoJsonImportError(`${ringLabel} must end at its starting position.`);
        }
        return ring;
      }),
    };
  }
  throw new GeoJsonImportError(`${featureLabel} geometry type ${String(geometry.type)} is not supported.`);
}

function layerTypeFor(geometry: LayerGeometry): LayerType {
  if (geometry.type === 'Point') return 'poi';
  if (geometry.type === 'LineString') return 'route';
  return 'shape';
}

function sanitizeName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const sanitized = value
    .normalize('NFKC')
    .replaceAll(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
  const bounded = [...sanitized].slice(0, MAX_GEOJSON_NAME_LENGTH).join('').trimEnd();
  return bounded || fallback;
}

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .replaceAll(/[\u{0300}-\u{036F}]/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .slice(0, 64)
    .replaceAll(/-$/g, '');
}

function validateFeatureId(feature: JsonObject, featureLabel: string): void {
  if (
    feature.id !== undefined
    && typeof feature.id !== 'string'
    && (typeof feature.id !== 'number' || !Number.isFinite(feature.id))
  ) {
    throw new GeoJsonImportError(`${featureLabel} ID must be a string or finite number.`);
  }
}

function featureAt(
  candidate: unknown,
  index: number,
  coordinateCount: CoordinateCounter,
  usedIds: Set<string>,
): ContentLayer {
  const featureLabel = `Feature ${index + 1}`;
  const feature = objectAt(candidate, featureLabel);
  if (feature.type !== 'Feature') throw new GeoJsonImportError(`${featureLabel} must have type Feature.`);
  validateFeatureId(feature, featureLabel);
  const properties = feature.properties === null || feature.properties === undefined
    ? {}
    : objectAt(feature.properties, `${featureLabel} properties`);
  const geometry = geometryAt(feature.geometry, featureLabel, coordinateCount);
  const fallback = `${geometry.type === 'LineString' ? 'Line' : geometry.type} ${index + 1}`;
  const name = sanitizeName(properties.name, fallback);
  const idSeed = typeof feature.id === 'string' || typeof feature.id === 'number'
    ? String(feature.id)
    : name;
  const baseId = `geojson-${slug(idSeed) || slug(fallback)}`;
  let id = baseId;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  const type = layerTypeFor(geometry);
  return {
    id,
    name,
    type,
    visible: true,
    locked: false,
    opacity: 100,
    appearance: createDefaultLayerAppearance(type),
    geometry,
  };
}

export function parseGeoJsonText(
  text: string,
  options: GeoJsonImportOptions = {},
): ContentLayer[] {
  if (new TextEncoder().encode(text).byteLength > MAX_GEOJSON_FILE_BYTES) {
    throw new GeoJsonImportError(
      `GeoJSON files may be at most ${MAX_GEOJSON_FILE_BYTES} bytes.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new GeoJsonImportError('This file is not valid JSON.');
  }

  const root = objectAt(parsed, 'GeoJSON');
  if (root.type !== 'Feature' && root.type !== 'FeatureCollection') {
    throw new GeoJsonImportError('GeoJSON root must be a Feature or FeatureCollection.');
  }
  const features = root.type === 'FeatureCollection' ? root.features : [root];
  if (!Array.isArray(features)) {
    throw new GeoJsonImportError('FeatureCollection features must be an array.');
  }
  if (features.length > MAX_GEOJSON_FEATURES) {
    throw new GeoJsonImportError(
      `GeoJSON may contain at most ${MAX_GEOJSON_FEATURES} features.`,
    );
  }

  const usedIds = new Set(options.existingLayerIds);
  const coordinateCount = { value: 0 };
  return features.map((candidate, index) => featureAt(candidate, index, coordinateCount, usedIds));
}
