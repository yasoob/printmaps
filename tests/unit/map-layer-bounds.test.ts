import { administrativeAreaById } from '../../src/domain/administrativeAreas';
import type { ContentLayer } from '../../src/domain/project';
import { combinedLayerBounds, layerBounds } from '../../src/map/MapLayerBounds';

describe('map layer bounds', () => {
  it('computes finite bounds for a bundled administrative polygon', () => {
    const area = administrativeAreaById('AUT');
    if (!area) throw new Error('Austria fixture unavailable.');
    const layer: ContentLayer = {
      id: 'admin-aut',
      name: area.name,
      type: 'shape',
      visible: true,
      locked: false,
      opacity: 28,
      geometry: area.geometry,
    };

    expect(layerBounds([layer], 'admin-aut')).toEqual([
      [9.47997, 46.431817],
      [16.979667, 49.039074],
    ]);
    expect(layerBounds([layer], 'missing')).toBeUndefined();
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
});
