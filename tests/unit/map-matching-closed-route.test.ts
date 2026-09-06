import { createProjectStore } from '../../src/app/store';
import { createDefaultRouteAppearance, createNewProjectDocument, type ContentLayer, type MapMatchingInput } from '../../src/domain/project';
import { parseProjectFileText } from '../../src/domain/projectFile';
import { routeLayerValidationError } from '../../src/domain/routeModel';
import { MAX_PROJECT_FILE_BYTES, utf8Bytes } from '../../src/domain/projectSerialization';
import { byteBudgetProject } from '../fixtures/portableBudget';

const a: [number, number] = [16.35, 48.2], b: [number, number] = [16.38, 48.22], c: [number, number] = [16.4, 48.2];
const matched: [number, number][] = [a, b, [16.395, 48.205], c, a];

function route(): ContentLayer {
  return {
    id: 'route-01', name: 'Closed route', type: 'route', visible: true, locked: false, opacity: 80,
    route: { kind: 'straight', closed: true }, geometry: { type: 'LineString', coordinates: [a, b, c, a] },
    appearance: { ...createDefaultRouteAppearance(3), segmentStyles: [
      { color: '#ff0000', width: 7, strokeStyle: 'dashed' }, { color: '#00aa00' }, { color: '#0000ff', width: 5 },
    ] },
  };
}

function harness(layer = route()) {
  const document = createNewProjectDocument();
  document.layers.unshift(layer);
  const store = createProjectStore(document);
  store.getState().selectLayer(layer.id);
  store.getState().renameLayer(layer.id, 'Redo must survive rejection');
  store.getState().undo();
  const apply = (geometry: MapMatchingInput['geometry'], sourcePointCount = 4) => store.getState().applyMapMatching(layer.id, {
    geometry, profile: 'walking', confidence: 0.93, sourcePointCount,
  }, store.getState().documentEpoch);
  return { store, apply };
}

it('applies an exact loop without opening or double-closing it, and round-trips one atomic undo/redo', () => {
  const test = harness();
  const before = test.store.getState();
  const incoming = JSON.stringify(matched);
  expect(test.apply(matched)).toMatchObject({ ok: true });
  const after = test.store.getState().document;
  const layer = after.layers[0];
  expect(layer.route).toEqual({ kind: 'straight', closed: true });
  expect(layer.geometry).toEqual({ type: 'LineString', coordinates: matched });
  expect(layer.appearance).toMatchObject({ segmentStyles: [
    { color: '#ff0000', width: 7, strokeStyle: 'dashed' }, null, null, { color: '#0000ff', width: 5 },
  ] });
  expect(layer.provenance).toEqual({
    provider: 'mapbox', service: 'map-matching-v5', profile: 'walking', confidence: 0.93, sourcePointCount: 4,
  });
  expect(routeLayerValidationError(layer)).toBeNull();
  expect(parseProjectFileText(JSON.stringify(after))).toEqual(after);
  expect(after.camera).toBe(before.document.camera);
  expect(test.store.getState().selectedId).toBe(before.selectedId);
  expect(test.store.getState().past).toHaveLength(1);
  test.store.getState().undo();
  expect(test.store.getState().document).toEqual(before.document);
  test.store.getState().redo();
  expect(test.store.getState().document).toEqual(after);
  expect(JSON.stringify(matched)).toBe(incoming);
});

it('recognizes closure only after the existing six-decimal normalization', () => {
  const test = harness();
  expect(test.apply([[16.3500001, 48.2000001], b, c, [16.3500004, 48.2000004]])).toMatchObject({ ok: true });
  expect(test.store.getState().document.layers[0].geometry).toEqual({ type: 'LineString', coordinates: [a, b, c, a] });
});

it.each([
  { label: 'longitude mismatch', points: [a, b, c, [16.350001, 48.2]] },
  { label: 'latitude mismatch', points: [a, b, c, [16.35, 48.200001]] },
  { label: 'missing closing alias', points: [a, b, c] },
  { label: 'rounding outside closure', points: [a, b, c, [16.3500006, 48.2]] },
])('rejects $label without adding a connector or losing history', ({ points }) => {
  const test = harness();
  const before = test.store.getState(), writes = vi.fn();
  const unsubscribe = test.store.subscribe(writes);
  expect(test.apply(points as [number, number][])).toMatchObject({
    ok: false, error: expect.stringMatching(/does not close.*closed route was kept.*Open loop/),
  });
  expect(test.store.getState()).toBe(before);
  expect(before.canRedo).toBe(true);
  expect(writes).not.toHaveBeenCalled();
  unsubscribe();
});

it.each([
  [a, b, c, b, a],
  [a, b, c, a, a],
  [a, b, [16.3800001, 48.2200001], c, a],
  [a, b, a],
])('does not hide invalid repeated or insufficient semantic points (%j)', (...points) => {
  const test = harness(), before = test.store.getState();
  expect(test.apply(points as [number, number][])).toMatchObject({ ok: false });
  expect(test.store.getState()).toBe(before);
});

