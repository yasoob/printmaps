import { createMapboxHttpError, MapboxProviderError } from './errors';
import { PROVIDER_RESPONSE_USE_REQUIRES_TERMS_REVIEW } from './terms';
import type { ProviderBoundResponse } from './terms';
import { validatePublicBrowserToken } from './token';

const MAX_JSON_RESPONSE_BYTES = 1_000_000;

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

async function readBoundedJson<T>(response: Response, signal?: AbortSignal): Promise<T> {
  if (!response.body) return response.json() as Promise<T>;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    throwIfRequestAborted(signal);
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_JSON_RESPONSE_BYTES) {
      await reader.cancel();
      throw new MapboxProviderError(
        'RESPONSE_INVALID',
        'Mapbox returned a response that was too large to process safely.',
        { status: response.status },
      );
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

async function fetchMapboxResponse(
  fetchImplementation: typeof globalThis.fetch,
  url: URL,
  signal?: AbortSignal,
): Promise<Response> {
  try {
    return await fetchImplementation(url.href, { signal });
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
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
}

async function parseMapboxResponse<T>(response: Response, signal?: AbortSignal): Promise<T> {
  const declaredLength = Number(response.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new MapboxProviderError(
      'RESPONSE_INVALID',
      'Mapbox returned a response that was too large to process safely.',
      { status: response.status },
    );
  }
  try {
    return await readBoundedJson<T>(response, signal);
  } catch (error) {
    throwIfRequestAborted(signal, error);
    if (error instanceof MapboxProviderError) throw error;
    throw new MapboxProviderError(
      'RESPONSE_INVALID',
      'Mapbox returned a response that was not valid JSON. Try the request again.',
      { cause: error, status: response.status },
    );
  }
}

export async function requestMapboxJson<T>(options: MapboxRequestOptions): Promise<MapboxJsonResponse<T>> {
  const url = validateMapboxApiEndpoint(options.endpoint);
  const token = validatePublicBrowserToken(options.token);
  url.searchParams.set('access_token', token);
  const fetchResponse = await fetchMapboxResponse(options.fetch ?? globalThis.fetch, url, options.signal);
  throwIfRequestAborted(options.signal);
  if (!fetchResponse.ok) {
    throw createMapboxHttpError(fetchResponse);
  }
  const data = await parseMapboxResponse<T>(fetchResponse, options.signal);
  throwIfRequestAborted(options.signal);
  return { data, useBoundary: PROVIDER_RESPONSE_USE_REQUIRES_TERMS_REVIEW };
}
