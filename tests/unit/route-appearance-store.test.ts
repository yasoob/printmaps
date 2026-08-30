import { createInitialProjectDocument } from '../../src/domain/project';
import { createProjectStore } from '../../src/app/store';

describe('route appearance store actions', () => {
  it('commits marker and one semantic-leg style atomically with undo', () => {
    const store = createProjectStore(createInitialProjectDocument());
    store.getState().setRouteMarker('route-01', {
      pictogram: 'walk',
      placement: { type: 'fraction', fraction: 0.25 },
      orientToPath: true,
      reverseFacing: true,
    });
    let route = store.getState().document.layers.find(({ id }) => id === 'route-01')!;
    expect(route.appearance?.kind === 'route' && route.appearance.marker).toEqual({
      pictogram: 'walk',
      placement: { type: 'fraction', fraction: 0.25 },
      orientToPath: true,
      reverseFacing: true,
    });
    expect(store.getState().past).toHaveLength(1);

    store.getState().setRouteSegmentStyle('route-01', 1, {
      color: '#123456',
      width: 8,
      strokeStyle: 'dashed',
    });
    route = store.getState().document.layers.find(({ id }) => id === 'route-01')!;
    expect(route.appearance?.kind === 'route' && route.appearance.segmentStyles).toEqual([
      null,
      { color: '#123456', width: 8, strokeStyle: 'dashed' },
      null,
    ]);
    expect(store.getState().past).toHaveLength(2);
    store.getState().undo();
    route = store.getState().document.layers.find(({ id }) => id === 'route-01')!;
    expect(route.appearance?.kind === 'route' && route.appearance.segmentStyles).toEqual([null, null, null]);
  });

  it('rejects out-of-range or schema-invalid updates without history', () => {
    const store = createProjectStore(createInitialProjectDocument());
    store.getState().setRouteSegmentStyle('route-01', 99, { width: 8 });
    store.getState().setRouteSegmentStyle('route-01', 0, {});
    store.getState().setRouteMarker('route-01', {
      pictogram: 'air',
      placement: { type: 'repeat', spacing: 0 },
      orientToPath: true,
      reverseFacing: false,
    });
    expect(store.getState().past).toHaveLength(0);
  });
});
