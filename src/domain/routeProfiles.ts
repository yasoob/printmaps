export const ROUTE_TRAVEL_MARKERS = ['air', 'rail', 'car', 'walk', 'bike', 'ship'] as const;
export type RouteTravelMarker = typeof ROUTE_TRAVEL_MARKERS[number];
export const ROAD_TRAVEL_MODES = ['car', 'walk', 'bike'] as const;
export type RoadTravelMode = typeof ROAD_TRAVEL_MODES[number];
export type RouteLineShape = 'straight' | 'arc' | 'road';
export type RouteAuthoringOptions = Readonly<{
  lineShape: RouteLineShape;
  roadTravelMode: RoadTravelMode;
  travelMarker: RouteTravelMarker | null;
}>;

export const DEFAULT_ROUTE_AUTHORING_OPTIONS: RouteAuthoringOptions = {
  lineShape: 'straight',
  roadTravelMode: 'car',
  travelMarker: null,
};

export function isRouteAuthoringOptions(value: unknown): value is RouteAuthoringOptions {
  if (typeof value !== 'object' || value === null) return false;
  const options = value as Record<string, unknown>;
  return (['straight', 'arc', 'road'] as const).includes(options.lineShape as RouteLineShape)
    && ROAD_TRAVEL_MODES.includes(options.roadTravelMode as RoadTravelMode)
    && (options.travelMarker === null || ROUTE_TRAVEL_MARKERS.includes(options.travelMarker as RouteTravelMarker));
}

export const ROAD_TRAVEL_MODE_LABELS: Readonly<Record<RoadTravelMode, string>> = {
  car: 'Car',
  walk: 'Walking',
  bike: 'Cycling',
};

export const ROUTE_TRAVEL_MARKER_LABELS: Readonly<Record<RouteTravelMarker, string>> = {
  air: 'Air',
  rail: 'Train',
  car: 'Car',
  walk: 'Walking',
  bike: 'Cycling',
  ship: 'Ship',
};

export const ROUTE_TRAVEL_MARKER_GLYPHS: Readonly<Record<RouteTravelMarker, string>> = {
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
