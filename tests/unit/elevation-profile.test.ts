import { distanceBetweenPositions, loadElevationProfile, MAX_ELEVATION_SAMPLES, sampleRouteCoordinates } from '../../src/elevation/profile';
import { createElevationProfileLayout, formatElevationProfileSummary } from '../../src/export/elevationProfile';

function flatTerrain() {
  return vi.fn<typeof fetch>(async (input) => {
    const count = new URL(String(input)).searchParams.get('latitude')!.split(',').length;
    return Response.json({ elevation: Array.from({ length: count }, () => 100) });
  });
}

function fullRouteDistance(coordinates: readonly (readonly [number, number])[]) {
  return coordinates.slice(1).reduce((sum, coordinate, index) => sum + distanceBetweenPositions(coordinates[index], coordinate), 0);
}

describe('elevation profiles', () => {
  it('retains the original right-angle distance instead of measuring chords between terrain samples', async () => {
    const coordinates = [[16.37, 48.2], [16.371, 48.2], [16.371, 48.201]] as const;
    const fetcher = flatTerrain();
    const profile = await loadElevationProfile(coordinates, { fetcher });
    const expected = fullRouteDistance(coordinates);
    expect(expected).toBeCloseTo(185.31, 2);
    expect(profile.totalDistanceMeters).toBe(expected);
    expect(profile.samples.map(({ distanceMeters }) => distanceMeters)).toEqual([0, expected / 2, expected]);
    const layout = createElevationProfileLayout(profile);
    expect(layout.points[1].x).toBeCloseTo(layout.plot.left + layout.plot.width / 2, 8);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('preserves switchback distance, summary and axis when the terrain sample count is capped', async () => {
    const coordinates: [number, number][] = Array.from({ length: 201 }, (_, index) => [
      16.37 + (index % 2) * 0.004,
      48.2 + index * 0.00005,
    ]);
    const fetcher = flatTerrain();
    const profile = await loadElevationProfile(coordinates, { fetcher });
    const expected = fullRouteDistance(coordinates);
    expect(profile.samples).toHaveLength(MAX_ELEVATION_SAMPLES);
    expect(profile.totalDistanceMeters).toBe(expected);
    expect(profile.samples.at(-1)?.distanceMeters).toBe(expected);
    expect(formatElevationProfileSummary(profile, 'metric').distance).toBe(`${(expected / 1000).toFixed(1)} km`);
    expect(createElevationProfileLayout(profile).distanceTicks.at(-1)?.label).toBe(`${(expected / 1000).toFixed(1)} km`);
    expect(profile.totalAscentMeters).toBe(0);
    expect(profile.totalDescentMeters).toBe(0);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('keeps closed antimeridian distance and endpoint samples through repeated input positions', async () => {
    const coordinates = [[179.9, 0], [179.9, 0], [-179.9, 0], [-179.9, 0], [179.9, 0]] as const;
    const profile = await loadElevationProfile(coordinates, { fetcher: flatTerrain() });
    const expected = fullRouteDistance(coordinates);
    expect(profile.totalDistanceMeters).toBe(expected);
    expect(profile.samples[0].distanceMeters).toBe(0);
    expect(profile.samples.at(-1)?.distanceMeters).toBe(expected);
    expect(profile.samples.at(-1)?.coordinate[0]).toBeCloseTo(coordinates[0][0], 8);
    for (const [index, sample] of profile.samples.entries()) {
      expect(Math.abs(sample.coordinate[0])).toBeGreaterThanOrEqual(179.89);
      expect(sample.distanceMeters).toBeLessThanOrEqual(expected);
      if (index > 0) expect(sample.distanceMeters).toBeGreaterThan(profile.samples[index - 1].distanceMeters);
    }
    expect(sampleRouteCoordinates(coordinates)).toEqual(profile.samples.map(({ coordinate }) => coordinate));
  });

  it('keeps two endpoint samples for a very short measurable route', async () => {
    const coordinates = [[16.37, 48.2], [16.37, 48.200001]] as const;
    const profile = await loadElevationProfile(coordinates, { fetcher: flatTerrain() });
    expect(profile.samples).toHaveLength(2);
    expect(profile.totalDistanceMeters).toBe(fullRouteDistance(coordinates));
    expect(profile.samples.at(-1)?.distanceMeters).toBe(profile.totalDistanceMeters);
  });

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
