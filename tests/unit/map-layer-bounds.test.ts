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

  it('computes bounds across every disconnected MultiPolygon part', () => {
    const area = administrativeAreaById('AT-7');
    if (!area) throw new Error('Tyrol fixture unavailable.');
    const layer: ContentLayer = {
      id: 'admin-at-7', name: area.name, type: 'shape', visible: true, locked: false, opacity: 28,
      geometry: area.geometry,
    };

    expect(layerBounds([layer], 'admin-at-7')).toEqual([
      [10.081121, 46.65121],
      [12.951179, 47.732023],
    ]);
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

  it('refuses bounds outside the Web Mercator latitude range', () => {
    const layer: ContentLayer = {
      id: 'polar', name: 'Polar', type: 'poi', visible: true, locked: false, opacity: 100,
      geometry: { type: 'Point', coordinates: [16, 86] },
    };

    expect(combinedLayerBounds([layer])).toBeUndefined();
  });
});
