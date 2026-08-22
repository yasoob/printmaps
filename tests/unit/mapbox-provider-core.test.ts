import {
  MapboxProviderError,
  PROVIDER_RESPONSE_USE_BOUNDARY,
  PROVIDER_RESPONSE_USE_REQUIRES_TERMS_REVIEW,
  requestMapboxJson,
  validatePublicBrowserToken,
} from '../../src/services/mapbox';
import type {
  DirectionsProvider,
  MapMatchingProvider,
  ProviderCoordinate,
  SearchProvider,
} from '../../src/services/mapbox';

describe('Mapbox public browser token validation', () => {
  it('accepts a public pk token without broadening its scope', () => {
    const token = 'pk.fake-public-segment.fake-signature';

    expect(validatePublicBrowserToken(token)).toBe(token);
  });

  it.each([
    'pk.',
    'pk.only-one-segment',
    'pk.segment.signature.extra',
    'pk.segment/with-symbols.signature',
    ' pk.public-segment.signature ',
  ])('rejects malformed public token %j', (token) => {
    expect(() => validatePublicBrowserToken(token)).toThrowError(
      expect.objectContaining<Partial<MapboxProviderError>>({
        code: 'TOKEN_INVALID',
        message: expect.stringContaining('three dot-separated segments'),
      }),
    );
  });

  it.each([
    [undefined, 'TOKEN_MISSING', 'Configure a public browser token'],
    ['', 'TOKEN_MISSING', 'Configure a public browser token'],
    ['sk.fake-secret-segment.fake-signature', 'TOKEN_SECRET', 'must never be used in a browser'],
    ['not-a-token', 'TOKEN_INVALID', 'must start with "pk."'],
  ] as const)('rejects unsafe token value %j with %s', (token, code, message) => {
    expect(() => validatePublicBrowserToken(token)).toThrowError(
      expect.objectContaining<Partial<MapboxProviderError>>({ code, message: expect.stringContaining(message) }),
    );
  });
});

describe('Mapbox request primitive', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    // eslint-disable-next-line unicorn/prefer-https -- Deliberate insecure endpoint rejection case.
    'http://api.mapbox.com/search/searchbox/v1/suggest?q=Vienna',
    'https://example.com/search?q=Vienna',
    'https://api.mapbox.com.evil.test/search?q=Vienna',
  ])('rejects unsafe endpoint %s before fetch or token attachment', async (endpoint) => {
    const token = 'pk.fake-public-segment.fake-signature';
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));

    const request = requestMapboxJson({ endpoint, fetch: fetcher, token });

    await expect(request).rejects.toEqual(expect.objectContaining<Partial<MapboxProviderError>>({
      code: 'ENDPOINT_INVALID',
      message: expect.stringContaining('HTTPS Mapbox API endpoint'),
    }));
    await expect(request).rejects.not.toHaveProperty('message', expect.stringContaining(token));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'HTTP_UNAUTHORIZED', 'Check the public token'],
    [403, 'HTTP_FORBIDDEN', 'Check token scopes and URL restrictions'],
    [422, 'HTTP_UNPROCESSABLE', 'Review the request coordinates and parameters'],
    [429, 'HTTP_RATE_LIMITED', 'Wait before retrying'],
  ] as const)('normalizes HTTP %i into actionable %s failures', async (status, code, action) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', {
      headers: status === 429 ? { 'Retry-After': '30' } : undefined,
      status,
    }));

    await expect(requestMapboxJson({
      endpoint: 'https://api.mapbox.com/search/searchbox/v1/suggest?q=Vienna',
      fetch: fetcher,
      token: 'pk.fake-public-segment.fake-signature',
    })).rejects.toEqual(expect.objectContaining<Partial<MapboxProviderError>>({
      code,
      message: expect.stringContaining(action),
      status,
      ...(status === 429 && { retryAfterSeconds: 30 }),
    }));
  });

  it('normalizes invalid successful payloads into a safe response failure', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('not json', { status: 200 }));

    await expect(requestMapboxJson({
      endpoint: 'https://api.mapbox.com/search/searchbox/v1/suggest?q=Vienna',
      fetch: fetcher,
      token: 'pk.fake-public-segment.fake-signature',
    })).rejects.toEqual(expect.objectContaining<Partial<MapboxProviderError>>({
      code: 'RESPONSE_INVALID',
      message: expect.stringContaining('valid JSON'),
    }));
  });

  it('normalizes other fetch failures without exposing implementation errors', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(requestMapboxJson({
      endpoint: 'https://api.mapbox.com/search/searchbox/v1/suggest?q=Vienna',
      fetch: fetcher,
      token: 'pk.fake-public-segment.fake-signature',
    })).rejects.toEqual(expect.objectContaining<Partial<MapboxProviderError>>({
      code: 'NETWORK_ERROR',
      message: expect.stringContaining('Check your connection'),
    }));
  });

  it('normalizes offline failures with a reconnect action', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(requestMapboxJson({
      endpoint: 'https://api.mapbox.com/search/searchbox/v1/suggest?q=Vienna',
      fetch: fetcher,
      token: 'pk.fake-public-segment.fake-signature',
    })).rejects.toEqual(expect.objectContaining<Partial<MapboxProviderError>>({
      code: 'NETWORK_OFFLINE',
      message: expect.stringContaining('Reconnect'),
    }));
  });

  it('stops before JSON parsing when cancellation lands as fetch resolves', async () => {
    const controller = new AbortController();
    const response = Response.json({ id: 'stale-place' });
    const json = vi.spyOn(response, 'json');
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      controller.abort();
      return response;
    });

    await expect(requestMapboxJson({
      endpoint: 'https://api.mapbox.com/search/searchbox/v1/suggest?q=Vienna',
      fetch: fetcher,
      signal: controller.signal,
      token: 'pk.fake-public-segment.fake-signature',
    })).rejects.toEqual(expect.objectContaining<Partial<MapboxProviderError>>({
      code: 'REQUEST_ABORTED',
      message: expect.stringContaining('cancelled'),
    }));
    expect(json).not.toHaveBeenCalled();
  });

  it('normalizes cancellation after response arrival before JSON completion', async () => {
    const controller = new AbortController();
    let resolveJson!: (value: { id: string }) => void;
    const jsonPromise = new Promise<{ id: string }>((resolve) => {
      resolveJson = resolve;
    });
    const response = new Response('{}', { status: 200 });
    const json = vi.spyOn(response, 'json').mockReturnValue(jsonPromise);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);

    const request = requestMapboxJson({
      endpoint: 'https://api.mapbox.com/search/searchbox/v1/suggest?q=Vienna',
      fetch: fetcher,
      signal: controller.signal,
      token: 'pk.fake-public-segment.fake-signature',
    });
    await vi.waitFor(() => {
      expect(json).toHaveBeenCalledOnce();
    });
    controller.abort();
    resolveJson({ id: 'stale-place' });

    await expect(request).rejects.toEqual(expect.objectContaining<Partial<MapboxProviderError>>({
      code: 'REQUEST_ABORTED',
      message: expect.stringContaining('cancelled'),
    }));
  });

  it('normalizes cancellation so debounced callers can ignore stale requests', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new DOMException('aborted', 'AbortError'));

    await expect(requestMapboxJson({
      endpoint: 'https://api.mapbox.com/directions/v5/mapbox/walking/0,0;1,1',
      fetch: fetcher,
      signal: controller.signal,
      token: 'pk.fake-public-segment.fake-signature',
    })).rejects.toEqual(expect.objectContaining<Partial<MapboxProviderError>>({
      code: 'REQUEST_ABORTED',
      message: expect.stringContaining('cancelled'),
    }));
  });

  it('passes an AbortSignal and validated public token to fetch for stale-request cancellation', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: 'place.1' }, {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }));

    const response = await requestMapboxJson<{ id: string }>({
      endpoint: 'https://api.mapbox.com/search/searchbox/v1/suggest?q=Vienna',
      fetch: fetcher,
      signal: controller.signal,
      token: 'pk.fake-public-segment.fake-signature',
    });

    const [requestedUrl, requestInit] = fetcher.mock.calls[0];
    expect(new URL(requestedUrl as string).searchParams.get('access_token'))
      .toBe('pk.fake-public-segment.fake-signature');
    expect(requestInit?.signal).toBe(controller.signal);
    expect(response).toEqual({
      data: { id: 'place.1' },
      useBoundary: PROVIDER_RESPONSE_USE_REQUIRES_TERMS_REVIEW,
    });
  });
});

