import { createProjectStore } from '../../src/app/store';
import { createDefaultRouteAppearance, createNewProjectDocument, type ContentLayer } from '../../src/domain/project';
import { semanticRoutePoints } from '../../src/domain/routeModel';
import { convertRoute } from '../../src/domain/routeTransformations';
import { createArcGeometry } from '../../src/domain/routeArcGeometry';
import { moveRouteSemanticPoints } from '../../src/domain/routePointMovement';
import { MAX_PROJECT_FILE_BYTES, utf8Bytes } from '../../src/domain/projectSerialization';
import { byteBudgetProject } from '../fixtures/portableBudget';
import { editedRouteVertexCoordinates } from '../../src/map/RouteVertexCoordinates';

function route(kind: 'straight' | 'arc', isClosed = true): ContentLayer {
  const points: [number, number][] = [[16.35, 48.2], [16.38, 48.22], [16.4, 48.2]];
  if (isClosed) points.push([...points[0]]);
  const appearance = createDefaultRouteAppearance(points.length - 1);
  const styles: typeof appearance.segmentStyles = [
    { color: '#ff0000', width: 7, strokeStyle: 'dashed' },
    { color: '#00aa00', width: 3, strokeStyle: 'solid' },
    { color: '#0000ff', width: 5, strokeStyle: 'dashed' },
  ];
  appearance.segmentStyles = styles.slice(0, points.length - 1);
  return {
    id: 'route-01', name: 'Styled route', type: 'route', visible: true, locked: false, opacity: 80,
    route: { kind, closed: isClosed }, appearance,
    geometry: kind === 'arc'
      ? createArcGeometry(points, [0.7, -0.4, 0.9].slice(0, points.length - 1))!
      : { type: 'LineString', coordinates: points },
  };
}

function harness(kind: 'straight' | 'arc', isClosed = true) {
  const document = createNewProjectDocument();
  document.layers.unshift(route(kind, isClosed));
  const store = createProjectStore(document);
  const current = () => store.getState().document.layers.find(({ id }) => id === 'route-01')!;
  return { store, current };
}

function expectAppearance(before: ContentLayer, after: ContentLayer) {
  expect(after.appearance).toBe(before.appearance);
  if (before.geometry?.type === 'Arc' && after.geometry?.type === 'Arc') {
    expect(after.geometry.curvatures).toEqual(before.geometry.curvatures);
  }
}

const moves = (['straight', 'arc'] as const).flatMap((kind) => [true, false].flatMap((isClosed) => (
  [0, 1, isClosed ? 3 : 2].flatMap((index) => [0, 1].map((axis) => ({ kind, isClosed, index, axis })))
)));

it.each(moves)('retains logical legs for $kind closed=$isClosed vertex=$index axis=$axis with exact Undo/Redo', ({ kind, isClosed, index, axis }) => {
  const test = harness(kind, isClosed);
  const before = test.store.getState().document;
  const original = test.current();
  const originalJson = JSON.stringify(original);
  const point = [...semanticRoutePoints(original)![index]] as [number, number];
  point[axis] += 0.0005;
  expect(test.store.getState().setRouteVertex(original.id, index, point).ok).toBe(true);
  expectAppearance(original, test.current());
  expect(semanticRoutePoints(test.current())![index]).toEqual(point);
  if (isClosed) expect(semanticRoutePoints(test.current())![0]).toEqual(semanticRoutePoints(test.current())!.at(-1));
  const after = test.store.getState().document;
  expect(test.store.getState().past).toHaveLength(1);
  test.store.getState().undo();
  expect(test.store.getState().document).toEqual(before);
  test.store.getState().redo();
  expect(test.store.getState().document).toEqual(after);
  expect(JSON.stringify(original)).toBe(originalJson);
});

it.each(['straight', 'arc'] as const)('retains %s leg identity through complete and unique-point native replacements', (kind) => {
  for (const hasClosingCopy of [true, false]) {
    const test = harness(kind);
    const original = test.current();
    const points = semanticRoutePoints(original)!.map((point) => [...point] as [number, number]);
    points[0] = [16.345, 48.205];
    points[1] = [16.385, 48.225];
    points[points.length - 1] = [...points[0]];
    expect(test.store.getState().replaceRouteGeometry(original.id, hasClosingCopy ? points : points.slice(0, -1)).ok).toBe(true);
    expectAppearance(original, test.current());
    expect(semanticRoutePoints(test.current())).toEqual(points);
  }
});

it.each(['straight', 'arc'] as const)('remaps %s insertion, deletion, reversal and close/open instead of preserving the wrong indices', (kind) => {
  const test = harness(kind);
  const initial = test.current();
  if (initial.appearance?.kind !== 'route') throw new Error('Expected route appearance');
  const styles = initial.appearance.segmentStyles;
  const points = semanticRoutePoints(initial)!;
  const inserted = [points[0], [16.36, 48.205] as [number, number], ...points.slice(1)];
  expect(test.store.getState().replaceRouteGeometry(initial.id, inserted).ok).toBe(true);
  expect(test.current().appearance).toMatchObject({ segmentStyles: [styles[0], styles[0], styles[1], styles[2]] });
  if (kind === 'arc') expect(test.current().geometry).toMatchObject({ curvatures: [0.7, 0.7, -0.4, 0.9] });
  expect(test.store.getState().replaceRouteGeometry(initial.id, points).ok).toBe(true);
  expect(test.current().appearance).toMatchObject({ segmentStyles: styles });
  if (kind === 'arc') expect(test.current().geometry).toMatchObject({ curvatures: [0.35, -0.4, 0.9] });
  const transform = (type: 'reverse' | 'open' | 'close') => test.store.getState().transformRoute({
    id: initial.id, operation: { type }, expectedDocumentEpoch: 0, expectedLayer: test.current(),
  });
  expect(transform('reverse').ok).toBe(true);
  expect(test.current().appearance).toMatchObject({ segmentStyles: [styles[2], styles[1], styles[0]] });
  if (kind === 'arc') expect(test.current().geometry).toMatchObject({ curvatures: [0.9, -0.4, 0.35] });
  expect(transform('open').ok).toBe(true);
  expect(test.current().appearance).toMatchObject({ segmentStyles: [styles[2], styles[1]] });
  expect(transform('close').ok).toBe(true);
  expect(test.current().appearance).toMatchObject({ segmentStyles: [styles[2], styles[1], null] });
});

