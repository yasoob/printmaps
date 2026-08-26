import type { Map as MapLibreMap } from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import { queryMapContentFeature } from '../../src/map/MapContentHitTesting';

function createMap(results: unknown[][]) {
  const queryRenderedFeatures = vi.fn(() => results.shift() ?? []);
  return {
    map: { queryRenderedFeatures } as unknown as Pick<MapLibreMap, 'queryRenderedFeatures'>,
    queryRenderedFeatures,
  };
}

describe('map content hit testing', () => {
  it('returns an exact feature without expanding the query', () => {
    const feature = { properties: { layerId: 'area' } };
    const { map, queryRenderedFeatures } = createMap([[feature]]);

    expect(queryMapContentFeature(map, ['area'], [40, 60])).toBe(feature);
    expect(queryRenderedFeatures).toHaveBeenCalledOnce();
  });

  it('retries an exact miss with a 24 pixel selection box', () => {
    const feature = { properties: { layerId: 'route' } };
    const { map, queryRenderedFeatures } = createMap([[], [feature]]);

    expect(queryMapContentFeature(map, ['route'], [40, 60])).toBe(feature);
    expect(queryRenderedFeatures).toHaveBeenNthCalledWith(2, [[28, 48], [52, 72]], { layers: ['route'] });
  });
});
