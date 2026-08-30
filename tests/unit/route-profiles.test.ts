import { describe, expect, it } from 'vitest';
import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';
import { buildRouteCoordinates } from '../../src/domain/routeProfiles';
import { mapLayerDescriptors } from '../../src/map/MapContentLayerRendering';

describe('expert route geometry', () => {
  it('keeps an arc as canonical endpoint anchors without sampled subdivisions', () => {
    const waypoints = [[16.3, 48.2], [16.5, 48.2]] as const;

    const coordinates = buildRouteCoordinates(waypoints, 'arc');

    expect(coordinates).toEqual(waypoints);
  });

  it('creates an arc route with its selected decorative marker', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const waypoints = [[-0.1276, 51.5072], [139.6917, 35.6895]] as const;

    store.getState().createRoute(waypoints, {
      lineShape: 'arc',
      roadTravelMode: 'car',
      travelMarker: 'air',
    });

    const route = store.getState().document.layers.find(({ id }) => id === 'route-02');
    expect(route?.appearance).toEqual({
      kind: 'route',
      color: '#d9363e',
      width: 4,
      strokeStyle: 'solid',
      marker: { pictogram: 'air', placement: { type: 'center' }, orientToPath: true, reverseFacing: false },
      segmentStyles: [null],
    });
    expect(route?.geometry).toEqual({ type: 'Arc', anchors: waypoints, curvatures: [0.35] });
  });

  it('renders an enabled travel profile as a centered live-map marker', () => {
    const route = createInitialProjectDocument().layers[0];
    route.route = { kind: 'arc', closed: false };
    route.geometry = { type: 'Arc', anchors: [[16.3, 48.2], [16.5, 48.2]], curvatures: [0.35] };
    route.appearance = {
      kind: 'route',
      color: '#d9363e',
      width: 4,
      strokeStyle: 'solid',
      marker: { pictogram: 'air', placement: { type: 'center' }, orientToPath: true, reverseFacing: false },
      segmentStyles: [null],
    };

    const descriptors = mapLayerDescriptors(route, { selectedId: null, previewedId: null });

    expect(descriptors).toContainEqual(expect.objectContaining({
      type: 'symbol',
      layout: expect.objectContaining({
        'icon-image': ['get', 'iconImage'],
        'icon-rotate': ['get', 'bearing'],
      }),
    }));
  });

  it.each([
    ['antipodal', [[0, 0], [180, 0]]],
    ['near-antipodal', [[0, 0], [179.999999, 0]]],
  ] as const)('keeps valid %s endpoint anchors without geometric interpolation', (_label, waypoints) => {
    expect(buildRouteCoordinates(waypoints, 'arc')).toEqual(waypoints);
  });

  it.each([
    ['unsupported line shape', { lineShape: 'curved', roadTravelMode: 'car', travelMarker: 'air' }],
    ['unsupported road mode', { lineShape: 'arc', roadTravelMode: 'air', travelMarker: 'air' }],
    ['unsupported marker', { lineShape: 'arc', roadTravelMode: 'car', travelMarker: 'rocket' }],
  ])('rejects $label without changing canonical history', (_label, options) => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().createRoute([[0, 0], [10, 10]], options as never);

    expect(store.getState().document.layers.some(({ id }) => id === 'route-02')).toBe(false);
    expect(store.getState().canUndo).toBe(false);
  });
});
