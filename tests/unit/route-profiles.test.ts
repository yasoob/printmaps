import { describe, expect, it } from 'vitest';
import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';
import { buildRouteCoordinates } from '../../src/domain/routeProfiles';
import { mapLayerDescriptors } from '../../src/map/MapContentLayerRendering';

describe('expert route geometry', () => {
  it('expands an arc between waypoints while preserving exact endpoints', () => {
    const waypoints = [[-0.1276, 51.5072], [139.6917, 35.6895]] as const;

    const coordinates = buildRouteCoordinates(waypoints, 'arc');

    expect(coordinates.length).toBeGreaterThan(waypoints.length);
    expect(coordinates[0]).toEqual(waypoints[0]);
    expect(coordinates.at(-1)).toEqual(waypoints[1]);
    expect(coordinates[Math.floor(coordinates.length / 2)]?.[1]).toBeGreaterThan(60);
  });

  it('creates an arc route with its selected travel profile and printable marker state', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const waypoints = [[-0.1276, 51.5072], [139.6917, 35.6895]] as const;

    store.getState().createRoute(waypoints, {
      lineShape: 'arc',
      travelProfile: 'air',
      showTravelModeIcon: true,
    });

    const route = store.getState().document.layers.find(({ id }) => id === 'route-02');
    expect(route?.appearance).toEqual({
      kind: 'route',
      color: '#d9363e',
      width: 4,
      travelProfile: 'air',
      showTravelModeIcon: true,
    });
    expect(route?.geometry?.type).toBe('LineString');
    if (route?.geometry?.type !== 'LineString') throw new Error('Route geometry unavailable');
    expect(route.geometry.coordinates.length).toBeGreaterThan(waypoints.length);
  });

  it('renders an enabled travel profile as a centered live-map marker', () => {
    const route = createInitialProjectDocument().layers[0];
    route.appearance = {
      kind: 'route',
      color: '#d9363e',
      width: 4,
      travelProfile: 'air',
      showTravelModeIcon: true,
    };

    const descriptors = mapLayerDescriptors(route, { selectedId: null, previewedId: null });

    expect(descriptors).toContainEqual(expect.objectContaining({
      type: 'symbol',
      layout: expect.objectContaining({
        'symbol-placement': 'line-center',
        'text-field': 'AIR',
      }),
    }));
  });

  it.each([
    ['antipodal', [[0, 0], [180, 0]]],
    ['near-antipodal', [[0, 0], [179.999999, 0]]],
  ] as const)('refuses an unstable %s arc segment', (_label, waypoints) => {
    expect(buildRouteCoordinates(waypoints, 'arc')).toEqual([]);
  });

  it.each([
    ['unsupported line shape', { lineShape: 'curved', travelProfile: 'air', showTravelModeIcon: true }],
    ['unsupported travel profile', { lineShape: 'arc', travelProfile: 'rocket', showTravelModeIcon: true }],
    ['non-boolean marker state', { lineShape: 'arc', travelProfile: 'air', showTravelModeIcon: 'yes' }],
  ])('rejects $label without changing canonical history', (_label, options) => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().createRoute([[0, 0], [10, 10]], options as never);

    expect(store.getState().document.layers.some(({ id }) => id === 'route-02')).toBe(false);
    expect(store.getState().canUndo).toBe(false);
  });
});
