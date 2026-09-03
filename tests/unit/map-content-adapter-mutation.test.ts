import type { Map as MapLibreMap } from 'maplibre-gl';
import { createDefaultRouteAppearance, type ContentLayer } from '../../src/domain/project';
import { createMapLibreContentAdapter } from '../../src/map/MapContentAdapter';
import { mapContentSourceId } from '../../src/map/MapContentGeometry';
import { markMapContentSourceData } from '../../src/map/MapContentSourceState';

type AddedLayer = {
  id: string;
  type?: string;
};

type AddedSource = {
  data: Record<string, unknown>;
  setData: ReturnType<typeof vi.fn>;
};

function sourceGeometry(source: AddedSource | undefined): unknown {
  const data = source?.data as {
    geometry?: NonNullable<ContentLayer['geometry']>;
    features?: { geometry: NonNullable<ContentLayer['geometry']> }[];
  } | undefined;
  return data?.features?.[0]?.geometry ?? data?.geometry;
}

function createMapHarness() {
  const sources = new Map<string, AddedSource>();
  const layers = new Map<string, AddedLayer>();
  const addLayer = vi.fn((layer: AddedLayer) => {
    if (layers.has(layer.id)) throw new Error(`Layer ${layer.id} already exists`);
    layers.set(layer.id, layer);
  });
  const removeLayer = vi.fn((id: string) => layers.delete(id));
  const removeSource = vi.fn((id: string) => sources.delete(id));
  const setPaintProperty = vi.fn();
  const map = {
    isStyleLoaded: () => true,
    addControl: vi.fn(),
    addSource: (id: string, source: { data: Record<string, unknown> }) => {
      if (sources.has(id)) throw new Error(`Source ${id} already exists`);
      const stored: AddedSource = {
        data: structuredClone(source.data),
        setData: vi.fn((data: Record<string, unknown>) => {
          stored.data = structuredClone(data);
        }),
      };
      sources.set(id, stored);
    },
    getSource: (id: string) => sources.get(id),
    removeSource,
    addLayer,
    getLayer: (id: string) => layers.get(id),
    removeLayer,
    setPaintProperty,
    queryRenderedFeatures: () => [],
  } as unknown as MapLibreMap;
  return {
    addLayer,
    layers,
    map,
    removeLayer,
    removeSource,
    setPaintProperty,
    sources,
  };
}

function contentLayer(
  id: string,
  type: ContentLayer['type'],
  geometry: NonNullable<ContentLayer['geometry']>,
): ContentLayer {
  return {
    id, name: id, type, geometry, opacity: 100, visible: true, locked: false,
    ...(type === 'route' && geometry.type === 'LineString' && {
      route: { kind: 'straight' as const, closed: false },
      appearance: createDefaultRouteAppearance(geometry.coordinates.length - 1),
    }),
  };
}

describe('MapLibre content adapter mutable input safety', () => {
  it('refreshes cached content after the caller advances its explicit revision', () => {
    const { map, sources } = createMapHarness();
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'));
    const route = contentLayer('route', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [1, 1]],
    });
    const layers = [route];
    adapter.sync({ layers, selectedId: null, previewedId: null, contentRevision: {} });

    if (route.geometry?.type !== 'LineString') throw new Error('Expected route geometry');
    route.geometry.coordinates[1][0] = 7;

    expect(adapter.sync({
      layers,
      selectedId: 'route',
      previewedId: null,
      contentRevision: {},
    })).toBe('synced');
    expect(sourceGeometry(sources.get('studio-source-5:route'))).toEqual({
      type: 'LineString',
      coordinates: [[0, 0], [7, 1]],
    });
  });

});