it('retains pair-based semantics for actual reordered snapshots with unchanged point count', () => {
  const test = harness('arc');
  const before = test.current();
  const points = semanticRoutePoints(before)!;
  expect(test.store.getState().replaceRouteGeometry(before.id, [points[0], points[2], points[1], points[0]]).ok).toBe(true);
  if (before.appearance?.kind !== 'route') throw new Error('Expected route appearance');
  const styles = before.appearance.segmentStyles;
  expect(test.current().appearance).toMatchObject({ segmentStyles: [styles[2], styles[1], styles[0]] });
  expect(test.current().geometry).toMatchObject({ curvatures: [0.9, -0.4, 0.7] });
});

it('keeps Road rerouting on logical legs and never mutates shared appearance when its marker changes', () => {
  const local = route('straight');
  const waypoints = semanticRoutePoints(local)!.map((point) => [...point] as [number, number]);
  const input = { waypoints, geometry: waypoints, profile: 'walking' as const, distanceMeters: 500, durationSeconds: 60 };
  const road = convertRoute(local, 'road', input)!;
  const document = createNewProjectDocument();
  document.layers.unshift(road);
  const store = createProjectStore(document);
  const before = store.getState().document.layers[0];
  const next = waypoints.map((point) => [...point] as [number, number]);
  next[0] = [16.345, 48.205];
  next[next.length - 1] = [...next[0]];
  const result = store.getState().replaceDirectionsRoute({
    id: before.id, expectedLayer: before, expectedDocumentEpoch: 0,
    input: { ...input, waypoints: next, geometry: next },
    options: { lineShape: 'road', roadTravelMode: 'walk', travelMarker: 'walk' },
  });
  expect(result.ok).toBe(true);
  const after = store.getState().document.layers[0];
  expect(after.appearance).toMatchObject({ segmentStyles: road.appearance.segmentStyles, marker: { pictogram: 'walk' } });
  expect(before.appearance?.kind === 'route' && before.appearance.marker).toBeNull();
  expect(semanticRoutePoints(after)).toEqual(next);
});

it('rejects invalid movement and attempted topology changes through the coordinate-only operation', () => {
  const source = route('arc');
  const points = semanticRoutePoints(source)!.slice(0, -1);
  expect(moveRouteSemanticPoints(source, points.slice(1))).toBeNull();
  expect(moveRouteSemanticPoints(source, [points[0], points[0], points[2]])).toBeNull();
  expect(moveRouteSemanticPoints(source, [[181, 0], ...points.slice(1)])).toBeNull();
});

it.each([0, 3])('keeps fallback native vertex %i edits closed, including no-op and invalid requests', (index) => {
  const source = route('arc');
  const points = semanticRoutePoints(source)!;
  expect(editedRouteVertexCoordinates(source, index, [16.345, 48.205])).toEqual([
    [16.345, 48.205], points[1], points[2], [16.345, 48.205],
  ]);
  expect(editedRouteVertexCoordinates(source, index, points[index])).toEqual(points);
  expect(editedRouteVertexCoordinates(source, index, [181, 0])).toBeNull();
  expect(editedRouteVertexCoordinates(source, 100, [0, 0])).toBeNull();
});

it.each(['locked', 'hidden'] as const)('keeps canonical geometry, appearance and history unchanged while %s', (guard) => {
  const test = harness('arc');
  if (guard === 'locked') test.store.getState().toggleLayerLock('route-01');
  else test.store.getState().toggleLayerVisibility('route-01');
  const before = test.store.getState();
  expect(before.setRouteVertex('route-01', 0, [16.345, 48.205]).ok).toBe(false);
  expect(before.replaceRouteGeometry('route-01', [[16.345, 48.205], [16.38, 48.22], [16.4, 48.2], [16.345, 48.205]]).ok).toBe(false);
  expect(test.store.getState()).toBe(before);
});

it('rejects growing closed-coordinate moves at the exact portable byte limit without losing styles or redo', () => {
  const layer = route('arc');
  const document = byteBudgetProject(MAX_PROJECT_FILE_BYTES - utf8Bytes(JSON.stringify(layer)) - 1);
  document.layers.unshift(layer);
  expect(utf8Bytes(JSON.stringify(document))).toBe(MAX_PROJECT_FILE_BYTES);
  const store = createProjectStore(document);
  store.getState().setProjectTitle(document.title.replace('X', 'Y'));
  store.getState().undo();
  const before = store.getState();
  const changed = vi.fn();
  const unsubscribe = store.subscribe(changed);
  expect(before.setRouteVertex(layer.id, 0, [16.350001, 48.200001])).toMatchObject({ ok: false, code: 'capacity' });
  expect(before.replaceRouteGeometry(layer.id, [[16.350001, 48.200001], [16.38, 48.22], [16.4, 48.2], [16.350001, 48.200001]])).toMatchObject({ ok: false, code: 'capacity' });
  expect(store.getState()).toBe(before);
  expect(before.canRedo).toBe(true);
  expect(changed).not.toHaveBeenCalled();
  unsubscribe();
}, 30_000);
