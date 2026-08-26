import { appendRoadSearchWaypoint } from '../../../src/app/components/routeAuthoringActions';

it('refuses a twenty-sixth searched road waypoint', () => {
  const waypoints = Array.from({ length: 25 }, (_, index) => [16 + index / 100, 48] as [number, number]);

  const result = appendRoadSearchWaypoint(waypoints, [17, 49]);

  expect(result.points).toBe(waypoints);
  expect(result.error).toBe('Road routes support up to 25 waypoints.');
});
