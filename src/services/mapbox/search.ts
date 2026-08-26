import { isValidPosition } from '../../domain/routeGeometry';
import type { SearchProvider, SearchRequest, SearchResult } from './contracts';
import { MapboxProviderError } from './errors';
import { requestMapboxJson } from './request';

const FORWARD_GEOCODING_ENDPOINT = 'https://api.mapbox.com/search/geocode/v6/forward';
const MAX_RESULTS = 5;
const MAX_QUERY_LENGTH = 160;
const MAX_RESPONSE_FEATURES = 100;
const MAX_PROVIDER_ID_CHARACTERS = 256;
const MAX_LABEL_CHARACTERS = 240;
const DEFAULT_TIMEOUT_MS = 15_000;

type MapboxFeature = {
  id?: unknown;
  geometry?: { type?: unknown; coordinates?: unknown };
  properties?: { name?: unknown; full_address?: unknown; place_formatted?: unknown };
};

type MapboxSearchPayload = { type?: unknown; features?: unknown };

function responseFeatures(payload: unknown): unknown[] {
  if (
    typeof payload !== 'object'
    || payload === null
    || Array.isArray(payload)
    || (payload as MapboxSearchPayload).type !== 'FeatureCollection'
    || !Array.isArray((payload as MapboxSearchPayload).features)
  ) {
    throw new MapboxProviderError('RESPONSE_INVALID', 'Mapbox returned an invalid place-search response.');
  }
  const features = (payload as MapboxSearchPayload).features as unknown[];
  if (features.length > MAX_RESPONSE_FEATURES) {
    throw new MapboxProviderError('RESPONSE_INVALID', 'Mapbox returned too many place-search features.');
  }
  return features;
}

type MapboxSearchProviderOptions = {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  token: string | null | undefined;
};

function boundedText(value: unknown, maximumCharacters: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && [...text].length <= maximumCharacters ? text : null;
}

function pointCoordinates(feature: MapboxFeature): [number, number] | null {
  const coordinates = feature.geometry?.coordinates;
  if (
    feature.geometry?.type !== 'Point'
    || !Array.isArray(coordinates)
    || coordinates.length < 2
    || !isValidPosition(coordinates[0], coordinates[1])
  ) return null;
  return [coordinates[0], coordinates[1]];
}

function featureLabel(feature: MapboxFeature): string | null {
  const { full_address: fullAddress, name, place_formatted: placeFormatted } = feature.properties ?? {};
  const label = boundedText(fullAddress, MAX_LABEL_CHARACTERS)
    ?? [name, placeFormatted].filter((part) => typeof part === 'string' && part.trim()).join(', ');
  return boundedText(label, MAX_LABEL_CHARACTERS);
}

function resultForFeature(feature: MapboxFeature): SearchResult | null {
  const id = boundedText(feature.id, MAX_PROVIDER_ID_CHARACTERS);
  const center = pointCoordinates(feature);
  const label = featureLabel(feature);
  if (!id || !center || !label) return null;
  return {
    providerFeatureId: id,
    label,
    center,
  };
}

function requiredResultForFeature(feature: unknown): SearchResult {
  const result = typeof feature === 'object' && feature !== null && !Array.isArray(feature)
    ? resultForFeature(feature as MapboxFeature)
    : null;
  if (!result) {
    throw new MapboxProviderError('RESPONSE_INVALID', 'Mapbox returned an invalid place-search feature.');
  }
  return result;
}

function searchUrl(request: SearchRequest): URL {
  const url = new URL(FORWARD_GEOCODING_ENDPOINT);
  url.searchParams.set('q', request.query.trim().slice(0, MAX_QUERY_LENGTH));
  const boundedLimit = Math.min(MAX_RESULTS, Math.max(1, request.limit ?? MAX_RESULTS));
  url.searchParams.set('limit', String(boundedLimit));
  url.searchParams.set('autocomplete', request.autocomplete === false ? 'false' : 'true');
  url.searchParams.set('types', 'address,street,place,locality,neighborhood,postcode');
  if (request.proximity && isValidPosition(request.proximity[0], request.proximity[1])) {
    url.searchParams.set('proximity', request.proximity.join(','));
  }
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

export function createMapboxSearchProvider(options: MapboxSearchProviderOptions): SearchProvider {
  return {
    async search(request) {
      if (!request.query.trim()) {
        return { results: [], useBoundary: 'provider-response-use-requires-terms-review' };
      }
      const control = boundedSignal(request.signal, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      try {
        const response = await requestMapboxJson<MapboxSearchPayload>({
          endpoint: searchUrl(request),
          fetch: options.fetch,
          signal: control.signal,
          token: options.token,
        });
        const features = responseFeatures(response.data);
        return {
          results: features.map((feature) => requiredResultForFeature(feature)),
          useBoundary: response.useBoundary,
        };
      } catch (error) {
        if (control.didTimeout()) {
          throw new MapboxProviderError('REQUEST_TIMEOUT', 'Mapbox place search took too long. Try again.');
        }
        throw error;
      } finally {
        control.cleanup();
      }
    },
  };
}
