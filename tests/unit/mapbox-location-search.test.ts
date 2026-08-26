// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { MapboxProviderError } from '../../src/services/mapbox/errors';
import { createMapboxSearchProvider } from '../../src/services/mapbox/search';

const TOKEN = 'pk.public-browser.token';
const validFeature = {
  id: 'place.1',
  geometry: { type: 'Point', coordinates: [16.3725, 48.2084] },
  properties: { name: 'Vienna', place_formatted: 'Austria' },
};

describe('Mapbox location search provider', () => {
  it('sends a bounded forward-geocoding request and maps valid places', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return Response.json({ type: 'FeatureCollection', features: [validFeature] });
    });
    const provider = createMapboxSearchProvider({ fetch: fetch as typeof globalThis.fetch, token: TOKEN });

    const response = await provider.search({ query: ' Vienna ', limit: 99, proximity: [16.3, 48.2] });

    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe('https://api.mapbox.com/search/geocode/v6/forward');
    expect(url.searchParams.get('q')).toBe('Vienna');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('proximity')).toBe('16.3,48.2');
    expect(url.searchParams.get('access_token')).toBe(TOKEN);
    expect(response.results).toEqual([
      { providerFeatureId: 'place.1', label: 'Vienna, Austria', center: [16.3725, 48.2084] },
    ]);
  });

  it('does not call the provider for an empty query', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const provider = createMapboxSearchProvider({ fetch: fetch as typeof globalThis.fetch, token: TOKEN });
    await expect(provider.search({ query: ' '.repeat(3) })).resolves.toMatchObject({ results: [] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves a valid empty FeatureCollection as an empty result', async () => {
    const provider = createMapboxSearchProvider({
      fetch: vi.fn(async () => Response.json({ type: 'FeatureCollection', features: [] })),
      token: TOKEN,
    });

    await expect(provider.search({ query: 'Vienna' })).resolves.toMatchObject({ results: [] });
  });

  it.each([
    ['a null envelope', null],
    ['a non-FeatureCollection envelope', { type: 'Feature', features: [] }],
    ['a missing features array', { type: 'FeatureCollection' }],
    ['a malformed feature', { type: 'FeatureCollection', features: [{ ...validFeature, type: 'Feature', geometry: null }] }],
  ])('rejects %s as RESPONSE_INVALID', async (_label, payload) => {
    const provider = createMapboxSearchProvider({
      fetch: vi.fn(async () => Response.json(payload)),
      token: TOKEN,
    });

    await expect(provider.search({ query: 'Vienna' })).rejects.toMatchObject({ code: 'RESPONSE_INVALID' });
  });

  it('rejects excessive feature work before processing provider entries', async () => {
    const features: unknown[] = Array.from({ length: 101 }, () => ({ ...validFeature }));
    features[0] = { ...validFeature, id: null };
    const provider = createMapboxSearchProvider({
      fetch: vi.fn(async () => Response.json({
        type: 'FeatureCollection',
        features,
      })),
      token: TOKEN,
    });

    await expect(provider.search({ query: 'Vienna' })).rejects.toMatchObject({
      code: 'RESPONSE_INVALID',
      message: 'Mapbox returned too many place-search features.',
    });
  });

  it.each([
    ['provider ID', { ...validFeature, id: 'i'.repeat(257) }],
    ['label', { ...validFeature, properties: { full_address: 'l'.repeat(241) } }],
  ])('rejects an oversized %s', async (_label, feature) => {
    const provider = createMapboxSearchProvider({
      fetch: vi.fn(async () => Response.json({ type: 'FeatureCollection', features: [feature] })),
      token: TOKEN,
    });

    await expect(provider.search({ query: 'Vienna' })).rejects.toMatchObject({ code: 'RESPONSE_INVALID' });
  });

  it('reports a bounded provider timeout', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const provider = createMapboxSearchProvider({ fetch, timeoutMs: 25, token: TOKEN });
    const request = provider.search({ query: 'Vienna' });
    const expectation = expect(request).rejects.toEqual(
      expect.objectContaining<Partial<MapboxProviderError>>({ code: 'REQUEST_TIMEOUT' }),
    );

    await vi.advanceTimersByTimeAsync(25);
    await expectation;
    vi.useRealTimers();
  });

  it('preserves caller cancellation instead of reporting a timeout', async () => {
    const controller = new AbortController();
    const fetch = vi.fn((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const provider = createMapboxSearchProvider({ fetch, timeoutMs: 25, token: TOKEN });
    const request = provider.search({ query: 'Vienna', signal: controller.signal });
    const expectation = expect(request).rejects.toEqual(
      expect.objectContaining<Partial<MapboxProviderError>>({ code: 'REQUEST_ABORTED' }),
    );

    controller.abort();
    await expectation;
  });
});
