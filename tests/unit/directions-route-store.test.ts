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

it('retains directions attribution provenance after a manual route vertex edit', () => {
  const store = createProjectStore(createInitialProjectDocument());
  const epoch = store.getState().documentEpoch;
  const id = store.getState().createDirectionsRoute(input, {
    lineShape: 'road', travelProfile: 'car', showTravelModeIcon: false,
  }, epoch);

  store.getState().setRouteVertex(id!, 0, [16.311, 48.19]);

  expect(store.getState().document.layers.find((layer) => layer.id === id)?.provenance).toMatchObject({
    provider: 'mapbox', service: 'directions-v5', distanceMeters: 9200, durationSeconds: 1320,
  });
});
