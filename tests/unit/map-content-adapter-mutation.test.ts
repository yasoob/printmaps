import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../../src/domain/project';
import { createMapLibreContentAdapter } from '../../src/map/MapContentAdapter';

type AddedLayer = {
  id: string;
  type?: string;
};

type AddedSource = {
  data: {
    geometry: NonNullable<ContentLayer['geometry']>;
  };
};

function createMapHarness() {
  const sources = new Map<string, AddedSource>();
  const layers = new Map<string, AddedLayer>();
  const map = {
    isStyleLoaded: () => true,
    addControl: vi.fn(),
    addSource: (id: string, source: AddedSource) => {
      if (sources.has(id)) throw new Error(`Source ${id} already exists`);
      sources.set(id, structuredClone(source));
    },
    getSource: (id: string) => sources.get(id),
    removeSource: (id: string) => sources.delete(id),
    addLayer: (layer: AddedLayer) => {
      if (layers.has(layer.id)) throw new Error(`Layer ${layer.id} already exists`);
      layers.set(layer.id, layer);
    },
    getLayer: (id: string) => layers.get(id),
    removeLayer: (id: string) => layers.delete(id),
    setPaintProperty: () => null,
    queryRenderedFeatures: () => [],
  } as unknown as MapLibreMap;
  return { layers, map, sources };
}

function contentLayer(
  id: string,
  type: ContentLayer['type'],
  geometry: NonNullable<ContentLayer['geometry']>,
): ContentLayer {
  return { id, name: id, type, geometry, opacity: 100, visible: true, locked: false };
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
    expect(sources.get('studio-source-5:route')?.data.geometry).toEqual({
      type: 'LineString',
      coordinates: [[0, 0], [7, 1]],
    });
  });

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
    expect(sources.get('studio-source-5:route')?.data.geometry).toEqual({
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
    expect(sources.get('studio-source-5:route')?.data.geometry).toEqual(route.geometry);
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
      'studio-layer-5:route:main',
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
    expect([...renderedLayers.keys()]).toEqual(['studio-layer-5:route:main']);
    expect([...sources.keys()]).toEqual(['studio-source-5:route']);
    expect(container).toHaveAttribute('data-map-layer-order', 'route');
  });
});
