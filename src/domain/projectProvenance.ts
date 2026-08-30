import type {
  DirectionsProvenance,
  GeocodingProvenance,
  IsochroneProvenance,
  LayerGeometry,
  LayerType,
  MapMatchingProvenance,
  ProviderProvenance,
} from './project';
import { parseLayerGeometry } from './projectGeometry';
import { ProjectFileError } from './projectFileError';

type JsonObject = Record<string, unknown>;
const PROFILES = new Set<IsochroneProvenance['profile']>(['driving', 'cycling', 'walking']);

export function validateProviderGeometry(
  provenance: ProviderProvenance | undefined,
  geometry: LayerGeometry | undefined,
  fail: (message: string) => never,
) {
  if (provenance?.service === 'directions-v5' && geometry?.type !== 'LineString') {
    fail('Directions provenance requires LineString route geometry.');
  }
  if (provenance?.service === 'map-matching-v5' && geometry?.type !== 'LineString') {
    fail('Map-matching provenance requires LineString route geometry.');
  }
}

function objectAt(value: unknown, label: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProjectFileError(`${label} must be a JSON object.`);
  }
  return value as JsonObject;
}

function finiteNumber(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ProjectFileError(`${label} must be a finite number.`);
  }
  return value;
}

function geometryAt(value: unknown, label: string, coordinateCount: { value: number }) {
  return parseLayerGeometry(value, label, coordinateCount, {
    maximumCoordinates: 200_000,
    fail: (message) => { throw new ProjectFileError(message); },
  });
}

function profileAt(value: unknown, index: number): IsochroneProvenance['profile'] {
  if (!PROFILES.has(value as IsochroneProvenance['profile'])) {
    throw new ProjectFileError(`Layer ${index + 1} provenance travel profile is not supported.`);
  }
  return value as IsochroneProvenance['profile'];
}

function parseIsochroneProvenance(
  provenance: JsonObject,
  type: LayerType,
  index: number,
  coordinateCount: { value: number },
): IsochroneProvenance {
  if (type !== 'shape') throw new ProjectFileError(`Layer ${index + 1} isochrone provenance is only valid for Area layers.`);
  const centerGeometry = geometryAt(
    { type: 'Point', coordinates: provenance.center },
    `Layer ${index + 1} provenance center`,
    coordinateCount,
  );
  if (centerGeometry.type !== 'Point') throw new ProjectFileError(`Layer ${index + 1} provenance center is invalid.`);
  const minutes = finiteNumber(provenance.minutes, `Layer ${index + 1} provenance minutes`);
  if (!Number.isSafeInteger(minutes) || minutes < 5 || minutes > 60) {
    throw new ProjectFileError(`Layer ${index + 1} provenance minutes must be a whole number from 5 to 60.`);
  }
  return {
    provider: 'mapbox', service: 'isochrone-v1', center: centerGeometry.coordinates,
    profile: profileAt(provenance.profile, index), minutes,
  };
}

function parseDirectionsProvenance(
  provenance: JsonObject,
  type: LayerType,
  index: number,
  coordinateCount: { value: number },
): DirectionsProvenance {
  if (type !== 'route') throw new ProjectFileError(`Layer ${index + 1} directions provenance is only valid for Route layers.`);
  const waypointGeometry = geometryAt(
    { type: 'LineString', coordinates: provenance.waypoints },
    `Layer ${index + 1} provenance waypoints`,
    coordinateCount,
  );
  if (waypointGeometry.type !== 'LineString' || waypointGeometry.coordinates.length > 26) {
    throw new ProjectFileError(`Layer ${index + 1} provenance needs 2 to 25 semantic waypoints, plus an optional canonical closing waypoint.`);
  }
  const distanceMeters = finiteNumber(provenance.distanceMeters, `Layer ${index + 1} provenance distance`);
  const durationSeconds = finiteNumber(provenance.durationSeconds, `Layer ${index + 1} provenance duration`);
  if (distanceMeters < 0 || durationSeconds < 0) {
    throw new ProjectFileError(`Layer ${index + 1} provenance distance and duration must be non-negative.`);
  }
  return {
    provider: 'mapbox', service: 'directions-v5', waypoints: waypointGeometry.coordinates,
    profile: profileAt(provenance.profile, index), distanceMeters, durationSeconds,
  };
}

function parseGeocodingProvenance(
  provenance: JsonObject,
  type: LayerType,
  index: number,
): GeocodingProvenance {
  if (type !== 'poi') throw new ProjectFileError(`Layer ${index + 1} geocoding provenance is only valid for POI layers.`);
  const providerFeatureId = provenance.providerFeatureId;
  if (
    typeof providerFeatureId !== 'string'
    || providerFeatureId.trim() !== providerFeatureId
    || providerFeatureId.length === 0
    || [...providerFeatureId].length > 256
    || /[\p{Cc}\p{Cf}]/u.test(providerFeatureId)
  ) {
    throw new ProjectFileError(`Layer ${index + 1} provenance feature ID is invalid.`);
  }
  return { provider: 'mapbox', service: 'geocoding-v6', providerFeatureId };
}

function parseMapMatchingProvenance(
  provenance: JsonObject,
  type: LayerType,
  index: number,
): MapMatchingProvenance {
  if (type !== 'route') throw new ProjectFileError(`Layer ${index + 1} map-matching provenance is only valid for Route layers.`);
  const sourcePointCount = finiteNumber(provenance.sourcePointCount, `Layer ${index + 1} provenance source point count`);
  if (!Number.isSafeInteger(sourcePointCount) || sourcePointCount < 2 || sourcePointCount > 100) {
    throw new ProjectFileError(`Layer ${index + 1} provenance source point count must be a whole number from 2 to 100.`);
  }
  const confidence = provenance.confidence === undefined
    ? undefined
    : finiteNumber(provenance.confidence, `Layer ${index + 1} provenance confidence`);
  if (confidence !== undefined && (confidence < 0 || confidence > 1)) {
    throw new ProjectFileError(`Layer ${index + 1} provenance confidence must be between zero and one.`);
  }
  return {
    provider: 'mapbox', service: 'map-matching-v5', profile: profileAt(provenance.profile, index),
    sourcePointCount,
    ...(confidence !== undefined && { confidence }),
  };
}

export function parseLayerProvenance(
  value: unknown,
  type: LayerType,
  index: number,
  coordinateCount: { value: number },
): ProviderProvenance | undefined {
  if (value === undefined) return;
  const provenance = objectAt(value, `Layer ${index + 1} provenance`);
  if (provenance.provider !== 'mapbox') {
    throw new ProjectFileError(`Layer ${index + 1} provenance provider is not supported.`);
  }
  if (provenance.service === 'isochrone-v1') {
    return parseIsochroneProvenance(provenance, type, index, coordinateCount);
  }
  if (provenance.service === 'directions-v5') {
    return parseDirectionsProvenance(provenance, type, index, coordinateCount);
  }
  if (provenance.service === 'geocoding-v6') {
    return parseGeocodingProvenance(provenance, type, index);
  }
  if (provenance.service === 'map-matching-v5') {
    return parseMapMatchingProvenance(provenance, type, index);
  }
  throw new ProjectFileError(`Layer ${index + 1} provenance provider is not supported.`);
}