it.each([
  { points: [[null, 48], b] }, { points: [['16.35', 48], b] },
  { points: [[Infinity, 48], b] }, { points: [[181, 48], b] },
])('rejects malformed coordinates without throwing ($points)', ({ points }) => {
  const test = harness(), before = test.store.getState();
  expect(test.apply(points as unknown as [number, number][])).toMatchObject({ ok: false });
  expect(test.store.getState()).toBe(before);
});

it('retains open-route topology and rejects an unsolicited closing alias', () => {
  const layer = route();
  layer.route = { kind: 'straight', closed: false };
  layer.geometry = { type: 'LineString', coordinates: [a, b, c] };
  if (layer.appearance?.kind === 'route') layer.appearance.segmentStyles.pop();
  const test = harness(layer), before = test.store.getState();
  expect(test.apply([a, b, c, a], 3)).toMatchObject({ ok: false, error: expect.stringContaining('Open routes') });
  expect(test.store.getState()).toBe(before);
  expect(test.apply([a, b, [16.395, 48.205], c], 3)).toMatchObject({ ok: true });
  expect(test.store.getState().document.layers[0].route).toEqual({ kind: 'straight', closed: false });
});

it('still accepts the minimum two-point open route', () => {
  const layer = route();
  layer.route = { kind: 'straight', closed: false };
  layer.geometry = { type: 'LineString', coordinates: [a, b] };
  layer.appearance = createDefaultRouteAppearance(1);
  const test = harness(layer);
  expect(test.apply([a, c], 2)).toMatchObject({ ok: true });
  expect(test.store.getState().document.layers[0]).toMatchObject({
    route: { kind: 'straight', closed: false },
    geometry: { type: 'LineString', coordinates: [a, c] },
    provenance: { sourcePointCount: 2 },
  });
});

it.each(['locked', 'hidden', 'stale'] as const)('keeps %s matches non-mutating', (guard) => {
  const test = harness();
  switch (guard) {
  case 'locked': {
  test.store.getState().toggleLayerLock('route-01');
  break;
  }
  case 'hidden': {
  test.store.getState().toggleLayerVisibility('route-01');
  break;
  }
  case 'stale': { {
  test.store.getState().openDocument(createNewProjectDocument());
  // No default
  }
  break;
  }
  }
  const before = test.store.getState();
  expect(before.applyMapMatching('route-01', { geometry: matched, profile: 'walking', sourcePointCount: 4 }, 0)).toMatchObject({ ok: false });
  expect(test.store.getState()).toBe(before);
});

it('counts the closing alias in the 100-point input contract and respects the 50,000-position output boundary', () => {
  const layer = route();
  const trace: [number, number][] = Array.from({ length: 99 }, (_, index) => [16 + index / 1000, 48]);
  trace.push([...trace[0]]);
  layer.geometry = { type: 'LineString', coordinates: trace };
  layer.appearance = createDefaultRouteAppearance(99);
  const test = harness(layer);
  expect(test.apply(trace, 100)).toMatchObject({ ok: true });
  const before = test.store.getState();
  expect(test.apply(trace, 101)).toMatchObject({ ok: false });
  expect(test.apply(trace, 1)).toMatchObject({ ok: false });
  expect(test.store.getState()).toBe(before);
  const output: [number, number][] = Array.from({ length: 49_999 }, (_, index) => [16 + index / 100_000, 48]);
  output.push([...output[0]]);
  expect(test.apply(output, 100)).toMatchObject({ ok: true });
  const atLimit = test.store.getState();
  expect(test.apply([...output, output[0]], 100)).toMatchObject({ ok: false });
  expect(test.store.getState()).toBe(atLimit);
}, 30_000);

it('retains exact byte-limit admission and redo when valid matching provenance exceeds capacity', () => {
  const layer = route();
  const document = byteBudgetProject(MAX_PROJECT_FILE_BYTES - utf8Bytes(JSON.stringify(layer)) - 1);
  document.layers.unshift(layer);
  expect(utf8Bytes(JSON.stringify(document))).toBe(MAX_PROJECT_FILE_BYTES);
  const store = createProjectStore(document);
  store.getState().setProjectTitle(document.title.replace('X', 'Y'));
  store.getState().undo();
  const before = store.getState(), writes = vi.fn();
  const unsubscribe = store.subscribe(writes);
  expect(before.applyMapMatching(layer.id, { geometry: matched, profile: 'walking', sourcePointCount: 4 }, 0))
    .toMatchObject({ ok: false, code: 'capacity' });
  expect(store.getState()).toBe(before);
  expect(before.canRedo).toBe(true);
  expect(writes).not.toHaveBeenCalled();
  unsubscribe();
}, 30_000);
