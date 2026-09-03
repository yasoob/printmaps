import type { Map as MapLibreMap } from 'maplibre-gl';
import { createDefaultRouteAppearance, type ContentLayer } from '../../src/domain/project';
import { createMapLibreContentAdapter } from '../../src/map/MapContentAdapter';

type AddedLayer = { id: string; source?: string; paint?: Record<string, unknown> };

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
  const sourceDefinitions = new Map<string, unknown>();
  const layers = new Map<string, AddedLayer>();
  let addSourceCalls = 0;
  let addLayerCalls = 0;
  let setPaintCalls = 0;
  let removeLayerCalls = 0;
  let removeSourceCalls = 0;
  let queryRenderedFeaturesCalls = 0;
  const paintUpdates: Array<[string, string, unknown]> = [];
  const layoutUpdates: Array<[string, string, unknown]> = [];
  const shouldFailAt = (configuredCalls: number | number[] | undefined, call: number) => (
    Array.isArray(configuredCalls) ? configuredCalls.includes(call) : configuredCalls === call
  );
  const map = {
    addControl: vi.fn(),
    isStyleLoaded: () => {
      if (failIsStyleLoaded) throw new Error('isStyleLoaded failure');
      return styleLoaded;
    },
    addSource: (id: string, source: unknown) => {
      addSourceCalls += 1;
      if (addSourceCalls === failAddSourceAt) throw new Error('addSource failure');
      if (sources.has(id)) throw new Error(`Source ${id} already exists`);
      sources.add(id);
      sourceDefinitions.set(id, source);
    },
    getSource: (id: string) => sources.has(id) ? {} : undefined,
    removeSource: (id: string) => {
      removeSourceCalls += 1;
      if (shouldFailAt(failRemoveSourceAt, removeSourceCalls)) throw new Error('removeSource failure');
      sources.delete(id);
      sourceDefinitions.delete(id);
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
    setLayoutProperty: (id: string, property: string, value: unknown) => {
      if (!layers.has(id)) throw new Error(`Layer ${id} does not exist`);
      layoutUpdates.push([id, property, value]);
    },
    queryRenderedFeatures: () => {
      if (failQueryRenderedFeatures) throw new Error('queryRenderedFeatures failure');
      const result = queryRenderedFeaturesResults?.[queryRenderedFeaturesCalls++];
      if (result instanceof Error) throw result;
      return result ?? [];
    },
  } as unknown as MapLibreMap;

  return { map, sources, sourceDefinitions, layers, paintUpdates, layoutUpdates };
}

function contentLayer(
  id: string,
  type: ContentLayer['type'],
  geometry: NonNullable<ContentLayer['geometry']>,
  opacity = 100,
): ContentLayer {
  const routeFields = type === 'route' && geometry.type === 'LineString'
    ? { route: { kind: 'straight' as const, closed: false }, appearance: createDefaultRouteAppearance(geometry.coordinates.length - 1) }
    : {};
  return { id, name: id, type, geometry, opacity, visible: true, locked: false, ...routeFields };
}

describe('MapLibre content adapter', () => {
  it('hides every rendered content layer for basemap capture and restores them', () => {
    const { map, layoutUpdates } = createMapHarness();
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'));
    adapter.sync({
      layers: [
        contentLayer('route', 'route', { type: 'LineString', coordinates: [[0, 0], [1, 1]] }),
        contentLayer('shape', 'shape', {
          type: 'Polygon',
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
        }),
      ],
      selectedId: null,
      previewedId: null,
    });

    expect(adapter.setExportVisibility(false)).toBe(true);
    expect(layoutUpdates).toHaveLength(6);
    expect(layoutUpdates.every(([, property, value]) => property === 'visibility' && value === 'none')).toBe(true);
    expect(adapter.setExportVisibility(true)).toBe(true);
    expect(layoutUpdates.slice(6)).toHaveLength(6);
    expect(layoutUpdates.slice(6).every(([, property, value]) => property === 'visibility' && value === 'visible')).toBe(true);
  });

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
    expect(layers).toHaveLength(6);
    expect(new Set(layers.keys())).toHaveLength(6);
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
      ['studio-layer-5:route:casing', 'line-color', '#006fc9'],
      ['studio-layer-5:route:casing', 'line-opacity', 1],
      ['studio-layer-5:route:solid', 'line-color', ['get', 'color']],
      ['studio-layer-5:route:solid', 'line-width', ['get', 'width']],
      ['studio-layer-3:poi:main', 'circle-color', '#0d78b5'],
      ['studio-layer-3:poi:main', 'circle-radius', 9],
    ]));
  });

  it('reports synchronized geometry after a live POI coordinate update', () => {
    const { map, sourceDefinitions } = createMapHarness();
    const container = document.createElement('div');
    const adapter = createMapLibreContentAdapter(map, container);
    const poi = contentLayer('poi', 'poi', { type: 'Point', coordinates: [1, 1] });

    adapter.sync({ layers: [poi], selectedId: null, previewedId: null, contentRevision: {} });
    expect(container).toHaveAttribute('data-map-layer-geometry', 'poi:[1,1]');

    const movedPoi = { ...poi, geometry: { type: 'Point' as const, coordinates: [2, 3] as [number, number] } };
    adapter.sync({ layers: [movedPoi], selectedId: null, previewedId: null, contentRevision: {} });
    expect(container).toHaveAttribute('data-map-layer-geometry', 'poi:[2,3]');
    expect(sourceDefinitions.get('studio-source-3:poi')).toMatchObject({
      data: { geometry: { type: 'Point', coordinates: [2, 3] } },
    });
  });
});

describe('MapLibre content adapter updates', () => {
  it('reuses the content snapshot for selection and hover syncs with an explicit revision', () => {
    const { map } = createMapHarness();
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'));
    const layers = [contentLayer('route', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [1, 1]],
    })];
    const stringify = vi.spyOn(JSON, 'stringify');

    const contentRevision = {};
    adapter.sync({ layers, selectedId: null, previewedId: null, contentRevision });
    const initialStringifyCalls = stringify.mock.calls.length;
    adapter.sync({ layers, selectedId: 'route', previewedId: null, contentRevision });
    adapter.sync({ layers, selectedId: null, previewedId: 'route', contentRevision });
    const finalStringifyCalls = stringify.mock.calls.length;
    stringify.mockRestore();

    expect(initialStringifyCalls).toBeGreaterThan(0);
    expect(finalStringifyCalls).toBe(initialStringifyCalls);
  });

  it('does not reapply paint when map content state is unchanged', () => {
    const { map, paintUpdates } = createMapHarness();
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'));
    const layers = [
      contentLayer('route', 'route', { type: 'LineString', coordinates: [[0, 0], [1, 1]] }),
      contentLayer('poi', 'poi', { type: 'Point', coordinates: [1, 1] }),
      contentLayer('shape', 'shape', {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
      }),
    ];
    const state = { layers, selectedId: 'route', previewedId: 'shape' };

    adapter.sync(state);
    paintUpdates.length = 0;

    adapter.sync(state);

    expect(paintUpdates).toEqual([]);
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
      'studio-layer-12:middle-shape:hover-halo',
      'studio-layer-12:middle-shape:line',
      'studio-layer-9:top-route:casing',
      'studio-layer-9:top-route:solid',
      'studio-layer-9:top-route:dashed',
    ]);
  });

});

describe('MapLibre content adapter recovery', () => {
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
    expect(layers).toHaveLength(3);
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
    expect(layers).toHaveLength(0);
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