describe('MapLibre content adapter incremental layer updates', () => {
  it('updates only a route whose geometry changed', () => {
    const {
      addLayer,
      map,
      removeLayer,
      removeSource,
      setPaintProperty,
      sources,
    } = createMapHarness();
    const route = contentLayer('route', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [1, 1]],
    });

    const poi = contentLayer('poi', 'poi', {
      type: 'Point',
      coordinates: [2, 2],
    });
    const adapter = createMapLibreContentAdapter(
      map,
      document.createElement('div'),
    );
    adapter.sync({
      contentRevision: {},
      layers: [route, poi],
      previewedId: null,
      selectedId: 'route',
    });
    addLayer.mockClear();
    removeLayer.mockClear();
    removeSource.mockClear();
    setPaintProperty.mockClear();
    const routeSource = sources.get('studio-source-5:route');
    const poiSource = sources.get('studio-source-3:poi');
    routeSource?.setData.mockClear();
    poiSource?.setData.mockClear();
    const movedRoute = contentLayer('route', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [7, 1]],
    });

    adapter.sync({
      contentRevision: {},
      layers: [movedRoute, poi],
      previewedId: null,
      selectedId: 'route',
    });

    expect(routeSource?.setData).toHaveBeenCalledOnce();
    expect(poiSource?.setData).not.toHaveBeenCalled();
    expect(addLayer).not.toHaveBeenCalled();
    expect(removeLayer).not.toHaveBeenCalled();
    expect(removeSource).not.toHaveBeenCalled();
    expect(setPaintProperty).not.toHaveBeenCalled();
  });

  it('does not rewrite route data already applied by a live preview', () => {
    const {
      addLayer,
      map,
      removeLayer,
      removeSource,
      setPaintProperty,
      sources,
    } = createMapHarness();
    const route = contentLayer('route', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [1, 1]],
    });
    const adapter = createMapLibreContentAdapter(
      map,
      document.createElement('div'),
    );
    adapter.sync({
      contentRevision: {},
      layers: [route],
      previewedId: null,
      selectedId: 'route',
    });
    const routeSource = sources.get(mapContentSourceId(route.id));
    expect(routeSource).toBeDefined();
    if (!routeSource) return;
    const movedRoute = contentLayer('route', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [7, 1]],
    });
    routeSource.setData.mockClear();
    setPaintProperty.mockClear();
    addLayer.mockClear();
    removeLayer.mockClear();
    removeSource.mockClear();
    markMapContentSourceData(routeSource, movedRoute);

    const result = adapter.sync({
      contentRevision: {},
      layers: [movedRoute],
      previewedId: null,
      selectedId: 'route',
    });

    expect(routeSource.setData).not.toHaveBeenCalled();
    expect(setPaintProperty).not.toHaveBeenCalled();
    expect(addLayer).not.toHaveBeenCalled();
    expect(removeLayer).not.toHaveBeenCalled();
    expect(removeSource).not.toHaveBeenCalled();
    expect(result).toBe('unchanged');
  });

  it.each([
    {
      id: 'poi',
      type: 'poi' as const,
      initial: { type: 'Point' as const, coordinates: [2, 2] as [number, number] },
      updated: { type: 'Point' as const, coordinates: [3, 4] as [number, number] },
    },
    {
      id: 'shape',
      type: 'shape' as const,
      initial: {
        type: 'Polygon' as const,
        coordinates: [[[0, 0], [2, 0], [2, 2], [0, 0]]] as [number, number][][],
      },
      updated: {
        type: 'Polygon' as const,
        coordinates: [[[0, 0], [3, 0], [3, 3], [0, 0]]] as [number, number][][],
      },
    },
  ])('updates only a changed $type source without rebuilding', ({
    id,
    initial,
    type,
    updated,
  }) => {
    const {
      addLayer,
      map,
      removeLayer,
      removeSource,
      setPaintProperty,
      sources,
    } = createMapHarness();
    const route = contentLayer('route', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [1, 1]],
    });
    const target = contentLayer(id, type, initial);
    const adapter = createMapLibreContentAdapter(
      map,
      document.createElement('div'),
    );
    adapter.sync({
      contentRevision: {},
      layers: [route, target],
      previewedId: null,
      selectedId: id,
    });
    addLayer.mockClear();
    removeLayer.mockClear();
    removeSource.mockClear();
    setPaintProperty.mockClear();
    const routeSource = sources.get(mapContentSourceId(route.id));
    const targetSource = sources.get(mapContentSourceId(id));
    routeSource?.setData.mockClear();
    targetSource?.setData.mockClear();

    adapter.sync({
      contentRevision: {},
      layers: [route, contentLayer(id, type, updated)],
      previewedId: null,
      selectedId: id,
    });

    expect(targetSource?.setData).toHaveBeenCalledOnce();
    expect(routeSource?.setData).not.toHaveBeenCalled();
    expect(addLayer).not.toHaveBeenCalled();
    expect(removeLayer).not.toHaveBeenCalled();
    expect(removeSource).not.toHaveBeenCalled();
    expect(setPaintProperty).not.toHaveBeenCalled();
  });
});

