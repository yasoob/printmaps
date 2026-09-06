import { act, renderHook, waitFor } from '@testing-library/react';
import { useStore } from 'zustand';
import { createProjectStore } from '../../../src/app/store';
import { createDefaultRouteAppearance, createNewProjectDocument, type ContentLayer } from '../../../src/domain/project';
import { convertRoute } from '../../../src/domain/routeTransformations';
import { mutationRejected } from '../../../src/domain/projectMutation';
import { useDirectionsRouteEditing } from '../../../src/app/hooks/useDirectionsRouteEditing';
import type { DirectionsProvider, DirectionsResponse } from '../../../src/services/mapbox/contracts';

function road(isLoop = false): ContentLayer {
  const coordinates: [number, number][] = [[16.35, 48.2], [16.365, 48.215], [16.38, 48.22], [16.39, 48.215], [16.4, 48.2]];
  const waypoints: [number, number][] = [[16.35, 48.2], [16.38, 48.22], [16.4, 48.2]];
  if (isLoop) {
    coordinates.push([16.35, 48.2]);
    waypoints.push([16.35, 48.2]);
  }
  return {
    id: 'road', name: 'Road', type: 'route', visible: true, locked: false, opacity: 100,
    route: { kind: 'road', closed: isLoop }, appearance: createDefaultRouteAppearance(waypoints.length - 1),
    geometry: { type: 'LineString', coordinates },
    provenance: { provider: 'mapbox', service: 'directions-v5', waypoints, profile: 'walking', distanceMeters: 100, durationSeconds: 50 },
  };
}

function deferred() {
  let resolve!: (value: DirectionsResponse) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<DirectionsResponse>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise; reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const response: DirectionsResponse = {
  routes: [{ geometry: [[16.345, 48.2], [16.38, 48.22], [16.4, 48.2]], distanceMeters: 120, durationSeconds: 60 }],
  useBoundary: 'provider-response-use-requires-terms-review',
};

function harness() {
  const document = createNewProjectDocument();
  document.layers.unshift(road());
  const store = createProjectStore(document);
  const directions = vi.fn<DirectionsProvider['directions']>().mockRejectedValue(new Error('Controlled routing failure'));
  const provider = { directions };
  const replace = vi.fn(store.getState().replaceDirectionsRoute);
  const hook = renderHook(() => {
    const layers = useStore(store, (state) => state.document.layers);
    const documentEpoch = useStore(store, (state) => state.documentEpoch);
    return useDirectionsRouteEditing({ layers, documentEpoch, provider, replaceDirectionsRoute: replace });
  });
  const current = () => store.getState().document.layers.find(({ id }) => id === 'road')!;
  const change = () => act(() => {
    expect(hook.result.current.changeWaypoint('road', 0, [16.345, 48.2])).toEqual({ pending: true });
  });
  const transform = (targetKind: 'arc' | 'straight') => act(() => {
    expect(store.getState().transformRoute({
      id: 'road', expectedDocumentEpoch: store.getState().documentEpoch, expectedLayer: current(),
      operation: { type: 'convert', targetKind },
    }).ok).toBe(true);
  });
  return { store, directions, replace, hook, current, change, transform };
}

it('retires a failed Road edit before Arc consumers can reuse its longitude', async () => {
  const test = harness();
  test.change();
  await waitFor(() => expect(test.hook.result.current.error).toBe('Controlled routing failure'));
  expect(test.hook.result.current.pendingWaypoints?.[0]).toEqual([16.345, 48.2]);
  test.transform('arc');
  expect(test.hook.result.current).toMatchObject({ pendingWaypoints: null, pendingLayerId: null, statusLayerId: null, error: null, isRouting: false });
  const canonical = test.current();
  if (canonical.geometry?.type !== 'Arc') throw new Error('Expected Arc');
  const longitude = canonical.geometry.anchors[0][0];
  act(() => {
    expect(test.hook.result.current.changeWaypoint('road', 0, [16.35, 48.205])).toBeNull();
    expect(test.store.getState().setRouteVertex('road', 0, [longitude, 48.205]).ok).toBe(true);
  });
  expect(test.current().geometry).toMatchObject({ type: 'Arc', anchors: [[16.35, 48.205], [16.38, 48.22], [16.4, 48.2]] });
});

it.each(['resolve', 'reject'] as const)('aborts obsolete requests and ignores late provider %s after conversion', async (completion) => {
  const test = harness();
  const request = deferred();
  test.directions.mockReturnValue(request.promise);
  test.change();
  const signal = test.directions.mock.calls[0][0].signal!;
  test.transform('arc');
  const committed = test.store.getState();
  expect(signal.aborted).toBe(true);
  await act(async () => {
    if (completion === 'resolve') request.resolve(response);
    else request.reject(new Error('Late failure'));
  });
  expect(test.replace).not.toHaveBeenCalled();
  expect(test.store.getState()).toBe(committed);
  expect(test.hook.result.current).toMatchObject({ pendingWaypoints: null, error: null, isRouting: false });
});

it('rebases an active response onto current cosmetic metadata without losing pending points', async () => {
  const test = harness();
  const request = deferred();
  test.directions.mockReturnValue(request.promise);
  test.change();
  act(() => {
    test.store.getState().renameLayer('road', 'Renamed Road');
    test.store.getState().setLayerOpacity('road', 75);
    const appearance = test.current().appearance;
    if (appearance?.kind !== 'route') throw new Error('Expected route appearance');
    test.store.getState().setLayerAppearance('road', { ...appearance, color: '#112233', width: 5 });
    test.store.getState().selectLayer('basemap');
  });
  const latest = test.current();
  expect(test.directions.mock.calls[0][0].signal!.aborted).toBe(false);
  expect(test.hook.result.current.pendingWaypoints?.[0]).toEqual([16.345, 48.2]);
  await act(async () => request.resolve(response));
  expect(test.replace).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ expectedLayer: latest }));
  expect(test.current()).toMatchObject({ name: 'Renamed Road', opacity: 75, appearance: { color: '#112233', width: 5 } });
  expect(test.store.getState().selectedId).toBe('basemap');
  expect(test.hook.result.current.pendingWaypoints).toBeNull();
});

