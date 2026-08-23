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

    controller.apply({ roads: false, buildings: true, labels: false, water: true, parks: true, landuse: true, transit: true });
    controller.apply({ roads: true, buildings: false, labels: true, water: true, parks: true, landuse: true, transit: true });

    expect(setLayoutProperty.mock.calls).toEqual([
      ['road-primary', 'visibility', 'none'],
      ['building-3d', 'visibility', 'none'],
      ['city-label', 'visibility', 'none'],
      ['water', 'visibility', 'visible'],
      ['road-primary', 'visibility', 'visible'],
      ['building-3d', 'visibility', 'none'],
      ['city-label', 'visibility', 'visible'],
      ['water', 'visibility', 'visible'],
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

    controller.apply({ roads: false, buildings: true, labels: true, water: true, parks: true, landuse: true, transit: true });

    expect(setLayoutProperty.mock.calls).toEqual([
      ['road-primary', 'visibility', 'none'],
      ['road-major-rail', 'visibility', 'visible'],
      ['railway-transit', 'visibility', 'visible'],
    ]);
  });

  it('hides icon-only road symbols when either roads or labels are hidden', () => {
    const setLayoutProperty = vi.fn();
    const controller = createMapFeatureVisibilityController({
      getStyle: () => ({
        layers: [{
          id: 'road-one-way-arrow',
          type: 'symbol',
          'source-layer': 'transportation',
          layout: { 'icon-image': 'arrow' },
        }],
      }),
      setLayoutProperty,
    });

    controller.apply({ roads: true, buildings: true, labels: false, water: true, parks: true, landuse: true, transit: true });
    controller.apply({ roads: false, buildings: true, labels: true, water: true, parks: true, landuse: true, transit: true });
    controller.apply({ roads: true, buildings: true, labels: true, water: true, parks: true, landuse: true, transit: true });

    expect(setLayoutProperty.mock.calls).toEqual([
      ['road-one-way-arrow', 'visibility', 'none'],
      ['road-one-way-arrow', 'visibility', 'none'],
      ['road-one-way-arrow', 'visibility', 'visible'],
    ]);
  });

  it('controls water, parks, land detail, and transit independently', () => {
    const setLayoutProperty = vi.fn();
    const controller = createMapFeatureVisibilityController({
      getStyle: () => ({
        layers: [
          { id: 'road-primary', type: 'line', 'source-layer': 'transportation' },
          { id: 'water-fill', type: 'fill', 'source-layer': 'water' },
          { id: 'park-fill', type: 'fill', 'source-layer': 'park' },
          { id: 'landcover-wood', type: 'fill', 'source-layer': 'landcover' },
          { id: 'landuse-residential', type: 'fill', 'source-layer': 'landuse' },
          { id: 'railway-transit', type: 'line', 'source-layer': 'transportation' },
          { id: 'railway-station-label', type: 'symbol', 'source-layer': 'poi', layout: { 'text-field': ['get', 'name'] } },
          { id: 'city-label', type: 'symbol', 'source-layer': 'place', layout: { 'text-field': ['get', 'name'] } },
        ],
      }),
      setLayoutProperty,
    });

    controller.apply({
      roads: true,
      buildings: true,
      labels: true,
      water: false,
      parks: false,
      landuse: false,
      transit: false,
    });

    expect(setLayoutProperty.mock.calls).toEqual([
      ['road-primary', 'visibility', 'visible'],
      ['water-fill', 'visibility', 'none'],
      ['park-fill', 'visibility', 'none'],
      ['landcover-wood', 'visibility', 'none'],
      ['landuse-residential', 'visibility', 'none'],
      ['railway-transit', 'visibility', 'none'],
      ['railway-station-label', 'visibility', 'none'],
      ['city-label', 'visibility', 'visible'],
    ]);
  });
});
