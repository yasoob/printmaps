import type { Map as MapLibreMap } from 'maplibre-gl';
import { createDefaultRouteAppearance, type ContentLayer } from '../../src/domain/project';
import { addContentLayer, type RenderedMapContent } from '../../src/map/MapContentLayerRendering';
import { queryMapContentFeature } from '../../src/map/MapContentHitTesting';

describe('MapLibre Arc content', () => {
  it('renders and hit-tests one visibly curved canonical source', () => {
    const addSource = vi.fn();
    const addLayer = vi.fn();
    const queryRenderedFeatures = vi.fn(() => [{ properties: { layerId: 'arc-route' } }]);
    const map = { addLayer, addSource, queryRenderedFeatures } as unknown as MapLibreMap;
    const layer: ContentLayer = {
      id: 'arc-route',
      name: 'Arc route',
      type: 'route',
      route: { kind: 'arc', closed: false },
      visible: true,
      locked: false,
      opacity: 100,
      appearance: createDefaultRouteAppearance(1),
      geometry: { type: 'Arc', anchors: [[0, 0], [1, 0]], curvatures: [0.35] },
    };
    const rendered: RenderedMapContent = {
      hitTestLayerIds: [],
      mapLayerIds: [],
      sourceIds: [],
      structure: '',
    };

    addContentLayer(map, layer, {
      assets: {},
      highlight: { previewedId: null, selectedId: null },
      rendered,
    });

    const source = addSource.mock.calls[0][1] as {
      data: { features: { geometry: { coordinates: [number, number][] } }[] };
    };
    expect(source.data.features[0].geometry.coordinates).toHaveLength(25);
    expect(Math.abs(source.data.features[0].geometry.coordinates[12][1])).toBeGreaterThan(0.1);
    expect(addLayer).toHaveBeenCalledWith(expect.objectContaining({
      id: 'studio-layer-9:arc-route:solid',
      source: 'studio-source-9:arc-route',
    }));
    expect(queryMapContentFeature(map, rendered.hitTestLayerIds, [10, 10])?.properties?.layerId).toBe('arc-route');
    expect(queryRenderedFeatures).toHaveBeenCalledWith([10, 10], {
      layers: [
        'studio-layer-9:arc-route:casing',
        'studio-layer-9:arc-route:solid',
        'studio-layer-9:arc-route:dashed',
      ],
    });
  });
});
