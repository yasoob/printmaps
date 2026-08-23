import { loadElevationProfile } from '../../src/elevation/profile';

describe('elevation profiles', () => {
  it('samples a route through the bounded terrain service and calculates inspection metrics', async () => {
    const requests: URL[] = [];
    const fetcher: typeof fetch = vi.fn(async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      const count = url.searchParams.get('latitude')?.split(',').length ?? 0;
      expect(count).toBe(4);
      return Response.json({ elevation: [10, 20, 15, 25] });
    });

    const profile = await loadElevationProfile([[0, 0], [0.01, 0]], { fetcher });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.origin).toBe('https://api.open-meteo.com');
    expect(profile.samples).toHaveLength(4);
    expect(profile.totalDistanceMeters).toBeGreaterThan(1110);
    expect(profile.totalDistanceMeters).toBeLessThan(1113);
    expect(profile.minimumElevationMeters).toBe(10);
    expect(profile.maximumElevationMeters).toBe(25);
    expect(profile.totalAscentMeters).toBe(20);
    expect(profile.totalDescentMeters).toBe(5);
  });

  it('rejects extreme finite terrain measurements before profile arithmetic', async () => {
    const fetcher: typeof fetch = vi.fn(async () => Response.json({
      elevation: [Number.MAX_VALUE, Number.MAX_VALUE],
    }));

    await expect(loadElevationProfile([[0, 0], [0.001, 0]], { fetcher }))
      .rejects.toThrow('invalid measurements');
  });
});
