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
