import { describe, expect, it, vi } from 'vitest';
import { createMapboxMapMatchingProvider } from '../../src/services/mapbox/mapMatching';

const token = 'pk.fake-public-segment.fake-signature';
const trace = [[16.35, 48.2], [16.36, 48.205], [16.37, 48.21]] as const;
const matched = [[16.3501, 48.2001], [16.36, 48.2052], [16.3702, 48.2101]];
const tracepoints = matched.map((location, waypoint_index) => ({
  alternatives_count: 0,
  location,
  matchings_index: 0,
  name: 'Road',
  waypoint_index,
}));

describe('Mapbox Map Matching provider', () => {
  it.each(['exact', 'near'] as const)('passes through a complete %s loop response for canonical topology validation', async (closure) => {
    const loop = [...trace, trace[0]];
    const geometry = [...trace, closure === 'exact' ? trace[0] : [16.350001, 48.2]];
    const fetch = vi.fn(async (input: string | URL | Request) => {
      expect(new URL(String(input)).searchParams.get('radiuses')).toBe('50;50;50;50');
      return Response.json({
        code: 'Ok', matchings: [{ geometry: { type: 'LineString', coordinates: geometry }, confidence: 0.9 }],
        tracepoints: loop.map((_, waypoint_index) => ({ matchings_index: 0, waypoint_index })),
      });
    });
    const provider = createMapboxMapMatchingProvider({ fetch, token });
    const result = await provider.match({ trace: loop, profile: 'walking' });
    expect(result.matches[0].geometry).toEqual(geometry);
    expect(result.matches[0].geometry).not.toBe(geometry);
  });

  it.each(['missing closing tracepoint', 'unmatched closing tracepoint', 'out-of-order closing tracepoint', 'multiple matchings'])('rejects a loop with %s', async (failure) => {
    const loop = [...trace, trace[0]];
    const points: unknown[] = loop.map((_, waypoint_index) => ({ matchings_index: 0, waypoint_index }));
    switch (failure) {
    case 'missing closing tracepoint': {
    points.pop();
    break;
    }
    case 'unmatched closing tracepoint': {
    points[3] = null;
    break;
    }
    case 'out-of-order closing tracepoint': { {
    points[3] = { matchings_index: 0, waypoint_index: 0 };
    // No default
    }
    break;
    }
    }
    const matchings = [{ geometry: { type: 'LineString', coordinates: loop } }];
    if (failure === 'multiple matchings') matchings.push(matchings[0]);
    const provider = createMapboxMapMatchingProvider({
      token, fetch: vi.fn(async () => Response.json({ code: 'Ok', matchings, tracepoints: points })),
    });
    await expect(provider.match({ trace: loop, profile: 'walking' })).rejects.toMatchObject({ code: 'RESPONSE_INVALID' });
  });

  it('accepts 100 trace positions including closure and rejects 101 before requesting', async () => {
    const loop: [number, number][] = Array.from({ length: 99 }, (_, index) => [16 + index / 1000, 48]);
    loop.push([...loop[0]]);
    const fetch = vi.fn(async () => Response.json({
      code: 'Ok', matchings: [{ geometry: { type: 'LineString', coordinates: loop } }],
      tracepoints: loop.map((_, waypoint_index) => ({ matchings_index: 0, waypoint_index })),
    }));
    const provider = createMapboxMapMatchingProvider({ token, fetch });
    const result = await provider.match({ trace: loop, profile: 'walking' });
    expect(result.matches[0].geometry).toHaveLength(100);
    await expect(provider.match({ trace: [...loop, loop[0]], profile: 'walking' })).rejects.toMatchObject({ code: 'REQUEST_INVALID' });
    await expect(provider.match({ trace: loop.slice(0, 1), profile: 'walking' })).rejects.toMatchObject({ code: 'REQUEST_INVALID' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('requests one bounded matching and returns detached geometry', async () => {
    const payload = {
      code: 'Ok',
      matchings: [{ confidence: 0.93, geometry: { type: 'LineString', coordinates: matched } }],
      tracepoints,
    };
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/matching/v5/mapbox/walking/16.35,48.2;16.36,48.205;16.37,48.21');
      expect(url.searchParams.get('geometries')).toBe('geojson');
      expect(url.searchParams.get('overview')).toBe('full');
      expect(url.searchParams.get('steps')).toBe('false');
      expect(url.searchParams.get('radiuses')).toBe('50;50;50');
      expect(url.searchParams.has('tidy')).toBe(false);
      expect(url.searchParams.get('access_token')).toBe(token);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Response.json(payload);
    });
    const provider = createMapboxMapMatchingProvider({ fetch, token });

    const result = await provider.match({ profile: 'walking', trace });

    expect(result.matches).toEqual([{ confidence: 0.93, geometry: matched }]);
    expect(result.matches[0]?.geometry).not.toBe(payload.matchings[0]?.geometry.coordinates);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('rejects a partial match instead of dropping an unmatched endpoint', async () => {
    const fetch = vi.fn(async () => Response.json({
      code: 'Ok',
      matchings: [{ confidence: 0.5, geometry: { type: 'LineString', coordinates: matched.slice(0, 2) } }],
      tracepoints: [tracepoints[0], tracepoints[1], null],
    }));
    const provider = createMapboxMapMatchingProvider({ fetch, token });

    await expect(provider.match({ profile: 'walking', trace }))
      .rejects.toThrow('Route point 3 was not matched to a road.');
  });
});
