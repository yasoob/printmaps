import type { DirectionsRouteInput } from '../../domain/project';
import { buildRouteCoordinates, type RouteAuthoringOptions } from '../../domain/routeProfiles';
import { countDistinctPoints } from './authoringDraftLayers';
import { roadProfileFor } from '../hooks/useDirectionsAuthoring';

type RoadDirections = {
  route: (
    waypoints: readonly (readonly [number, number])[],
    options: RouteAuthoringOptions,
  ) => Promise<string | null>;
};

type FinishRouteOptions = {
  coordinates: [number, number][];
  directions: RoadDirections;
  exit: () => void;
  onCreateRoute: (
    coordinates: readonly (readonly [number, number])[],
    options?: RouteAuthoringOptions,
  ) => void;
  routeOptions: RouteAuthoringOptions;
};

export function canFinishRoute(
  points: readonly (readonly [number, number])[],
  options: RouteAuthoringOptions,
) {
  return countDistinctPoints(points) >= 2
    && buildRouteCoordinates(points, options.lineShape).length >= 2
    && (options.lineShape !== 'road' || roadProfileFor(options.travelProfile) !== null);
}

export function finishRouteCoordinates(options: FinishRouteOptions) {
  if (countDistinctPoints(options.coordinates) < 2) return;
  if (options.routeOptions.lineShape === 'road') {
    void options.directions.route(options.coordinates, options.routeOptions).then((id) => {
      if (id) options.exit();
    });
    return;
  }
  options.onCreateRoute(options.coordinates, options.routeOptions);
  options.exit();
}

export type CreateDirectionsRoute = (
  input: DirectionsRouteInput,
  options: RouteAuthoringOptions,
  expectedDocumentEpoch: number,
) => string | null;
