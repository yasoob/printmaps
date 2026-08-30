import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument, type DirectionsRouteInput } from '../../src/domain/project';

const input: DirectionsRouteInput = {
  geometry: [[16.31, 48.19], [16.355, 48.215], [16.4, 48.24]],
  waypoints: [[16.31, 48.19], [16.4, 48.24]],
  profile: 'driving',
  distanceMeters: 9200,
  durationSeconds: 1320,
};

it('rejects malformed road-route options without mutating history', () => {
  const store = createProjectStore(createInitialProjectDocument());
  const epoch = store.getState().documentEpoch;

  expect(() => store.getState().createDirectionsRoute(input, null as never, epoch)).not.toThrow();
  expect(store.getState().document.layers.some(({ provenance }) => provenance?.service === 'directions-v5')).toBe(false);
  expect(store.getState().canUndo).toBe(false);
});

it('clears stale directions provenance after a manual geometry edit', () => {
  const store = createProjectStore(createInitialProjectDocument());
  const epoch = store.getState().documentEpoch;
  const result = store.getState().createDirectionsRoute(input, {
    lineShape: 'road', roadTravelMode: 'car', travelMarker: null,
  }, epoch);

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  store.getState().setRouteVertex(result.routeId, 0, [16.311, 48.19]);

  expect(store.getState().document.layers.find((layer) => layer.id === result.routeId)?.provenance).toBeUndefined();
});

it('replaces Road geometry, waypoints, and metrics in one undoable transaction', () => {
  const store = createProjectStore(createInitialProjectDocument());
  const epoch = store.getState().documentEpoch;
  const created = store.getState().createDirectionsRoute(input, {
    lineShape: 'road', roadTravelMode: 'car', travelMarker: null,
  }, epoch);
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  const expectedLayer = store.getState().document.layers.find(({ id }) => id === created.routeId)!;
  const otherLayerId = store.getState().document.layers.find(({ id }) => id !== created.routeId)!.id;
  store.getState().selectLayer(otherLayerId);
  const beforeEditHistory = store.getState().past.length;
  const updatedInput = {
    ...input,
    geometry: [[16.31, 48.19], [16.38, 48.3], [16.5, 48.25]] as [number, number][],
    waypoints: [[16.31, 48.19], [16.5, 48.25]] as [number, number][],
    distanceMeters: 12_000,
    durationSeconds: 1800,
  };

  const result = store.getState().replaceDirectionsRoute({
    id: created.routeId,
    input: updatedInput,
    options: { lineShape: 'road', roadTravelMode: 'car', travelMarker: 'bike' },
    expectedDocumentEpoch: epoch,
    expectedLayer,
  });

  expect(result).toEqual({ ok: true, routeId: created.routeId });
  expect(store.getState().selectedId).toBe(otherLayerId);
  expect(store.getState().past).toHaveLength(beforeEditHistory + 1);
  expect(store.getState().document.layers.find(({ id }) => id === created.routeId)).toMatchObject({
    geometry: { coordinates: updatedInput.geometry },
    appearance: { travelMarker: 'bike' },
    provenance: {
      waypoints: updatedInput.waypoints,
      distanceMeters: 12_000,
      durationSeconds: 1800,
    },
  });
});

it('rejects a stale Road replacement without mutating the recoverable route', () => {
  const store = createProjectStore(createInitialProjectDocument());
  const epoch = store.getState().documentEpoch;
  const created = store.getState().createDirectionsRoute(input, {
    lineShape: 'road', roadTravelMode: 'car', travelMarker: null,
  }, epoch);
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  const expectedLayer = store.getState().document.layers.find(({ id }) => id === created.routeId)!;
  store.getState().renameLayer(created.routeId, 'Changed route');
  const historyLength = store.getState().past.length;

  const result = store.getState().replaceDirectionsRoute({
    id: created.routeId,
    input,
    options: { lineShape: 'road', roadTravelMode: 'car', travelMarker: null },
    expectedDocumentEpoch: epoch,
    expectedLayer,
  });

  expect(result).toEqual({ ok: false, error: expect.stringContaining('changed') });
  expect(store.getState().past).toHaveLength(historyLength);
});
