import { describe, expect, it, vi } from 'vitest';
import { MapboxProviderError } from '../../src/services/mapbox/errors';
import { createMapboxIsochroneProvider } from '../../src/services/mapbox/isochrone';

const token = 'pk.fake-public-segment.fake-signature';
const ring = [[16.35, 48.2], [16.4, 48.2], [16.4, 48.24], [16.35, 48.2]];

function response(features: unknown[]) {
  return Response.json({ type: 'FeatureCollection', features });
}

const polygonFeature = {
  type: 'Feature',
  properties: { contour: 15 },
  geometry: { type: 'Polygon', coordinates: [ring] },
};

describe('Mapbox Isochrone provider', () => {
  it('requests one bounded polygon contour and returns detached canonical geometry', async () => {
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/isochrone/v1/mapbox/walking/16.3725,48.2084');
      expect(url.searchParams.get('contours_minutes')).toBe('15');
      expect(url.searchParams.get('polygons')).toBe('true');
      expect(url.searchParams.get('access_token')).toBe(token);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return response([polygonFeature]);
    });
    const provider = createMapboxIsochroneProvider({ fetch, token });

    const result = await provider.isochrone({ center: [16.3725, 48.2084], minutes: 15, profile: 'walking' });

    expect(result.geometry).toEqual({ type: 'Polygon', coordinates: [ring] });
    expect(result.geometry.coordinates).not.toBe(polygonFeature.geometry.coordinates);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([5, 60])('accepts the %i-minute provider boundary', async (minutes) => {
    const feature = { ...polygonFeature, properties: { contour: minutes } };
    const provider = createMapboxIsochroneProvider({ fetch: vi.fn(async () => response([feature])), token });

    await expect(provider.isochrone({ center: [16, 48], minutes, profile: 'driving' }))
      .resolves.toMatchObject({ geometry: { type: 'Polygon' } });
  });

  it.each([
    ['minutes below the provider boundary', { center: [16, 48], minutes: 4, profile: 'walking' }],
    ['minutes above the provider boundary', { center: [16, 48], minutes: 61, profile: 'walking' }],
    ['fractional minutes', { center: [16, 48], minutes: 12.5, profile: 'walking' }],
    ['an invalid center', { center: [181, 48], minutes: 15, profile: 'walking' }],
    ['an unsupported profile', { center: [16, 48], minutes: 15, profile: 'flying' }],
  ])('rejects %s before making a request', async (_label, request) => {
    const fetch = vi.fn();
    const provider = createMapboxIsochroneProvider({ fetch, token });

    await expect(provider.isochrone(request as never)).rejects.toMatchObject({ code: 'REQUEST_INVALID' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty feature collection', [], 'ISOCHRONE_NOT_FOUND'],
    ['a line response', [{ ...polygonFeature, geometry: { type: 'LineString', coordinates: ring } }], 'RESPONSE_INVALID'],
    ['an open polygon ring', [{ ...polygonFeature, geometry: { type: 'Polygon', coordinates: [[...ring.slice(0, -1), [16.36, 48.21]]] } }], 'RESPONSE_INVALID'],
    ['an out-of-range coordinate', [{ ...polygonFeature, geometry: { type: 'Polygon', coordinates: [[[181, 48], [16.4, 48.2], [16.4, 48.24], [181, 48]]] } }], 'RESPONSE_INVALID'],
  ])('rejects %s', async (_label, features, code) => {
    const provider = createMapboxIsochroneProvider({ fetch: vi.fn(async () => response(features)), token });

    await expect(provider.isochrone({ center: [16, 48], minutes: 15, profile: 'walking' }))
      .rejects.toMatchObject({ code });
  });

  it('rejects a non-FeatureCollection response even when it contains plausible features', async () => {
    const fetch = vi.fn(async () => Response.json({ type: 'Feature', features: [polygonFeature] }));
    const provider = createMapboxIsochroneProvider({ fetch, token });

    await expect(provider.isochrone({ center: [16, 48], minutes: 15, profile: 'walking' }))
      .rejects.toMatchObject({ code: 'RESPONSE_INVALID' });
  });

  it('rejects a non-Feature contour even when its geometry is plausible', async () => {
    const provider = createMapboxIsochroneProvider({
      fetch: vi.fn(async () => response([{ ...polygonFeature, type: 'NotAFeature' }])),
      token,
    });

    await expect(provider.isochrone({ center: [16, 48], minutes: 15, profile: 'walking' }))
      .rejects.toMatchObject({ code: 'RESPONSE_INVALID' });
  });

  it('preserves caller cancellation instead of reporting a timeout', async () => {
    const controller = new AbortController();
    const fetch = vi.fn((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const provider = createMapboxIsochroneProvider({ fetch, timeoutMs: 25, token });
    const request = provider.isochrone({
      center: [16, 48], minutes: 15, profile: 'walking', signal: controller.signal,
    });
    const cancellationExpectation = expect(request).rejects.toEqual(
      expect.objectContaining<Partial<MapboxProviderError>>({ code: 'REQUEST_ABORTED' }),
    );

    controller.abort();

    await cancellationExpectation;
  });

  it('reports a bounded provider timeout', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const provider = createMapboxIsochroneProvider({ fetch, timeoutMs: 25, token });
    const request = provider.isochrone({ center: [16, 48], minutes: 15, profile: 'cycling' });
    const timeoutExpectation = expect(request).rejects.toEqual(
      expect.objectContaining<Partial<MapboxProviderError>>({ code: 'REQUEST_TIMEOUT' }),
    );
    await vi.advanceTimersByTimeAsync(25);

    await timeoutExpectation;
    vi.useRealTimers();
  });
});
