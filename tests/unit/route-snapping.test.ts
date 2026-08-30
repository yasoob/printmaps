import { routeSnapCandidates, snapRouteCoordinate } from '../../src/map/RouteSnapping';
import type { ContentLayer } from '../../src/domain/project';

it('indexes semantic Road waypoints instead of provider geometry samples', () => {
  const layer: ContentLayer = {
    id: 'road',
    name: 'Road trip',
    type: 'route',
    visible: true,
    locked: false,
    opacity: 100,
    geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1], [2, 2], [3, 3]] },
    provenance: {
      provider: 'mapbox',
      service: 'directions-v5',
      waypoints: [[0, 0], [3, 3]],
      profile: 'driving',
      distanceMeters: 1,
      durationSeconds: 1,
    },
  };

  expect(routeSnapCandidates([layer]).map(({ coordinate, label }) => ({ coordinate, label }))).toEqual([
    { coordinate: [0, 0], label: 'Road trip waypoint 1' },
    { coordinate: [3, 3], label: 'Road trip waypoint 2' },
  ]);
});

it('returns the raw map coordinate when no candidate is within the pixel threshold', () => {
  expect(snapRouteCoordinate([10, 10], [{
    coordinate: [20, 20],
    key: 'far',
    label: 'Far away',
  }], 12)).toEqual({ coordinate: [10, 10], label: null });
});
