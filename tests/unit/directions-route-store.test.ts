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
    appearance: {
      marker: {
        pictogram: 'bike',
        placement: { type: 'center' },
        orientToPath: true,
        reverseFacing: false,
      },
    },
    provenance: {
      waypoints: updatedInput.waypoints,
      distanceMeters: 12_000,
      durationSeconds: 1800,
    },
  });
});

it('preserves complete marker configuration and segment styles for waypoint moves', () => {
  const store = createProjectStore(createInitialProjectDocument());
  const epoch = store.getState().documentEpoch;
  const created = store.getState().createDirectionsRoute(input, {
    lineShape: 'road', roadTravelMode: 'car', travelMarker: 'bike',
  }, epoch);
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  const expectedLayer = store.getState().document.layers.find(({ id }) => id === created.routeId)!;
  if (expectedLayer.appearance?.kind !== 'route' || !expectedLayer.appearance.marker) {
    throw new Error('Expected route marker.');
  }
  expectedLayer.appearance.marker = {
    pictogram: 'bike',
    placement: { type: 'repeat', spacing: 0.4 },
    orientToPath: true,
    reverseFacing: true,
  };
  expectedLayer.appearance.segmentStyles = [{ color: '#123456' }];
  const moved = {
    ...input,
    geometry: [[16.31, 48.19], [16.5, 48.25]] as [number, number][],
    waypoints: [[16.31, 48.19], [16.5, 48.25]] as [number, number][],
  };

  expect(store.getState().replaceDirectionsRoute({
    id: created.routeId,
    input: moved,
    options: { lineShape: 'road', roadTravelMode: 'car', travelMarker: 'bike' },
    expectedDocumentEpoch: epoch,
    expectedLayer,
  }).ok).toBe(true);
  expect(store.getState().document.layers.find(({ id }) => id === created.routeId)?.appearance)
    .toMatchObject({
      marker: {
        pictogram: 'bike',
        placement: { type: 'repeat', spacing: 0.4 },
        orientToPath: true,
        reverseFacing: true,
      },
      segmentStyles: [{ color: '#123456' }],
    });
});

it('remaps segment styles with point-removal semantics during a waypoint reroute', () => {
  const document = createInitialProjectDocument();
  const route = document.layers.find(({ id }) => id === 'route-01')!;
  route.route = { kind: 'road', closed: false };
  route.geometry = {
    type: 'LineString',
    coordinates: [[0, 0], [1, 0], [2, 0], [3, 0]],
  };
  route.provenance = {
    provider: 'mapbox',
    service: 'directions-v5',
    waypoints: [[0, 0], [1, 0], [2, 0], [3, 0]],
    profile: 'driving',
    distanceMeters: 3,
    durationSeconds: 3,
  };
  if (route.appearance?.kind !== 'route') throw new Error('Expected route appearance.');
  route.appearance.segmentStyles = [
    { color: '#123456' },
    { color: '#123456' },
    { width: 8 },
  ];
  const store = createProjectStore(document);
  const expectedLayer = store.getState().document.layers.find(({ id }) => id === route.id)!;
  const replacement = {
    geometry: [[0, 0], [2, 0], [3, 0]] as [number, number][],
    waypoints: [[0, 0], [2, 0], [3, 0]] as [number, number][],
    profile: 'driving' as const,
    distanceMeters: 3,
    durationSeconds: 3,
  };

  expect(store.getState().replaceDirectionsRoute({
    id: route.id,
    input: replacement,
    options: { lineShape: 'road', roadTravelMode: 'car', travelMarker: null },
    expectedDocumentEpoch: 0,
    expectedLayer,
  }).ok).toBe(true);
  expect(store.getState().document.layers.find(({ id }) => id === route.id)?.appearance)
    .toMatchObject({
      segmentStyles: [{ color: '#123456' }, { width: 8 }],
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

it('preserves closed Road state and accepts only its canonical closing duplicate', () => {
  const document = createInitialProjectDocument();
  const route = document.layers.find(({ id }) => id === 'route-01')!;
  const waypoints = [[0, 0], [1, 0], [1, 1], [0, 0]] as [number, number][];
  route.route = { kind: 'road', closed: true };
  route.geometry = { type: 'LineString', coordinates: waypoints };
  route.provenance = {
    provider: 'mapbox',
    service: 'directions-v5',
    waypoints,
    profile: 'driving',
    distanceMeters: 3,
    durationSeconds: 3,
  };
  if (route.appearance?.kind !== 'route') throw new Error('Expected route appearance.');
  route.appearance.segmentStyles = [null, null, null];
  const store = createProjectStore(document);
  const expectedLayer = store.getState().document.layers.find(({ id }) => id === route.id)!;
  const replacement = {
    geometry: [[0, 0], [0.5, 0], [1, 0], [1, 1], [0, 0]] as [number, number][],
    waypoints,
    profile: 'driving' as const,
    distanceMeters: 4,
    durationSeconds: 4,
  };

  expect(store.getState().replaceDirectionsRoute({
    id: route.id,
    input: replacement,
    options: { lineShape: 'road', roadTravelMode: 'car', travelMarker: null },
    expectedDocumentEpoch: 0,
    expectedLayer,
  }).ok).toBe(true);
  expect(store.getState().document.layers.find(({ id }) => id === route.id)?.route)
    .toEqual({ kind: 'road', closed: true });

  const current = store.getState().document.layers.find(({ id }) => id === route.id)!;
  const historyLength = store.getState().past.length;
  expect(store.getState().replaceDirectionsRoute({
    id: route.id,
    input: { ...replacement, waypoints: [[0, 0], [1, 0], [0, 0], [0, 0]] },
    options: { lineShape: 'road', roadTravelMode: 'car', travelMarker: null },
    expectedDocumentEpoch: 0,
    expectedLayer: current,
  }).ok).toBe(false);
  expect(store.getState().past).toHaveLength(historyLength);
});
