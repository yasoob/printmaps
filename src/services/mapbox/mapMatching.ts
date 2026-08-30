import { parseLayerGeometry } from '../../domain/projectGeometry';
import { isValidPosition } from '../../domain/routeGeometry';
import type { MapMatchingProvider, MapMatchingRequest, ProviderMatch, ProviderTravelProfile } from './contracts';
import { MapboxProviderError } from './errors';
import { requestMapboxJson } from './request';

const MAP_MATCHING_ENDPOINT = 'https://api.mapbox.com/matching/v5/mapbox';
const PROFILES = new Set<ProviderTravelProfile>(['driving', 'cycling', 'walking']);
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TRACE_POSITIONS = 100;
const MAX_RESPONSE_POSITIONS = 50_000;
const DRAWN_POINT_SNAP_RADIUS_METERS = 50;

type MapboxMapMatchingProviderOptions = {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  token: string | null | undefined;
};

type MapboxMapMatchingPayload = { code?: unknown; matchings?: unknown; tracepoints?: unknown };
type MapboxMatching = { confidence?: unknown; geometry?: unknown };
type MapboxTracepoint = { matchings_index?: unknown; waypoint_index?: unknown };

function failResponse(message: string): never {
  throw new MapboxProviderError('RESPONSE_INVALID', `Mapbox returned an invalid map-matching response: ${message}`);
}

function validateRequest(request: MapMatchingRequest): void {
  if (!Array.isArray(request.trace)
    || request.trace.length < 2
    || request.trace.length > MAX_TRACE_POSITIONS) {
    throw new MapboxProviderError('REQUEST_INVALID', `Choose between 2 and ${MAX_TRACE_POSITIONS} route points.`);
  }
  if (!PROFILES.has(request.profile)
    || request.trace.some((position) => !Array.isArray(position)
      || position.length !== 2
      || typeof position[0] !== 'number'
      || typeof position[1] !== 'number'
      || !isValidPosition(position[0], position[1]))) {
    throw new MapboxProviderError('REQUEST_INVALID', 'Choose valid route points and a supported travel mode.');
  }
  if (new Set(request.trace.map(([longitude, latitude]) => `${longitude},${latitude}`)).size < 2) {
    throw new MapboxProviderError('REQUEST_INVALID', 'Choose at least two distinct route points.');
  }
}

function requestUrl(request: MapMatchingRequest): URL {
  const coordinates = request.trace.map(([longitude, latitude]) => `${longitude},${latitude}`).join(';');
  const endpoint = `${MAP_MATCHING_ENDPOINT}/${request.profile}/${coordinates}`;
  if (!URL.canParse(endpoint)) throw new MapboxProviderError('REQUEST_INVALID', 'The map-matching request could not be created.');
  const url = new URL(endpoint);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('steps', 'false');
  url.searchParams.set(
    'radiuses',
    request.trace.map(() => String(DRAWN_POINT_SNAP_RADIUS_METERS)).join(';'),
  );
  return url;
}

function responseMatch(value: unknown): ProviderMatch {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) failResponse('The matching is missing.');
  const candidate = value as MapboxMatching;
  if (candidate.confidence !== undefined
    && (typeof candidate.confidence !== 'number'
      || !Number.isFinite(candidate.confidence)
      || candidate.confidence < 0
      || candidate.confidence > 1)) {
    failResponse('Matching confidence must be between zero and one.');
  }
  const geometry = parseLayerGeometry(candidate.geometry, 'Map-matched route', { value: 0 }, {
    fail: failResponse,
    maximumCoordinates: MAX_RESPONSE_POSITIONS,
  });
  if (geometry.type !== 'LineString') failResponse('Matching geometry must be one LineString.');
  return {
    geometry: geometry.coordinates,
    ...(candidate.confidence !== undefined && { confidence: candidate.confidence as number }),
  };
}

function validateTracepoints(value: unknown, sourcePointCount: number): void {
  if (!Array.isArray(value) || value.length !== sourcePointCount) {
    failResponse('Expected one matched tracepoint for every route point.');
  }
  for (const [index, item] of value.entries()) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      failResponse(`Route point ${index + 1} was not matched to a road.`);
    }
    const tracepoint = item as MapboxTracepoint;
    if (tracepoint.matchings_index !== 0 || tracepoint.waypoint_index !== index) {
      failResponse(`Route point ${index + 1} was matched out of order.`);
    }
  }
}

function responseMatches(payload: unknown, sourcePointCount: number): readonly ProviderMatch[] {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) failResponse('Expected one successful matching.');
  const candidate = payload as MapboxMapMatchingPayload;
  if (candidate.code !== 'Ok' || !Array.isArray(candidate.matchings) || candidate.matchings.length !== 1) {
    failResponse('Expected one successful matching.');
  }
  validateTracepoints(candidate.tracepoints, sourcePointCount);
  return [responseMatch(candidate.matchings[0])];
}

function boundedSignal(callerSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let abortSource: 'caller' | 'timeout' | undefined;
  const abortForCaller = () => {
    abortSource ??= 'caller';
    controller.abort(callerSignal?.reason);
  };
  if (callerSignal?.aborted) abortForCaller();
  else callerSignal?.addEventListener('abort', abortForCaller, { once: true });
  const timer = globalThis.setTimeout(() => {
    abortSource ??= 'timeout';
    controller.abort();
  }, timeoutMs);
  return {
    cleanup: () => {
      globalThis.clearTimeout(timer);
      callerSignal?.removeEventListener('abort', abortForCaller);
    },
    didTimeout: () => abortSource === 'timeout',
    signal: controller.signal,
  };
}

export function createMapboxMapMatchingProvider(options: MapboxMapMatchingProviderOptions): MapMatchingProvider {
  return {
    async match(request) {
      validateRequest(request);
      const control = boundedSignal(request.signal, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      try {
        const response = await requestMapboxJson<MapboxMapMatchingPayload>({
          endpoint: requestUrl(request),
          fetch: options.fetch,
          signal: control.signal,
          token: options.token,
        });
        return {
          matches: responseMatches(response.data, request.trace.length),
          useBoundary: response.useBoundary,
        };
      } catch (error) {
        if (control.didTimeout()) {
          throw new MapboxProviderError('REQUEST_TIMEOUT', 'Mapbox took too long to match the route to roads. Try again.');
        }
        throw error;
      } finally {
        control.cleanup();
      }
    },
  };
}
