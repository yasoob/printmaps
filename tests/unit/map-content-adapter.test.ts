import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../../src/domain/project';
import { createMapLibreContentAdapter } from '../../src/map/MapContentAdapter';

type AddedLayer = {
  id: string;
  source?: string;
  paint?: Record<string, unknown>;
};

function createMapHarness({
  failAddLayerAt,
  failAddSourceAt,
  failSetPaintAt,
  failIsStyleLoaded = false,
  failRemoveLayerAt,
  failRemoveSourceAt,
  failQueryRenderedFeatures = false,
  queryRenderedFeaturesResults,
  styleLoaded = true,
}: {
  failAddLayerAt?: number;
  failAddSourceAt?: number;
  failSetPaintAt?: number;
  failIsStyleLoaded?: boolean;
  failRemoveLayerAt?: number | number[];
  failRemoveSourceAt?: number | number[];
  failQueryRenderedFeatures?: boolean;
  queryRenderedFeaturesResults?: Array<unknown[] | Error>;
  styleLoaded?: boolean;
} = {}) {
  const sources = new Set<string>();
  const layers = new Map<string, AddedLayer>();
  let addSourceCalls = 0;
  let addLayerCalls = 0;
  let setPaintCalls = 0;
  let removeLayerCalls = 0;
  let removeSourceCalls = 0;
  let queryRenderedFeaturesCalls = 0;
  const paintUpdates: Array<[string, string, unknown]> = [];
  const shouldFailAt = (configuredCalls: number | number[] | undefined, call: number) => (
    Array.isArray(configuredCalls) ? configuredCalls.includes(call) : configuredCalls === call
  );
  const map = {
    isStyleLoaded: () => {
      if (failIsStyleLoaded) throw new Error('isStyleLoaded failure');
      return styleLoaded;
    },
    addSource: (id: string) => {
      addSourceCalls += 1;
      if (addSourceCalls === failAddSourceAt) throw new Error('addSource failure');
      if (sources.has(id)) throw new Error(`Source ${id} already exists`);
      sources.add(id);
    },
    getSource: (id: string) => sources.has(id) ? {} : undefined,
    removeSource: (id: string) => {
      removeSourceCalls += 1;
      if (shouldFailAt(failRemoveSourceAt, removeSourceCalls)) throw new Error('removeSource failure');
      sources.delete(id);
    },
    addLayer: (layer: AddedLayer) => {
      addLayerCalls += 1;
      if (addLayerCalls === failAddLayerAt) throw new Error('addLayer failure');
      if (layers.has(layer.id)) throw new Error(`Layer ${layer.id} already exists`);
      layers.set(layer.id, layer);
    },
    getLayer: (id: string) => layers.get(id),
    removeLayer: (id: string) => {
      removeLayerCalls += 1;
      if (shouldFailAt(failRemoveLayerAt, removeLayerCalls)) throw new Error('removeLayer failure');
      layers.delete(id);
    },
    setPaintProperty: (id: string, property: string, value: unknown) => {
      setPaintCalls += 1;
      if (setPaintCalls === failSetPaintAt) throw new Error('setPaintProperty failure');
      paintUpdates.push([id, property, value]);
      const layer = layers.get(id);
      if (layer) layer.paint = { ...layer.paint, [property]: value };
    },
    queryRenderedFeatures: () => {
      if (failQueryRenderedFeatures) throw new Error('queryRenderedFeatures failure');
      const result = queryRenderedFeaturesResults?.[queryRenderedFeaturesCalls++];
      if (result instanceof Error) throw result;
      return result ?? [];
    },
  } as unknown as MapLibreMap;

  return { map, sources, layers, paintUpdates };
}

function contentLayer(
  id: string,
  type: ContentLayer['type'],
  geometry: NonNullable<ContentLayer['geometry']>,
  opacity = 100,
): ContentLayer {
  return { id, name: id, type, geometry, opacity, visible: true, locked: false };
}

