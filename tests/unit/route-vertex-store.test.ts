import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';
import { routeLayerValidationError } from '../../src/domain/routeModel';

const routeGeometry = (store: ReturnType<typeof createProjectStore>) => (
  store.getState().document.layers.find((layer) => layer.id === 'route-01')?.geometry
);

describe('route vertex structure history', () => {
  it('edits, inserts, removes, and flips Arc segments as single history steps', () => {
    const document = createInitialProjectDocument();
    const route = document.layers.find((layer) => layer.id === 'route-01')!;
    route.geometry = {
      type: 'Arc',
      anchors: [[0, 0], [1, 0], [2, 0]],
      curvatures: [0.2, -0.4],
    };
    route.route = { kind: 'arc', closed: false };
    if (route.appearance?.kind === 'route') route.appearance.segmentStyles = [null, null];
    const store = createProjectStore(document);

    store.getState().setArcSegmentCurvature('route-01', 0, -0.2);
    expect(routeGeometry(store)).toMatchObject({ curvatures: [-0.2, -0.4] });
    expect(store.getState().past).toHaveLength(1);
    store.getState().insertRouteVertex('route-01', 0);
    expect(routeGeometry(store)).toMatchObject({ curvatures: [-0.2, -0.2, -0.4] });
    expect(store.getState().past).toHaveLength(2);
    store.getState().removeRouteVertex('route-01', 1);
    expect(routeGeometry(store)).toMatchObject({ curvatures: [0.35, -0.4] });
    expect(store.getState().past).toHaveLength(3);
    store.getState().undo();
    expect(routeGeometry(store)).toMatchObject({ curvatures: [-0.2, -0.2, -0.4] });
  });

  it('inserts a midpoint after one route vertex as a single undoable edit', () => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().insertRouteVertex('route-01', 1);

    expect(routeGeometry(store)).toEqual({
      type: 'LineString',
      coordinates: [[16.326, 48.194], [16.353, 48.205], [16.372, 48.21], [16.391, 48.215], [16.429, 48.226]],
    });
    store.getState().undo();
    expect(routeGeometry(store)).toEqual({
      type: 'LineString',
      coordinates: [[16.326, 48.194], [16.353, 48.205], [16.391, 48.215], [16.429, 48.226]],
    });
  });

  it('inserts a dragged map coordinate as one undoable route edit', () => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().insertRouteVertex('route-01', 0, [16.34, 48.2]);

    expect(routeGeometry(store)).toEqual({
      type: 'LineString',
      coordinates: [[16.326, 48.194], [16.34, 48.2], [16.353, 48.205], [16.391, 48.215], [16.429, 48.226]],
    });
    expect(store.getState().past).toHaveLength(1);
  });

  it('replaces all Terra Draw anchors as one undoable geometry transaction', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const anchors = [[16.3, 48.1], [16.4, 48.3], [16.5, 48.2]] as const;

    store.getState().replaceRouteGeometry('route-01', anchors);

    expect(routeGeometry(store)).toEqual({ type: 'LineString', coordinates: anchors });
    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(routeGeometry(store)).toEqual({
      type: 'LineString',
      coordinates: [[16.326, 48.194], [16.353, 48.205], [16.391, 48.215], [16.429, 48.226]],
    });
  });

  it('removes one route vertex without allowing a route below two positions', () => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().removeRouteVertex('route-01', 1);

    expect(routeGeometry(store)).toEqual({
      type: 'LineString',
      coordinates: [[16.326, 48.194], [16.391, 48.215], [16.429, 48.226]],
    });
    store.getState().removeRouteVertex('route-01', 1);
    store.getState().removeRouteVertex('route-01', 1);
    expect(routeGeometry(store)).toEqual({
      type: 'LineString',
      coordinates: [[16.326, 48.194], [16.429, 48.226]],
    });
  });

  it.each([
    ['insert after the final vertex', 'insertRouteVertex', 3],
    ['insert after a missing vertex', 'insertRouteVertex', 9],
    ['remove a missing vertex', 'removeRouteVertex', 9],
  ] as const)('rejects an attempt to %s', (_label, action, vertexIndex) => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState()[action]('route-01', vertexIndex);

    expect(store.getState().canUndo).toBe(false);
  });

  it('inserts a midpoint on the short side of an antimeridian segment', () => {
    const document = createInitialProjectDocument();
    const route = document.layers.find((layer) => layer.id === 'route-01')!;
    route.geometry = { type: 'LineString', coordinates: [[179, 0], [-179, 0]] };
    if (route.appearance?.kind === 'route') route.appearance.segmentStyles = [null];
    const store = createProjectStore(document);

    store.getState().insertRouteVertex('route-01', 0);

    expect(routeGeometry(store)).toEqual({
      type: 'LineString',
      coordinates: [[179, 0], [180, 0], [-179, 0]],
    });
  });

  it('rejects removal when it would leave fewer than two distinct route positions', () => {
    const document = createInitialProjectDocument();
    const route = document.layers.find((layer) => layer.id === 'route-01')!;
    route.geometry = { type: 'LineString', coordinates: [[0, 0], [1, 1], [0, 0]] };
    const store = createProjectStore(document);

    store.getState().removeRouteVertex('route-01', 1);

    expect(store.getState().canUndo).toBe(false);
    expect(routeGeometry(store)).toEqual(route.geometry);
  });

  it('keeps schema-25 styles and closure canonical across legacy geometry actions', () => {
    const document = createInitialProjectDocument();
    const route = document.layers.find((layer) => layer.id === 'route-01')!;
    route.geometry = {
      type: 'LineString',
      coordinates: [[0, 0], [1, 0], [1, 1], [0, 0]],
    };
    route.route = { kind: 'straight', closed: true };
    if (route.appearance?.kind !== 'route') throw new Error('Expected route appearance.');
    route.appearance.segmentStyles = [{ color: '#123456' }, null, { width: 8 }];
    const store = createProjectStore(document);

    store.getState().insertRouteVertex('route-01', 2);
    let updated = store.getState().document.layers.find((layer) => layer.id === 'route-01')!;
    expect(updated.appearance?.kind === 'route' ? updated.appearance.segmentStyles : []).toEqual([
      { color: '#123456' },
      null,
      { width: 8 },
      { width: 8 },
    ]);
    expect(routeLayerValidationError(updated)).toBeNull();

    store.getState().setRouteVertex('route-01', 0, [-1, 0]);
    updated = store.getState().document.layers.find((layer) => layer.id === 'route-01')!;
    expect(updated.geometry).toMatchObject({
      coordinates: [[-1, 0], [1, 0], [1, 1], [0.5, 0.5], [-1, 0]],
    });
    expect(updated.appearance?.kind === 'route' ? updated.appearance.segmentStyles : []).toEqual([
      null,
      null,
      { width: 8 },
      null,
    ]);
    expect(routeLayerValidationError(updated)).toBeNull();

    const historyLength = store.getState().past.length;
    store.getState().replaceRouteGeometry('route-01', [[0, 0], [1, 0], [1, 0], [0, 0]]);
    expect(store.getState().past).toHaveLength(historyLength);
    expect(routeLayerValidationError(updated)).toBeNull();
  });

  it('preserves open-route appearance identity when a vertex moves', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const before = store.getState().document.layers
      .find(({ id }) => id === 'route-01')?.appearance;

    store.getState().setRouteVertex('route-01', 1, [16.4, 48.25]);

    const after = store.getState().document.layers
      .find(({ id }) => id === 'route-01')?.appearance;
    expect(after).toBe(before);
  });

  it.each(['locked', 'hidden'] as const)('rejects every route geometry edit while the route is %s', (state) => {
    const document = createInitialProjectDocument();
    const route = document.layers.find((layer) => layer.id === 'route-01')!;
    if (state === 'locked') route.locked = true;
    else route.visible = false;
    const originalGeometry = route.geometry;
    const store = createProjectStore(document);

    store.getState().setRouteVertex('route-01', 1, [16.4, 48.25]);
    store.getState().insertRouteVertex('route-01', 1);
    store.getState().removeRouteVertex('route-01', 1);

    expect(store.getState().canUndo).toBe(false);
    expect(routeGeometry(store)).toEqual(originalGeometry);
  });
});