it.each(['undo', 'redo', 'replacement', 'deletion'] as const)('retires pending state and late completions on %s', async (operation) => {
  const test = harness();
  act(() => test.store.getState().renameLayer('road', 'Changed'));
  if (operation === 'redo') act(() => test.store.getState().undo());
  const request = deferred();
  test.directions.mockReturnValue(request.promise);
  test.change();
  act(() => {
    switch (operation) {
      case 'undo': { test.store.getState().undo(); break; }
      case 'redo': { test.store.getState().redo(); break; }
      case 'replacement': { test.store.getState().openDocument(test.store.getState().document); break; }
      case 'deletion': { test.store.getState().deleteLayer('road'); break; }
    }
  });
  const canonical = test.store.getState();
  expect(test.directions.mock.calls[0][0].signal!.aborted).toBe(true);
  expect(test.hook.result.current.pendingWaypoints).toBeNull();
  await act(async () => request.resolve(response));
  expect(test.replace).not.toHaveBeenCalled();
  expect(test.store.getState()).toBe(canonical);
});

it('uses fresh Road canonical points after conversion and Undo instead of reviving the old edit', async () => {
  const test = harness();
  test.change();
  await waitFor(() => expect(test.hook.result.current.error).not.toBeNull());
  test.transform('arc');
  act(() => test.store.getState().undo());
  expect(test.hook.result.current.pendingWaypoints).toBeNull();
  act(() => { test.hook.result.current.changeWaypoint('road', 0, [16.35, 48.205]); });
  expect(test.directions.mock.calls.at(-1)?.[0].waypoints[0]).toEqual([16.35, 48.205]);
});

it('retains compatible corrections and capacity failures until a successful retry', async () => {
  const test = harness();
  test.directions.mockResolvedValue(response);
  test.replace.mockReturnValueOnce(mutationRejected('Portable project byte capacity exceeded', 'capacity'));
  const original = test.store.getState();
  test.change();
  await waitFor(() => expect(test.hook.result.current.error).toContain('byte capacity'));
  expect(test.store.getState()).toBe(original);
  expect(test.hook.result.current.pendingWaypoints?.[0]).toEqual([16.345, 48.2]);
  act(() => test.hook.result.current.retry());
  await waitFor(() => expect(test.hook.result.current.pendingWaypoints).toBeNull());
  expect(test.replace).toHaveBeenCalledTimes(2);
  expect(test.store.getState().past).toHaveLength(1);
});