describe('provider-neutral request contracts', () => {
  it('marks provider responses with an explicit terms and storage-use boundary', () => {
    expect(PROVIDER_RESPONSE_USE_REQUIRES_TERMS_REVIEW).toBe('provider-response-use-requires-terms-review');
    expect(PROVIDER_RESPONSE_USE_BOUNDARY).toEqual({
      attribution: 'follow-provider-attribution-requirements',
      storage: 'do-not-persist-without-provider-terms-review',
    });
  });

  it('keeps search, directions, and map matching as narrow independent capabilities', async () => {
    const point: ProviderCoordinate = [16.37, 48.21];
    const search: SearchProvider = {
      search: async ({ query }) => ({
        useBoundary: PROVIDER_RESPONSE_USE_REQUIRES_TERMS_REVIEW,
        results: [{ providerFeatureId: 'place.1', label: query, center: point }],
      }),
    };
    const directions: DirectionsProvider = {
      directions: async ({ waypoints }) => ({
        useBoundary: PROVIDER_RESPONSE_USE_REQUIRES_TERMS_REVIEW,
        routes: [{ geometry: waypoints, distanceMeters: 10, durationSeconds: 5 }],
      }),
    };
    const matching: MapMatchingProvider = {
      match: async ({ trace }) => ({
        useBoundary: PROVIDER_RESPONSE_USE_REQUIRES_TERMS_REVIEW,
        matches: [{ geometry: trace, confidence: 0.9 }],
      }),
    };

    await expect(search.search({ query: 'Vienna' })).resolves.toEqual(expect.objectContaining({
      results: [expect.objectContaining({ label: 'Vienna' })],
    }));
    await expect(directions.directions({ waypoints: [point, point], profile: 'walking' }))
      .resolves.toEqual(expect.objectContaining({ routes: [expect.any(Object)] }));
    await expect(matching.match({ trace: [point, point], profile: 'walking' }))
      .resolves.toEqual(expect.objectContaining({ matches: [expect.any(Object)] }));
  });
});
