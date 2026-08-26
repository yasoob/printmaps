import { describe, expect, it } from 'vitest';
import { createInitialProjectDocument } from '../../src/domain/project';
import { routeArcData } from '../../src/map/RouteArcRendering';

describe('route arc rendering', () => {
  it('derives curved display segments from canonical adjacent anchors', () => {
    const document = createInitialProjectDocument();
    const route = document.layers[0];
    if (route.appearance?.kind !== 'route') throw new Error('Route appearance unavailable');
    route.geometry = { type: 'Arc', anchors: [[16.326, 48.194], [16.429, 48.226]] };
    route.appearance = { ...route.appearance, color: '#123456', width: 5 };
    route.opacity = 60;

    const data = routeArcData(document.layers, { selectedId: route.id, previewedId: null });

    expect(data).toHaveLength(1);
    expect(data[0]).toEqual({
      id: 'route-01:0',
      layerId: 'route-01',
      source: [16.326, 48.194],
      target: [16.429, 48.226],
      color: [18, 52, 86, 153],
      width: 7,
    });
  });

  it('uses the established default appearance for a valid Arc route without appearance', () => {
    const document = createInitialProjectDocument();
    const route = document.layers[0];
    route.geometry = { type: 'Arc', anchors: [[16.326, 48.194], [16.429, 48.226]] };
    delete route.appearance;

    expect(routeArcData(document.layers, { selectedId: null, previewedId: null })).toEqual([{
      id: 'route-01:0',
      layerId: 'route-01',
      source: [16.326, 48.194],
      target: [16.429, 48.226],
      color: [217, 54, 62, 255],
      width: 4,
    }]);
  });

  it('excludes hidden, straight, and malformed route layers', () => {
    const document = createInitialProjectDocument();
    const route = document.layers[0];
    if (route.appearance?.kind !== 'route') throw new Error('Route appearance unavailable');
    route.visible = false;
    route.geometry = { type: 'Arc', anchors: [[0, 0], [1, 1]] };
    const straight = { ...route, id: 'straight', visible: true, geometry: { type: 'LineString' as const, coordinates: [[0, 0], [1, 1]] as [number, number][] } };
    const malformed = { ...route, id: 'malformed', visible: true, geometry: { type: 'Point' as const, coordinates: [1, 2] as [number, number] } };

    expect(routeArcData([route, straight, malformed], { selectedId: null, previewedId: null })).toEqual([]);
  });
});
