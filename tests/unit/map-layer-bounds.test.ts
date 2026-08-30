import type { ContentLayer } from '../../src/domain/project';
import { combinedLayerBounds, layerBounds, visibleLayerBounds } from '../../src/map/MapLayerBounds';

function shapeLayer(id: string, geometry: NonNullable<ContentLayer['geometry']>): ContentLayer {
  return { id, name: id, type: 'shape', visible: true, locked: false, opacity: 28, geometry };
}

describe('map layer bounds', () => {
  it('computes finite bounds for a generated administrative polygon', () => {
    const layer = shapeLayer('admin-test', {
      type: 'Polygon',
      coordinates: [[[9, 46], [17, 46], [17, 49], [9, 46]]],
    });

    expect(layerBounds([layer], 'admin-test')).toEqual([[9, 46], [17, 49]]);
    expect(layerBounds([layer], 'missing')).toBeUndefined();
  });

  it('computes bounds across every disconnected MultiPolygon part', () => {
    const layer = shapeLayer('admin-parts', {
      type: 'MultiPolygon',
      coordinates: [
        [[[10, 46], [11, 46], [11, 47], [10, 46]]],
        [[[12, 47], [13, 47], [13, 48], [12, 47]]],
      ],
    });

    expect(layerBounds([layer], 'admin-parts')).toEqual([[10, 46], [13, 48]]);
  });

  it('combines the complete extent of multiple imported geometries', () => {
    const layers: ContentLayer[] = [
      {
        id: 'west', name: 'West', type: 'poi', visible: true, locked: false, opacity: 100,
        geometry: { type: 'Point', coordinates: [9, 46] },
      },
      {
        id: 'east', name: 'East', type: 'route', visible: true, locked: false, opacity: 100,
        geometry: { type: 'LineString', coordinates: [[16, 48], [18, 50]] },
      },
    ];

    expect(combinedLayerBounds(layers)).toEqual([[9, 46], [18, 50]]);
  });

  it('excludes hidden geometry from visible bounds', () => {
    const layers: ContentLayer[] = [
      shapeLayer('visible', { type: 'Point', coordinates: [16, 48] }),
      { ...shapeLayer('hidden', { type: 'Point', coordinates: [-120, 30] }), visible: false },
      { ...shapeLayer('transparent', { type: 'Point', coordinates: [120, 30] }), opacity: 0 },
    ];

    expect(visibleLayerBounds(layers)).toEqual([[16, 48], [16, 48]]);
  });

  it('fits a dateline Arc on its short continuous sampled extent', () => {
    const layer: ContentLayer = {
      id: 'dateline', name: 'Dateline', type: 'route', visible: true, locked: false, opacity: 100,
      geometry: { type: 'Arc', anchors: [[179, 0], [-179, 0]], curvatures: [0.35] },
    };

    const bounds = combinedLayerBounds([layer]);

    expect(bounds).toBeDefined();
    expect(bounds![1][0] - bounds![0][0]).toBeLessThan(3);
  });

  it('refuses bounds outside the Web Mercator latitude range', () => {
    const layer: ContentLayer = {
      id: 'polar', name: 'Polar', type: 'poi', visible: true, locked: false, opacity: 100,
      geometry: { type: 'Point', coordinates: [16, 86] },
    };

    expect(combinedLayerBounds([layer])).toBeUndefined();
  });
});