describe('MapLibre content adapter mutable input safety', () => {
  it('rebuilds after a nested coordinate mutates in the same layer array', () => {
    const { map, sources } = createMapHarness();
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'));
    const route = contentLayer('route', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [1, 1]],
    });
    const layers = [route];
    adapter.sync({ layers, selectedId: null, previewedId: null });

    if (route.geometry?.type !== 'LineString') throw new Error('Expected route geometry');
    route.geometry.coordinates[1][0] = 7;

    expect(adapter.sync({ layers, selectedId: 'route', previewedId: null })).toBe('synced');
    expect(sourceGeometry(sources.get('studio-source-5:route'))).toEqual({
      type: 'LineString',
      coordinates: [[0, 0], [7, 1]],
    });
  });

  it('rebuilds after a geometry reference is replaced in the same layer array', () => {
    const { map, sources } = createMapHarness();
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'));
    const route = contentLayer('route', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [1, 1]],
    });
    const layers = [route];
    adapter.sync({ layers, selectedId: null, previewedId: null });

    route.geometry = { type: 'LineString', coordinates: [[2, 2], [3, 3]] };

    expect(adapter.sync({ layers, selectedId: null, previewedId: 'route' })).toBe('synced');
    expect(sourceGeometry(sources.get('studio-source-5:route'))).toEqual(route.geometry);
  });

  it('replaces a changed layer element in the same layer array', () => {
    const { map, layers: renderedLayers, sources } = createMapHarness();
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'));
    const layers = [contentLayer('place', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [1, 1]],
    })];
    adapter.sync({ layers, selectedId: null, previewedId: null });

    layers[0] = contentLayer('place', 'poi', { type: 'Point', coordinates: [4, 5] });

    expect(adapter.sync({ layers, selectedId: 'place', previewedId: null })).toBe('synced');
    expect([...renderedLayers.values()]).toEqual([
      expect.objectContaining({ id: 'studio-layer-5:place:main', type: 'circle' }),
    ]);
    expect(sources.get('studio-source-5:place')?.data.geometry).toEqual({
      type: 'Point',
      coordinates: [4, 5],
    });
  });

  it('reorders rendered layers after the same layer array is reordered', () => {
    const { map, layers: renderedLayers } = createMapHarness();
    const container = document.createElement('div');
    const adapter = createMapLibreContentAdapter(map, container);
    const layers = [
      contentLayer('route', 'route', { type: 'LineString', coordinates: [[0, 0], [1, 1]] }),
      contentLayer('poi', 'poi', { type: 'Point', coordinates: [1, 1] }),
    ];
    adapter.sync({ layers, selectedId: null, previewedId: null });

    layers.reverse();

    expect(adapter.sync({ layers, selectedId: null, previewedId: 'poi' })).toBe('synced');
    expect([...renderedLayers.keys()]).toEqual([
      'studio-layer-5:route:casing',
      'studio-layer-5:route:solid',
      'studio-layer-5:route:dashed',
      'studio-layer-3:poi:main',
    ]);
    expect(container).toHaveAttribute('data-map-layer-order', 'poi,route');
  });

  it('removes hidden content after visibility mutates in the same layer array', () => {
    const { map, layers: renderedLayers, sources } = createMapHarness();
    const container = document.createElement('div');
    const adapter = createMapLibreContentAdapter(map, container);
    const route = contentLayer('route', 'route', {
      type: 'LineString',
      coordinates: [[0, 0], [1, 1]],
    });
    const poi = contentLayer('poi', 'poi', { type: 'Point', coordinates: [1, 1] });
    const layers = [route, poi];
    adapter.sync({ layers, selectedId: null, previewedId: null });

    poi.visible = false;

    expect(adapter.sync({ layers, selectedId: 'route', previewedId: null })).toBe('synced');
    expect([...renderedLayers.keys()]).toEqual([
      'studio-layer-5:route:casing',
      'studio-layer-5:route:solid',
      'studio-layer-5:route:dashed',
    ]);
    expect([...sources.keys()]).toEqual(['studio-source-5:route']);
    expect(container).toHaveAttribute('data-map-layer-order', 'route');
  });
});
