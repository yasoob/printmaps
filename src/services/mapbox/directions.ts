import { parseLayerGeometry } from '../../domain/projectGeometry';
import { isValidPosition } from '../../domain/routeGeometry';
import type { DirectionsProvider, DirectionsRequest, ProviderRoute, ProviderTravelProfile } from './contracts';
import { MapboxProviderError } from './errors';
import { requestMapboxJson } from './request';

const DIRECTIONS_ENDPOINT = 'https://api.mapbox.com/directions/v5/mapbox';
const PROFILES = new Set<ProviderTravelProfile>(['driving', 'cycling', 'walking']);
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_WAYPOINTS = 25;
const MAX_RESPONSE_POSITIONS = 50_000;

type MapboxDirectionsProviderOptions = {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  token: string | null | undefined;
};

type MapboxDirectionsPayload = { code?: unknown; routes?: unknown };
type MapboxRoute = { distance?: unknown; duration?: unknown; geometry?: unknown };

function failResponse(message: string): never {
  throw new MapboxProviderError('RESPONSE_INVALID', `Mapbox returned an invalid directions response: ${message}`);
}

function validateRequest(request: DirectionsRequest) {
  if (!Array.isArray(request.waypoints)
    || request.waypoints.length < 2
    || request.waypoints.length > MAX_WAYPOINTS) {
    throw new MapboxProviderError('REQUEST_INVALID', `Choose between 2 and ${MAX_WAYPOINTS} route points.`);
  }
  if (!PROFILES.has(request.profile)
    || [...request.waypoints].some((position) => !Array.isArray(position)
      || position.length !== 2
      || typeof position[0] !== 'number'
      || typeof position[1] !== 'number'
      || !isValidPosition(position[0], position[1]))) {
    throw new MapboxProviderError('REQUEST_INVALID', 'Choose valid route points and a supported travel mode.');
  }
  const waypointKeys = request.waypoints.map(
    ([longitude, latitude]) => `${longitude},${latitude}`,
  );
  const isCanonicalLoop = waypointKeys.length >= 4
    && waypointKeys[0] === waypointKeys.at(-1)
    && new Set(waypointKeys.slice(0, -1)).size === waypointKeys.length - 1;
  if (!isCanonicalLoop && new Set(waypointKeys).size !== waypointKeys.length) {
    throw new MapboxProviderError('REQUEST_INVALID', 'Choose distinct route points.');
  }
}

function requestUrl(request: DirectionsRequest) {
  const coordinates = request.waypoints.map((position) => `${position[0]},${position[1]}`).join(';');
  const endpoint = `${DIRECTIONS_ENDPOINT}/${request.profile}/${coordinates}`;
  if (!URL.canParse(endpoint)) {
    throw new MapboxProviderError('REQUEST_INVALID', 'The road-route request could not be created.');
  }
  const url = new URL(endpoint);
  url.searchParams.set('alternatives', 'false');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('steps', 'false');
  return url;
}

function responseRoute(value: unknown): ProviderRoute {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) failResponse('The route is missing.');
  const candidate = value as MapboxRoute;
  if (typeof candidate.distance !== 'number' || !Number.isFinite(candidate.distance) || candidate.distance < 0) {
    failResponse('Route distance must be a non-negative finite number.');
  }
  if (typeof candidate.duration !== 'number' || !Number.isFinite(candidate.duration) || candidate.duration < 0) {
    failResponse('Route duration must be a non-negative finite number.');
  }
  const geometry = parseLayerGeometry(candidate.geometry, 'Directions route', { value: 0 }, {
    fail: failResponse,
    maximumCoordinates: MAX_RESPONSE_POSITIONS,
  });
  if (geometry.type !== 'LineString') failResponse('Route geometry must be one LineString.');
  return {
    geometry: geometry.coordinates,
    distanceMeters: candidate.distance,
    durationSeconds: candidate.duration,
  };
}

function responseRoutes(payload: unknown) {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    failResponse('Expected one successful route.');
  }
  const candidate = payload as MapboxDirectionsPayload;
  if (candidate.code !== 'Ok' || !Array.isArray(candidate.routes) || candidate.routes.length !== 1) {
    failResponse('Expected one successful route.');
  }
  return [responseRoute(candidate.routes[0])];
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

export function createMapboxDirectionsProvider(options: MapboxDirectionsProviderOptions): DirectionsProvider {
  return {
    async directions(request) {
      validateRequest(request);
      const control = boundedSignal(request.signal, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      try {
        const response = await requestMapboxJson<MapboxDirectionsPayload>({
          endpoint: requestUrl(request),
          fetch: options.fetch,
          signal: control.signal,
          token: options.token,
        });
        return { routes: responseRoutes(response.data), useBoundary: response.useBoundary };
      } catch (error) {
        if (control.didTimeout()) {
          throw new MapboxProviderError('REQUEST_TIMEOUT', 'Mapbox took too long to create the road route. Try again.');
        }
        throw error;
      } finally {
        control.cleanup();
      }
    },
  };
}
