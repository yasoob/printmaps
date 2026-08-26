export const ROUTE_TRAVEL_PROFILES = ['air', 'rail', 'car', 'walk', 'bike', 'ship'] as const;
export type RouteTravelProfile = typeof ROUTE_TRAVEL_PROFILES[number];
export type RouteLineShape = 'straight' | 'arc' | 'road';
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
  return (['straight', 'arc', 'road'] as const).includes(options.lineShape as RouteLineShape)
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

type Position = readonly [number, number];

export function buildRouteCoordinates(
  waypoints: readonly Position[],
  lineShape: RouteLineShape,
): [number, number][] {
  if (lineShape !== 'straight' && lineShape !== 'arc' && lineShape !== 'road') return [];
  return waypoints.map(([longitude, latitude]) => [longitude, latitude]);
}