it.each(['locked', 'hidden'] as const)('preserves failed work while %s but rejects new geometry requests until editable', async (mode) => {
  const test = harness();
  const toggle = mode === 'locked' ? test.store.getState().toggleLayerLock : test.store.getState().toggleLayerVisibility;
  test.change();
  await waitFor(() => expect(test.hook.result.current.error).not.toBeNull());
  act(() => toggle('road'));
  act(() => {
    expect(test.hook.result.current.changeWaypoint('road', 0, [16.344, 48.2])).toMatchObject({ ok: false });
    test.hook.result.current.retry();
  });
  expect(test.directions).toHaveBeenCalledOnce();
  expect(test.hook.result.current.pendingWaypoints?.[0]).toEqual([16.345, 48.2]);
  act(() => toggle('road'));
  test.directions.mockResolvedValue(response);
  act(() => test.hook.result.current.retry());
  await waitFor(() => expect(test.hook.result.current.pendingWaypoints).toBeNull());
});

it.each(['conversion', 'provenance', 'geometry', 'epoch', 'closed'] as const)('retires failed state on a %s change with the same layer id', async (change) => {
  const layer = road();
  if (layer.provenance?.service !== 'directions-v5') throw new Error('Expected Directions provenance');
  const directions = vi.fn<DirectionsProvider['directions']>().mockRejectedValue(new Error('Failed'));
  const options = { provider: { directions }, replaceDirectionsRoute: vi.fn() };
  const hook = renderHook(({ target, documentEpoch }) => useDirectionsRouteEditing({ ...options, documentEpoch, layers: [target] }), { initialProps: { target: layer, documentEpoch: 0 } });
  act(() => { hook.result.current.changeWaypoint('road', 0, [16.345, 48.2]); });
  await waitFor(() => expect(hook.result.current.error).toBe('Failed'));
  let target = layer;
  switch (change) {
    case 'conversion': { target = convertRoute(layer, 'arc')!; break; }
    case 'provenance': { target = { ...layer, provenance: { ...layer.provenance, profile: 'cycling' } }; break; }
    case 'geometry': { target = { ...layer, geometry: structuredClone(layer.geometry) }; break; }
    case 'closed': { target = road(true); break; }
  }
  const document = createNewProjectDocument();
  createProjectStore({ ...document, layers: [layer, ...document.layers] });
  createProjectStore({ ...document, layers: [target, ...document.layers] });
  hook.rerender({ target, documentEpoch: change === 'epoch' ? 1 : 0 });
  expect(hook.result.current.pendingWaypoints).toBeNull();
  expect(hook.result.current.error).toBeNull();
  expect(hook.result.current.statusLayerId).toBeNull();
  hook.rerender({ target: layer, documentEpoch: 0 });
  expect(hook.result.current.pendingWaypoints).toBeNull();
  expect(hook.result.current.error).toBeNull();
});

it('does not let an obsolete completion clear a newer request on the restored Road', async () => {
  const test = harness();
  const old = deferred();
  const current = deferred();
  test.directions.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  test.change();
  test.transform('arc');
  act(() => test.store.getState().undo());
  test.change();
  await act(async () => old.resolve(response));
  expect(test.replace).not.toHaveBeenCalled();
  expect(test.hook.result.current.isRouting).toBe(true);
  expect(test.hook.result.current.pendingWaypoints?.[0]).toEqual([16.345, 48.2]);
  await act(async () => current.resolve(response));
  expect(test.replace).toHaveBeenCalledOnce();
  expect(test.hook.result.current.pendingWaypoints).toBeNull();
});

it('retains an in-flight correction when the store rejects its result after locking', async () => {
  const test = harness();
  const request = deferred();
  test.directions.mockReturnValue(request.promise);
  test.change();
  act(() => test.store.getState().toggleLayerLock('road'));
  const locked = test.store.getState();
  await act(async () => request.resolve(response));
  expect(test.replace).toHaveReturnedWith(expect.objectContaining({ ok: false }));
  expect(test.store.getState()).toBe(locked);
  expect(test.hook.result.current.pendingWaypoints?.[0]).toEqual([16.345, 48.2]);
  expect(test.hook.result.current.error).not.toBeNull();
  act(() => test.store.getState().toggleLayerLock('road'));
  act(() => test.hook.result.current.retry());
  await waitFor(() => expect(test.hook.result.current.pendingWaypoints).toBeNull());
});

it('retires validation-only status when its canonical Road owner becomes obsolete', () => {
  const test = harness();
  act(() => {
    expect(test.hook.result.current.changeWaypoint('road', 100, [16.345, 48.2])).toMatchObject({ ok: false });
  });
  expect(test.hook.result.current.error).not.toBeNull();
  expect(test.directions).not.toHaveBeenCalled();
  test.transform('arc');
  expect(test.hook.result.current).toMatchObject({ error: null, statusLayerId: null });
});