describe('MapLibre content adapter', () => {
  it('reports content sync as deferred while the style is not loaded', () => {
    const { map, sources, layers } = createMapHarness({ styleLoaded: false });
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'));

    expect(adapter.sync({
      layers: [contentLayer('waiting-route', 'route', {
        type: 'LineString',
        coordinates: [[0, 0], [1, 1]],
      })],
      selectedId: null,
      previewedId: null,
    })).toBe('deferred');
    expect(layers).toHaveLength(0);
    expect(sources).toHaveLength(0);
  });

  it('contains a style readiness exception as a recoverable sync failure', () => {
    const { map } = createMapHarness({ failIsStyleLoaded: true });
    const container = document.createElement('div');
    const adapter = createMapLibreContentAdapter(map, container);

    expect(adapter.sync({ layers: [], selectedId: null, previewedId: null })).toBe('failed');
    expect(container).toHaveAttribute('data-map-content-error', 'true');
  });

  it('generates distinct map layer IDs when one content ID contains another layer suffix', () => {
    const { map, sources, layers } = createMapHarness();
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'));

    adapter.sync({
      layers: [
        contentLayer('district', 'shape', {
          type: 'Polygon',
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
        }),
        contentLayer('district-fill', 'route', {
          type: 'LineString',
          coordinates: [[0, 0], [1, 1]],
        }),
      ],
      selectedId: null,
      previewedId: null,
    });

    expect(sources).toHaveLength(2);
    expect(layers).toHaveLength(3);
    expect(new Set(layers.keys())).toHaveLength(3);
  });

  it('applies zero shape opacity to both the fill and outline', () => {
    const { map, layers } = createMapHarness();
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'));

    adapter.sync({
      layers: [contentLayer('transparent-shape', 'shape', {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
      }, 0)],
      selectedId: null,
      previewedId: null,
    });

    expect([...layers.values()].map((layer) => layer.paint)).toEqual(expect.arrayContaining([
      expect.objectContaining({ 'fill-opacity': 0 }),
      expect.objectContaining({ 'line-opacity': 0 }),
    ]));
  });

  it('updates rendered paint for selected and previewed layers without rebuilding them', () => {
    const { map, layers, paintUpdates } = createMapHarness();
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'));
    const route = contentLayer('route', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [1, 1]],
    });
    const poi = contentLayer('poi', 'poi', {
      type: 'Point',
      coordinates: [1, 1],
    });
    adapter.sync({ layers: [route, poi], selectedId: null, previewedId: null });
    const renderedLayers = [...layers.values()];

    expect(adapter.sync({ layers: [route, poi], selectedId: 'route', previewedId: 'poi' })).toBe('synced');
    expect([...layers.values()]).toEqual(renderedLayers);
    expect(paintUpdates).toEqual(expect.arrayContaining([
      ['studio-layer-5:route:main', 'line-color', '#006fc9'],
      ['studio-layer-5:route:main', 'line-width', 6],
      ['studio-layer-3:poi:main', 'circle-color', '#006fc9'],
      ['studio-layer-3:poi:main', 'circle-radius', 9],
    ]));
  });

  it('adds rendered MapLibre layers from bottom to top in content stacking order', () => {
    const { map, layers } = createMapHarness();
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'));

    adapter.sync({
      layers: [
        contentLayer('top-route', 'route', { type: 'LineString', coordinates: [[0, 0], [1, 1]] }),
        contentLayer('middle-shape', 'shape', {
          type: 'Polygon',
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
        }),
        contentLayer('bottom-poi', 'poi', { type: 'Point', coordinates: [0, 0] }),
      ],
      selectedId: null,
      previewedId: null,
    });

    expect([...layers.keys()]).toEqual([
      'studio-layer-10:bottom-poi:main',
      'studio-layer-12:middle-shape:fill',
      'studio-layer-12:middle-shape:line',
      'studio-layer-9:top-route:main',
    ]);
  });

  it('rolls back a source and first shape layer when the second addLayer fails', () => {
    const { map, sources, layers } = createMapHarness({ failAddLayerAt: 2 });
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'));

    expect(adapter.sync({
      layers: [contentLayer('partial-shape', 'shape', {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
      })],
      selectedId: null,
      previewedId: null,
    })).toBe('failed');

    expect(layers).toHaveLength(0);
    expect(sources).toHaveLength(0);
    expect(adapter.sync({
      layers: [contentLayer('partial-shape', 'shape', {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
      })],
      selectedId: null,
      previewedId: null,
    })).toBe('synced');
    expect(layers).toHaveLength(2);
    expect(sources).toHaveLength(1);
    adapter.destroy();
    expect(layers).toHaveLength(0);
    expect(sources).toHaveLength(0);
  });

  it('contains rollback failures and allows destroy to retry unfinished cleanup', () => {
    const { map, sources, layers } = createMapHarness({
      failAddLayerAt: 2,
      failRemoveLayerAt: 1,
      failRemoveSourceAt: 1,
    });
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'));

    expect(adapter.sync({
      layers: [contentLayer('partial-shape', 'shape', {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
      })],
      selectedId: null,
      previewedId: null,
    })).toBe('failed');
    expect(layers).toHaveLength(1);
    expect(sources).toHaveLength(1);

    expect(() => adapter.destroy()).not.toThrow();
    expect(layers).toHaveLength(0);
    expect(sources).toHaveLength(0);
    expect(() => adapter.destroy()).not.toThrow();
  });

  it('fails closed when old content cleanup is incomplete and recovers on retry', () => {
    const { map, sources, layers } = createMapHarness({ failRemoveLayerAt: 1 });
    const container = document.createElement('div');
    const adapter = createMapLibreContentAdapter(map, container);
    const route = contentLayer('old-route', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [1, 1]],
    });
    const poi = contentLayer('new-poi', 'poi', {
      type: 'Point',
      coordinates: [1, 1],
    });

    expect(adapter.sync({ layers: [route], selectedId: null, previewedId: null })).toBe('synced');
    expect(adapter.sync({ layers: [poi], selectedId: null, previewedId: null })).toBe('failed');
    expect([...layers.keys()]).not.toContain('studio-layer-7:new-poi:main');
    expect([...sources.keys()]).not.toContain('studio-source-7:new-poi');
    expect(container).toHaveAttribute('data-map-content-error', 'true');

    expect(adapter.sync({ layers: [poi], selectedId: null, previewedId: null })).toBe('synced');
    expect([...layers.keys()]).toEqual(['studio-layer-7:new-poi:main']);
    expect([...sources.keys()]).toEqual(['studio-source-7:new-poi']);
    expect(container).not.toHaveAttribute('data-map-content-error');
  });

  it('retries pending cleanup before an empty target can report synced', () => {
    const { map, sources, layers } = createMapHarness({
      failRemoveLayerAt: [1, 2],
      failRemoveSourceAt: [1, 2],
    });
    const container = document.createElement('div');
    const adapter = createMapLibreContentAdapter(map, container);
    const route = contentLayer('stale-route', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [1, 1]],
    });
    const emptyState = { layers: [], selectedId: null, previewedId: null };

    expect(adapter.sync({ layers: [route], selectedId: null, previewedId: null })).toBe('synced');
    expect(adapter.sync(emptyState)).toBe('failed');
    expect(layers).toHaveLength(1);
    expect(sources).toHaveLength(1);
    expect(container).toHaveAttribute('data-map-content-error', 'true');

    expect(adapter.sync(emptyState)).toBe('synced');
    expect(layers).toHaveLength(0);
    expect(sources).toHaveLength(0);
    expect(container).not.toHaveAttribute('data-map-content-error');
  });

  it('rolls back earlier content when a later addSource fails', () => {
    const { map, sources, layers } = createMapHarness({ failAddSourceAt: 2 });
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'));

    expect(adapter.sync({
      layers: [
        contentLayer('first-route', 'route', {
          type: 'LineString',
          coordinates: [[0, 0], [1, 1]],
        }),
        contentLayer('second-route', 'route', {
          type: 'LineString',
          coordinates: [[1, 1], [2, 2]],
        }),
      ],
      selectedId: null,
      previewedId: null,
    })).toBe('failed');

    expect(layers).toHaveLength(0);
    expect(sources).toHaveLength(0);
  });

  it('returns a recoverable failure and clears content when a stable paint update fails', () => {
    const { map, sources, layers } = createMapHarness({ failSetPaintAt: 1 });
    const container = document.createElement('div');
    const adapter = createMapLibreContentAdapter(map, container);
    const route = contentLayer('route', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [1, 1]],
    });
    expect(adapter.sync({ layers: [route], selectedId: null, previewedId: null })).toBe('synced');

    expect(adapter.sync({ layers: [route], selectedId: 'route', previewedId: null })).toBe('failed');
    expect(layers).toHaveLength(0);
    expect(sources).toHaveLength(0);
    expect(container).toHaveAttribute('data-map-layer-order', '');
    expect(container).toHaveAttribute('data-map-content-error', 'true');
  });

  it('contains hit-test exceptions and reports a recoverable content failure', () => {
    const { map } = createMapHarness({ failQueryRenderedFeatures: true });
    const container = document.createElement('div');
    const adapter = createMapLibreContentAdapter(map, container);
    const route = contentLayer('route', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [1, 1]],
    });
    adapter.sync({ layers: [route], selectedId: null, previewedId: null });

    expect(adapter.hitTest([0, 0])).toBeUndefined();
    expect(container).toHaveAttribute('data-map-content-error', 'true');
  });

  it.each([
    ['feature', [{ properties: { layerId: 'route' } }], 'route'],
    ['background', [], null],
  ] as const)('clears a previous hit-test diagnostic after a successful %s hit', (_kind, recoveredFeatures, expectedLayerId) => {
    const { map } = createMapHarness({
      queryRenderedFeaturesResults: [new Error('queryRenderedFeatures failure'), [...recoveredFeatures]],
    });
    const container = document.createElement('div');
    const adapter = createMapLibreContentAdapter(map, container);
    const route = contentLayer('route', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [1, 1]],
    });
    adapter.sync({ layers: [route], selectedId: null, previewedId: null });

    expect(adapter.hitTest([0, 0])).toBeUndefined();
    expect(container).toHaveAttribute('data-map-content-error', 'true');

    expect(adapter.hitTest([1, 1])).toBe(expectedLayerId);
    expect(container).not.toHaveAttribute('data-map-content-error');
  });
});
