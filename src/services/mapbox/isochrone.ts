import { parseLayerGeometry } from '../../domain/projectGeometry';
import { isValidPosition } from '../../domain/routeGeometry';
import type { IsochroneProvider, IsochroneRequest, ProviderTravelProfile } from './contracts';
import { MapboxProviderError } from './errors';
import { requestMapboxJson } from './request';

const ISOCHRONE_ENDPOINT = 'https://api.mapbox.com/isochrone/v1/mapbox';
const PROFILES = new Set<ProviderTravelProfile>(['driving', 'cycling', 'walking']);
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_POSITIONS = 50_000;

type MapboxIsochroneProviderOptions = {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  token: string | null | undefined;
};

type MapboxIsochronePayload = { type?: unknown; features?: unknown };
type MapboxIsochroneFeature = {
  type?: unknown;
  geometry?: unknown;
  properties?: { contour?: unknown };
};

function validateRequest(request: IsochroneRequest) {
  const center = request.center;
  if (!Array.isArray(center) || !isValidPosition(center[0], center[1])) {
    throw new MapboxProviderError('REQUEST_INVALID', 'Choose a valid travel-time center on the map.');
  }
  if (!PROFILES.has(request.profile)) {
    throw new MapboxProviderError('REQUEST_INVALID', 'Choose walking, cycling, or driving.');
  }
  if (!Number.isSafeInteger(request.minutes) || request.minutes < 5 || request.minutes > 60) {
    throw new MapboxProviderError('REQUEST_INVALID', 'Travel time must be a whole number from 5 to 60 minutes.');
  }
}

function requestUrl(request: IsochroneRequest) {
  const endpoint = `${ISOCHRONE_ENDPOINT}/${request.profile}/${request.center[0]},${request.center[1]}`;
  if (!URL.canParse(endpoint)) {
    throw new MapboxProviderError('REQUEST_INVALID', 'The travel-time request could not be created.');
  }
  const url = new URL(endpoint);
  url.searchParams.set('contours_minutes', String(request.minutes));
  url.searchParams.set('polygons', 'true');
  return url;
}

function boundedSignal(callerSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let didTimeout = false;
  const abortForCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortForCaller();
  else callerSignal?.addEventListener('abort', abortForCaller, { once: true });
  const timer = globalThis.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);
  return {
    cleanup: () => {
      globalThis.clearTimeout(timer);
      callerSignal?.removeEventListener('abort', abortForCaller);
    },
    didTimeout: () => didTimeout,
    signal: controller.signal,
  };
}

function failGeometry(message: string): never {
  throw new MapboxProviderError('RESPONSE_INVALID', `Mapbox returned invalid travel-time geometry: ${message}`);
}

function responseGeometry(payload: MapboxIsochronePayload, minutes: number) {
  if (payload.type !== 'FeatureCollection' || !Array.isArray(payload.features)) {
    throw new MapboxProviderError('RESPONSE_INVALID', 'Mapbox returned an invalid travel-time response.');
  }
  if (payload.features.length === 0) {
    throw new MapboxProviderError('ISOCHRONE_NOT_FOUND', 'No reachable area was found for that center and travel time.');
  }
  if (payload.features.length !== 1) {
    throw new MapboxProviderError('RESPONSE_INVALID', 'Mapbox returned an unexpected number of travel-time contours.');
  }
  const candidate = payload.features[0];
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    throw new MapboxProviderError('RESPONSE_INVALID', 'Mapbox returned an invalid travel-time feature.');
  }
  const feature = candidate as MapboxIsochroneFeature;
  if (feature.type !== 'Feature') {
    throw new MapboxProviderError('RESPONSE_INVALID', 'Mapbox returned an invalid travel-time feature.');
  }
  if (feature.properties?.contour !== minutes) {
    throw new MapboxProviderError('RESPONSE_INVALID', 'Mapbox returned a travel-time contour for the wrong duration.');
  }
  const geometry = parseLayerGeometry(
    feature.geometry,
    'Travel-time area',
    { value: 0 },
    { fail: failGeometry, maximumCoordinates: MAX_RESPONSE_POSITIONS },
  );
  if (geometry.type === 'Polygon') return geometry;
  return failGeometry('The result must be one Polygon.');
}

export function createMapboxIsochroneProvider(options: MapboxIsochroneProviderOptions): IsochroneProvider {
  return {
    async isochrone(request) {
      validateRequest(request);
      const control = boundedSignal(request.signal, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      try {
        const response = await requestMapboxJson<MapboxIsochronePayload>({
          endpoint: requestUrl(request),
          fetch: options.fetch,
          signal: control.signal,
          token: options.token,
        });
        return {
          geometry: responseGeometry(response.data, request.minutes),
          useBoundary: response.useBoundary,
        };
      } catch (error) {
        if (control.didTimeout()) {
          throw new MapboxProviderError('REQUEST_TIMEOUT', 'Mapbox took too long to create the travel-time area. Try again.');
        }
        throw error;
      } finally {
        control.cleanup();
      }
    },
  };
}
