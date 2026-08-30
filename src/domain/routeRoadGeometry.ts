import { rebasePathLongitudes } from './routeArcGeometry';

type RoutePosition = [number, number];
type ProjectedPosition = { x: number; y: number };

function project([longitude, latitude]: readonly [number, number]): ProjectedPosition {
  const radians = latitude * Math.PI / 180;
  return {
    x: (longitude + 180) / 360,
    y: (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2,
  };
}

function continuousProjectedPath(
  path: readonly (readonly [number, number])[],
): ProjectedPosition[] {
  const projected: ProjectedPosition[] = [];
  for (const position of path) {
    const point = project(position);
    const previous = projected.at(-1);
    if (previous) {
      while (point.x - previous.x > 0.5) point.x -= 1;
      while (point.x - previous.x < -0.5) point.x += 1;
    }
    projected.push(point);
  }
  return projected;
}

function nearestWaypointIndex(
  waypoint: readonly [number, number],
  projectedPath: readonly ProjectedPosition[],
  minimum: number,
  maximum: number,
): number {
  const projectedWaypoint = project(waypoint);
  let bestIndex = minimum;
  let bestDistance = Infinity;
  for (let index = minimum; index <= maximum; index += 1) {
    const candidate = projectedPath[index];
    const x = projectedWaypoint.x + Math.round(candidate.x - projectedWaypoint.x);
    const distance = Math.hypot(x - candidate.x, projectedWaypoint.y - candidate.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function hasUsableEdge(
  path: readonly (readonly [number, number])[],
): boolean {
  const projected = continuousProjectedPath(path);
  return projected.slice(1).some((end, index) => {
    const start = projected[index];
    return Math.hypot(end.x - start.x, end.y - start.y) > 0;
  });
}

export function partitionRoadGeometry(
  geometry: readonly (readonly [number, number])[],
  waypoints: readonly (readonly [number, number])[],
): RoutePosition[][] | null {
  const legCount = waypoints.length - 1;
  if (legCount < 1 || geometry.length < legCount + 1) return null;
  const path = rebasePathLongitudes(geometry);
  const projected = continuousProjectedPath(path);
  const boundaries = [0];
  for (let waypointIndex = 1; waypointIndex < waypoints.length - 1; waypointIndex += 1) {
    const minimum = boundaries.at(-1)! + 1;
    const remainingLegs = legCount - waypointIndex;
    const maximum = path.length - 1 - remainingLegs;
    boundaries.push(nearestWaypointIndex(waypoints[waypointIndex], projected, minimum, maximum));
  }
  boundaries.push(path.length - 1);
  const legs = boundaries.slice(1).map((end, index) => (
    path.slice(boundaries[index], end + 1).map((position) => [...position] as RoutePosition)
  ));
  return legs.every((leg) => hasUsableEdge(leg)) ? legs : null;
}
