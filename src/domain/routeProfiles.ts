export const ROUTE_TRAVEL_PROFILES = ['air', 'rail', 'car', 'walk', 'bike', 'ship'] as const;
export type RouteTravelProfile = typeof ROUTE_TRAVEL_PROFILES[number];
export type RouteLineShape = 'straight' | 'arc';
export type RouteAuthoringOptions = Readonly<{
  lineShape: RouteLineShape;
  travelProfile: RouteTravelProfile;
  showTravelModeIcon: boolean;
}>;

export const DEFAULT_ROUTE_AUTHORING_OPTIONS: RouteAuthoringOptions = {
  lineShape: 'straight',
  travelProfile: 'car',
  showTravelModeIcon: false,
};

export function isRouteAuthoringOptions(value: unknown): value is RouteAuthoringOptions {
  if (typeof value !== 'object' || value === null) return false;
  const options = value as Record<string, unknown>;
  return (options.lineShape === 'straight' || options.lineShape === 'arc')
    && ROUTE_TRAVEL_PROFILES.includes(options.travelProfile as RouteTravelProfile)
    && typeof options.showTravelModeIcon === 'boolean';
}

export const ROUTE_TRAVEL_PROFILE_LABELS: Readonly<Record<RouteTravelProfile, string>> = {
  air: 'Air',
  rail: 'Train',
  car: 'Car',
  walk: 'Walking',
  bike: 'Cycling',
  ship: 'Ship',
};

export const ROUTE_TRAVEL_PROFILE_MARKERS: Readonly<Record<RouteTravelProfile, string>> = {
  air: 'AIR',
  rail: 'RAIL',
  car: 'CAR',
  walk: 'WALK',
  bike: 'BIKE',
  ship: 'SHIP',
};

const ARC_STEPS_PER_SEGMENT = 24;
const DEGREES_PER_RADIAN = 180 / Math.PI;
const RADIANS_PER_DEGREE = Math.PI / 180;

type Position = readonly [number, number];

function toVector([longitude, latitude]: Position): readonly [number, number, number] {
  const lambda = longitude * RADIANS_PER_DEGREE;
  const phi = latitude * RADIANS_PER_DEGREE;
  const cosineLatitude = Math.cos(phi);
  return [
    cosineLatitude * Math.cos(lambda),
    cosineLatitude * Math.sin(lambda),
    Math.sin(phi),
  ];
}

function fromVector([x, y, z]: readonly [number, number, number]): [number, number] {
  return [
    Math.atan2(y, x) * DEGREES_PER_RADIAN,
    Math.atan2(z, Math.hypot(x, y)) * DEGREES_PER_RADIAN,
  ];
}

function interpolateArc(start: Position, end: Position): [number, number][] | null {
  const startVector = toVector(start);
  const endVector = toVector(end);
  const dot = Math.max(-1, Math.min(1, (
    startVector[0] * endVector[0]
    + startVector[1] * endVector[1]
    + startVector[2] * endVector[2]
  )));
  const angle = Math.acos(dot);
  const sineAngle = Math.sin(angle);
  if (angle < 1e-9) return [[...start], [...end]];
  if (angle > Math.PI - 1e-6 || Math.abs(sineAngle) < 1e-9) return null;

  return Array.from({ length: ARC_STEPS_PER_SEGMENT + 1 }, (_, index) => {
    if (index === 0) return [...start] as [number, number];
    if (index === ARC_STEPS_PER_SEGMENT) return [...end] as [number, number];
    const fraction = index / ARC_STEPS_PER_SEGMENT;
    const startWeight = Math.sin((1 - fraction) * angle) / sineAngle;
    const endWeight = Math.sin(fraction * angle) / sineAngle;
    return fromVector([
      startVector[0] * startWeight + endVector[0] * endWeight,
      startVector[1] * startWeight + endVector[1] * endWeight,
      startVector[2] * startWeight + endVector[2] * endWeight,
    ]);
  });
}

export function buildRouteCoordinates(
  waypoints: readonly Position[],
  lineShape: RouteLineShape,
): [number, number][] {
  if (lineShape === 'straight' || waypoints.length < 2) {
    return waypoints.map(([longitude, latitude]) => [longitude, latitude]);
  }
  const coordinates: [number, number][] = [];
  for (let index = 1; index < waypoints.length; index += 1) {
    const segment = interpolateArc(waypoints[index - 1], waypoints[index]);
    if (!segment) return [];
    coordinates.push(...(index === 1 ? segment : segment.slice(1)));
  }
  return coordinates;
}
