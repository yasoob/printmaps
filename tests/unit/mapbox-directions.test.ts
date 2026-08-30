// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createMapboxDirectionsProvider } from '../../src/services/mapbox/directions';

const TOKEN = 'pk.public-browser.token';
const coordinates = [[16.35, 48.2], [16.38, 48.21], [16.4, 48.22]];

describe('Mapbox Directions provider', () => {
  it('requests one bounded road route and returns detached canonical geometry', async () => {
    const route = {
      geometry: { type: 'LineString', coordinates },
      distance: 4250.5,
      duration: 935.2,
    };
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/directions/v5/mapbox/cycling/16.35,48.2;16.4,48.22');
      expect(url.searchParams.get('alternatives')).toBe('false');
      expect(url.searchParams.get('geometries')).toBe('geojson');
      expect(url.searchParams.get('overview')).toBe('full');
      expect(url.searchParams.get('steps')).toBe('false');
      expect(url.searchParams.get('access_token')).toBe(TOKEN);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Response.json({ code: 'Ok', routes: [route], waypoints: [] });
    });
    const provider = createMapboxDirectionsProvider({ fetch: fetch as typeof globalThis.fetch, token: TOKEN });

    const response = await provider.directions({
      waypoints: [[16.35, 48.2], [16.4, 48.22]],
      profile: 'cycling',
    });

    expect(response.routes).toEqual([{
      geometry: coordinates,
      distanceMeters: 4250.5,
      durationSeconds: 935.2,
    }]);
    expect(response.routes[0].geometry).not.toBe(route.geometry.coordinates);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('maps non-object response envelopes to RESPONSE_INVALID', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const provider = createMapboxDirectionsProvider({ fetch, token: TOKEN });

    for (const payload of [null, 'not-an-object']) {
      fetch.mockResolvedValueOnce(Response.json(payload));
      await expect(provider.directions({
        waypoints: [[16.35, 48.2], [16.4, 48.22]],
        profile: 'walking',
      })).rejects.toMatchObject({ code: 'RESPONSE_INVALID' });
    }
  });

  it('preserves caller cancellation when the timeout fires later', async () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    let rejectFetch!: (error: unknown) => void;
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(() => new Promise<Response>((_, reject) => {
      rejectFetch = reject;
    }));
    const provider = createMapboxDirectionsProvider({ fetch, timeoutMs: 10, token: TOKEN });

    const pending = provider.directions({
      waypoints: [[16.35, 48.2], [16.4, 48.22]],
      profile: 'walking',
      signal: caller.signal,
    });
    caller.abort();
    await vi.advanceTimersByTimeAsync(10);
    rejectFetch(new DOMException('aborted', 'AbortError'));

    await expect(pending).rejects.toMatchObject({ code: 'REQUEST_ABORTED' });
    vi.useRealTimers();
  });

  it('rejects every malformed runtime directions request before fetch', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const provider = createMapboxDirectionsProvider({ fetch, token: TOKEN });
    const malformedRequests: unknown[] = [
      { waypoints: null, profile: 'walking' },
      { waypoints: [null, [16.4, 48.22]], profile: 'walking' },
      { waypoints: [[16.35, 48.2, 7], [16.4, 48.22]], profile: 'walking' },
      { waypoints: [[NaN, 48.2], [16.4, 48.22]], profile: 'walking' },
      { waypoints: [[16.35, 48.2], [16.4, 48.22]], profile: 'flying' },
      { waypoints: [[16.35, 48.2]], profile: 'walking' },
      { waypoints: Array.from({ length: 26 }, (_, index) => [index, 48]), profile: 'walking' },
      { waypoints: [[16.35, 48.2], [16.35, 48.2]], profile: 'walking' },
      { waypoints: [[16.35, 48.2], [16.35, 48.2], [16.4, 48.22]], profile: 'walking' },
    ];

    for (const request of malformedRequests) {
      await expect(provider.directions(request as never)).rejects.toMatchObject({ code: 'REQUEST_INVALID' });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects routes without two distinct waypoints before requesting', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const provider = createMapboxDirectionsProvider({ fetch, token: TOKEN });

    await expect(provider.directions({
      waypoints: [[16.35, 48.2], [16.35, 48.2]],
      profile: 'walking',
    })).rejects.toMatchObject({ code: 'REQUEST_INVALID' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('accepts only the canonical endpoint duplicate used by closed routes', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({
      code: 'Ok',
      routes: [{
        geometry: {
          type: 'LineString',
          coordinates: [[16.35, 48.2], [16.38, 48.21], [16.4, 48.22], [16.35, 48.2]],
        },
        distance: 5000,
        duration: 1200,
      }],
    }));
    const provider = createMapboxDirectionsProvider({ fetch, token: TOKEN });

    await expect(provider.directions({
      waypoints: [[16.35, 48.2], [16.38, 48.21], [16.4, 48.22], [16.35, 48.2]],
      profile: 'walking',
    })).resolves.toMatchObject({ routes: [{ distanceMeters: 5000 }] });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('rejects a sparse two-entry waypoint array before fetch', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('fetch reached'));
    const provider = createMapboxDirectionsProvider({ fetch, token: TOKEN });
    const waypoints: [number, number][] = [];
    waypoints.length = 2;
    waypoints[1] = [16.4, 48.22];

    await expect(provider.directions({ waypoints, profile: 'walking' }))
      .rejects.toMatchObject({ code: 'REQUEST_INVALID' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
