import { minimumRoutePointCount, routePointRemovalError } from '../../src/domain/routePointConstraints';

it.each([
  { isClosed: false, pointCount: 2, pointIndex: 0, minimum: 2 },
  { isClosed: true, pointCount: 4, pointIndex: 1, minimum: 3 },
])('rejects removing below the $minimum-point minimum', ({ minimum, ...request }) => {
  expect(minimumRoutePointCount(request.isClosed)).toBe(minimum);
  expect(routePointRemovalError(request)).toContain('need at least');
});

it.each([
  { isClosed: false, pointCount: 3, pointIndex: 0 },
  { isClosed: false, pointCount: 3, pointIndex: 2 },
  { isClosed: true, pointCount: 5, pointIndex: 0 },
  { isClosed: true, pointCount: 5, pointIndex: 3 },
])('allows valid domain removal with $pointCount stored points at $pointIndex', (request) => {
  expect(routePointRemovalError(request)).toBeNull();
});

it.each([-1, 0.5, 4, NaN])('rejects invalid or closing-alias index %s', (pointIndex) => {
  expect(routePointRemovalError({ isClosed: true, pointCount: 5, pointIndex })).not.toBeNull();
});

it('enforces middle-only editing without mistaking the last distinct closed point for the alias', () => {
  const request = { pointCount: 5, isClosed: true, isMiddleOnly: true };
  expect(routePointRemovalError({ ...request, pointIndex: 0 })).toContain('middle');
  expect(routePointRemovalError({ ...request, pointIndex: 3 })).toBeNull();
  expect(routePointRemovalError({ ...request, pointIndex: 4 })).toContain('closing point');
  expect(routePointRemovalError({ ...request, isClosed: false, pointIndex: 4 })).toContain('middle');
});
