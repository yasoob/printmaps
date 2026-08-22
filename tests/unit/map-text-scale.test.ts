import { createMapTextScaleController } from '../../src/map/MapTextScale';

describe('MapLibre global text scaling', () => {
  it('scales text-bearing symbol layers from their original layout values without compounding', () => {
    const setLayoutProperty = vi.fn();
    const map = {
      getStyle: () => ({
        layers: [
          { id: 'city-label', type: 'symbol', layout: { 'text-field': ['get', 'name'], 'text-size': 16 } },
          { id: 'road-label', type: 'symbol', layout: { 'text-field': ['get', 'ref'], 'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 14, 18] } },
          { id: 'icon-only', type: 'symbol', layout: { 'icon-image': 'marker' } },
          { id: 'water', type: 'fill' },
        ],
      }),
      setLayoutProperty,
    };
    const controller = createMapTextScaleController(map);

    controller.apply(125);
    controller.apply(150);

    expect(setLayoutProperty.mock.calls).toEqual([
      ['city-label', 'text-size', 20],
      ['road-label', 'text-size', ['interpolate', ['linear'], ['zoom'], 8, 12.5, 14, 22.5]],
      ['city-label', 'text-size', 24],
      ['road-label', 'text-size', ['interpolate', ['linear'], ['zoom'], 8, 15, 14, 27]],
    ]);
  });
});
