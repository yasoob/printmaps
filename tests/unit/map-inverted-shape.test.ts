import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../../src/domain/project';
import { createMapLibreContentAdapter } from '../../src/map/MapContentAdapter';
import { mapGeometryForLayer } from '../../src/map/MapContentGeometry';

function mapHarness() {
  const sources = new Map<string, unknown>();
  const layers = new Map<string, { id: string; source?: string }>();
  const queryRenderedFeatures = vi.fn(() => []);
  const map = {
    isStyleLoaded: () => true,
    addSource: (id: string, source: unknown) => sources.set(id, source),
    getSource: (id: string) => sources.get(id),
    removeSource: (id: string) => sources.delete(id),
    addLayer: (layer: { id: string; source?: string }) => layers.set(layer.id, layer),
    getLayer: (id: string) => layers.get(id),
    removeLayer: (id: string) => layers.delete(id),
    setPaintProperty: vi.fn(),
    setLayoutProperty: vi.fn(),
    queryRenderedFeatures,
  } as unknown as MapLibreMap;
  return { layers, map, queryRenderedFeatures, sources };
}

function invertedLayer(): ContentLayer {
  return {
    id: 'inverted',
    name: 'Inverted area',
    type: 'shape',
    visible: true,
    locked: false,
    opacity: 28,
    appearance: {
      kind: 'shape', fillColor: '#d18b25', strokeColor: '#d18b25', strokeWidth: 2, invert: true,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[[10, 45], [11, 45], [11, 46], [10, 45]]],
    },
  };
}

describe('inverted shape map geometry', () => {
  it('wraps the selected polygon in a Web Mercator world mask', () => {
    const layer = invertedLayer();

    expect(mapGeometryForLayer(layer)).toEqual({
      type: 'Polygon',
      coordinates: [
        [[-180, -85.051129], [180, -85.051129], [180, 85.051129], [-180, 85.051129], [-180, -85.051129]],
        [[10, 45], [11, 45], [11, 46], [10, 45]],
      ],
    });
  });

  it('keeps the boundary source separate and excludes the outside mask from hit testing', () => {
    const { layers, map, queryRenderedFeatures, sources } = mapHarness();
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'));

    expect(adapter.sync({
      layers: [invertedLayer()], selectedId: null, previewedId: null,
    })).toBe('synced');

    expect([...sources.keys()]).toEqual([
      'studio-source-8:inverted',
      'studio-source-8:inverted:outline',
    ]);
    expect(layers.get('studio-layer-8:inverted:fill')?.source).toBe('studio-source-8:inverted');
    expect(layers.get('studio-layer-8:inverted:line')?.source).toBe('studio-source-8:inverted:outline');

    expect(adapter.hitTest([0, 0])).toBeNull();
    expect(queryRenderedFeatures).toHaveBeenCalledWith([0, 0], {
      layers: ['studio-layer-8:inverted:line'],
    });
  });
});
