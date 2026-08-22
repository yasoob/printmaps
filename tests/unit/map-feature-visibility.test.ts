import { createMapFeatureVisibilityController } from '../../src/map/MapFeatureVisibility';

describe('map feature visibility controller', () => {
  it('toggles major style categories and preserves each layer original visibility', () => {
    const setLayoutProperty = vi.fn();
    const controller = createMapFeatureVisibilityController({
      getStyle: () => ({
        layers: [
          { id: 'road-primary', type: 'line', 'source-layer': 'transportation' },
          { id: 'building-3d', type: 'fill-extrusion', 'source-layer': 'building', layout: { visibility: 'none' } },
          { id: 'city-label', type: 'symbol', 'source-layer': 'place', layout: { 'text-field': ['get', 'name'] } },
          { id: 'water', type: 'fill', 'source-layer': 'water' },
        ],
      }),
      setLayoutProperty,
    });

    controller.apply({ roads: false, buildings: true, labels: false });
    controller.apply({ roads: true, buildings: false, labels: true });

    expect(setLayoutProperty.mock.calls).toEqual([
      ['road-primary', 'visibility', 'none'],
      ['building-3d', 'visibility', 'none'],
      ['city-label', 'visibility', 'none'],
      ['road-primary', 'visibility', 'visible'],
      ['building-3d', 'visibility', 'none'],
      ['city-label', 'visibility', 'visible'],
    ]);
  });

  it('keeps railway and transit infrastructure independent from roads', () => {
    const setLayoutProperty = vi.fn();
    const controller = createMapFeatureVisibilityController({
      getStyle: () => ({
        layers: [
          { id: 'road-primary', type: 'line', 'source-layer': 'transportation' },
          { id: 'road-major-rail', type: 'line', 'source-layer': 'transportation' },
          { id: 'railway-transit', type: 'line', 'source-layer': 'transportation' },
        ],
      }),
      setLayoutProperty,
    });

    controller.apply({ roads: false, buildings: true, labels: true });

    expect(setLayoutProperty.mock.calls).toEqual([
      ['road-primary', 'visibility', 'none'],
    ]);
  });
});
