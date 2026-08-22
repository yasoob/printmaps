import { createMapboxHttpError, MapboxProviderError } from './errors';
import { PROVIDER_RESPONSE_USE_REQUIRES_TERMS_REVIEW } from './terms';
import type { ProviderBoundResponse } from './terms';
import { validatePublicBrowserToken } from './token';

export interface MapboxRequestOptions {
  readonly endpoint: string | URL;
  readonly fetch?: typeof globalThis.fetch;
  readonly signal?: AbortSignal;
  readonly token: string | null | undefined;
}

export interface MapboxJsonResponse<T> extends ProviderBoundResponse {
  readonly data: T;
}

function throwIfRequestAborted(signal?: AbortSignal, cause?: unknown): void {
  if (!signal?.aborted) return;
  throw new MapboxProviderError(
    'REQUEST_ABORTED',
    'The provider request was cancelled because it became stale.',
    { cause },
  );
}

function validateMapboxApiEndpoint(endpoint: string | URL): URL {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch (error) {
    throw new MapboxProviderError(
      'ENDPOINT_INVALID',
      'Use an HTTPS Mapbox API endpoint on api.mapbox.com.',
      { cause: error },
    );
  }
  if (url.origin !== 'https://api.mapbox.com' || url.username || url.password) {
    throw new MapboxProviderError(
      'ENDPOINT_INVALID',
      'Use an HTTPS Mapbox API endpoint on api.mapbox.com.',
    );
  }
  return url;
}

export async function requestMapboxJson<T>(options: MapboxRequestOptions): Promise<MapboxJsonResponse<T>> {
  const url = validateMapboxApiEndpoint(options.endpoint);
  const token = validatePublicBrowserToken(options.token);
  url.searchParams.set('access_token', token);
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  let fetchResponse: Response;
  try {
    fetchResponse = await fetchImplementation(url.href, { signal: options.signal });
  } catch (error) {
    if (options.signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      throw new MapboxProviderError(
        'REQUEST_ABORTED',
        'The provider request was cancelled because it became stale.',
        { cause: error },
      );
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new MapboxProviderError(
        'NETWORK_OFFLINE',
        'The provider cannot be reached while offline. Reconnect and try again.',
        { cause: error },
      );
    }
    throw new MapboxProviderError(
      'NETWORK_ERROR',
      'The provider could not be reached. Check your connection and try again.',
      { cause: error },
    );
  }
  throwIfRequestAborted(options.signal);
  if (!fetchResponse.ok) {
    throw createMapboxHttpError(fetchResponse);
  }
  let data: T;
  try {
    data = await fetchResponse.json() as T;
  } catch (error) {
    throwIfRequestAborted(options.signal, error);
    throw new MapboxProviderError(
      'RESPONSE_INVALID',
      'Mapbox returned a response that was not valid JSON. Try the request again.',
      { cause: error, status: fetchResponse.status },
    );
  }
  throwIfRequestAborted(options.signal);
  return { data, useBoundary: PROVIDER_RESPONSE_USE_REQUIRES_TERMS_REVIEW };
}
