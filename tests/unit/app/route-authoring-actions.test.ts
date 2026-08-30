import {
  appendRoadSearchWaypoint,
  appendRouteExtensionPoint,
  extendedLocalRouteGeometry,
  extendedRoutePoints,
} from '../../../src/app/components/routeAuthoringActions';
import type { ContentLayer } from '../../../src/domain/project';

it('refuses a twenty-sixth searched road waypoint', () => {
  const waypoints = Array.from({ length: 25 }, (_, index) => [16 + index / 100, 48] as [number, number]);

  const result = appendRoadSearchWaypoint(waypoints, [17, 49]);

  expect(result.points).toBe(waypoints);
  expect(result.error).toBe('Road routes support up to 25 waypoints.');
});

const route = (geometry: NonNullable<ContentLayer['geometry']>): ContentLayer => ({
  id: 'route',
  name: 'Route',
  type: 'route',
  visible: true,
  locked: false,
  opacity: 100,
  geometry,
});

it('prepends additions in interaction order away from the selected endpoint', () => {
  const layer = route({ type: 'LineString', coordinates: [[10, 10], [20, 20]] });

  expect(extendedRoutePoints(layer, [[9, 9], [8, 8]], 'start')).toEqual([
    [8, 8], [9, 9], [10, 10], [20, 20],
  ]);
  expect(extendedRoutePoints(layer, [[21, 21], [22, 22]], 'end')).toEqual([
    [10, 10], [20, 20], [21, 21], [22, 22],
  ]);
});

it('preserves existing Arc curvature and adds defaults only for new segments', () => {
  const layer = route({
    type: 'Arc',
    anchors: [[10, 10], [20, 20], [30, 10]],
    curvatures: [-0.4, 0.7],
  });

  expect(extendedLocalRouteGeometry(layer, [[5, 5]], 'start')).toMatchObject({
    anchors: [[5, 5], [10, 10], [20, 20], [30, 10]],
    curvatures: [0.35, -0.4, 0.7],
  });
});

it('counts persisted Road waypoints when validating an extension', () => {
  const waypoints = Array.from({ length: 25 }, (_, index) => [index, 0] as [number, number]);
  const layer: ContentLayer = {
    ...route({ type: 'LineString', coordinates: waypoints }),
    provenance: {
      provider: 'mapbox',
      service: 'directions-v5',
      waypoints,
      profile: 'driving',
      distanceMeters: 100,
      durationSeconds: 10,
    },
  };

  const result = appendRouteExtensionPoint({
    additions: [], coordinate: [30, 0], endpoint: 'end', layer, lineShape: 'road',
  });

  expect(result.points).toEqual([]);
  expect(result.error).toBe('Road routes support up to 25 waypoints.');
});

it('rejects an extension point that duplicates a persisted route point', () => {
  const layer = route({ type: 'LineString', coordinates: [[10, 10], [20, 20]] });

  const result = appendRouteExtensionPoint({
    additions: [], coordinate: [10, 10], endpoint: 'end', layer, lineShape: 'straight',
  });

  expect(result.points).toEqual([]);
  expect(result.error).toBe('That route point is already present. Choose a different location.');
});

it('normalizes persisted route precision before extension duplicate checks', () => {
  const layer = route({
    type: 'LineString',
    coordinates: [[10.1234564, 20.1234564], [30, 40]],
  });

  const result = appendRouteExtensionPoint({
    additions: [],
    coordinate: [10.1234564, 20.1234564],
    endpoint: 'end',
    layer,
    lineShape: 'straight',
  });

  expect(result.points).toEqual([]);
  expect(result.error).toBe('That route point is already present. Choose a different location.');
});
