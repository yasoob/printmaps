export const ELEVATION_API_URL = 'https://api.open-meteo.com/v1/elevation';
export const ELEVATION_SOURCE_LABEL = 'Copernicus DEM GLO-90 via Open-Meteo';
export const MAX_ELEVATION_SAMPLES = 100;

const EARTH_RADIUS_METERS = 6_371_008.8;
const TARGET_SAMPLE_SPACING_METERS = 500;
const MINIMUM_TERRAIN_ELEVATION_METERS = -12_000;
const MAXIMUM_TERRAIN_ELEVATION_METERS = 10_000;

type Position = readonly [number, number];

export type ElevationSample = Readonly<{
  coordinate: Position;
  distanceMeters: number;
  elevationMeters: number;
}>;

export type ElevationProfile = Readonly<{
  samples: readonly ElevationSample[];
  totalDistanceMeters: number;
  minimumElevationMeters: number;
  maximumElevationMeters: number;
  totalAscentMeters: number;
  totalDescentMeters: number;
  sourceLabel: typeof ELEVATION_SOURCE_LABEL;
}>;

type LoadElevationProfileOptions = Readonly<{
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}>;

function radians(value: number): number {
  return value * Math.PI / 180;
}

function isPosition(position: Position): boolean {
  return Number.isFinite(position[0])
    && Number.isFinite(position[1])
    && position[0] >= -180
    && position[0] <= 180
    && position[1] >= -90
    && position[1] <= 90;
}

export function distanceBetweenPositions(from: Position, to: Position): number {
  const latitudeDelta = radians(to[1] - from[1]);
  const longitudeDelta = radians(to[0] - from[0]);
  const fromLatitude = radians(from[1]);
  const toLatitude = radians(to[1]);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function routeSegments(coordinates: readonly Position[]) {
  if (coordinates.length < 2 || coordinates.some((coordinate) => !isPosition(coordinate))) {
    throw new Error('Elevation profiles require a route with at least two valid coordinates.');
  }
  const cumulative = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    cumulative.push(cumulative[index - 1] + distanceBetweenPositions(coordinates[index - 1], coordinates[index]));
  }
  const totalDistanceMeters = cumulative.at(-1) ?? 0;
  if (!Number.isFinite(totalDistanceMeters) || totalDistanceMeters <= 0) {
    throw new Error('Elevation profiles require a route with a measurable distance.');
  }
  return { cumulative, totalDistanceMeters };
}

function interpolateLongitude(from: number, to: number, fraction: number): number {
  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  const longitude = from + delta * fraction;
  return ((longitude + 540) % 360) - 180;
}

export function sampleRouteCoordinates(coordinates: readonly Position[]): readonly Position[] {
  const { cumulative, totalDistanceMeters } = routeSegments(coordinates);
  const sampleCount = Math.min(
    MAX_ELEVATION_SAMPLES,
    Math.max(2, coordinates.length, Math.ceil(totalDistanceMeters / TARGET_SAMPLE_SPACING_METERS) + 1),
  );
  const samples: Position[] = [];
  let segmentIndex = 1;
  for (let index = 0; index < sampleCount; index += 1) {
    const targetDistance = totalDistanceMeters * index / (sampleCount - 1);
    while (segmentIndex < cumulative.length - 1 && cumulative[segmentIndex] < targetDistance) {
      segmentIndex += 1;
    }
    const startIndex = Math.max(0, segmentIndex - 1);
    const segmentLength = cumulative[segmentIndex] - cumulative[startIndex];
    const fraction = segmentLength === 0 ? 0 : (targetDistance - cumulative[startIndex]) / segmentLength;
    const from = coordinates[startIndex];
    const to = coordinates[segmentIndex];
    samples.push([
      interpolateLongitude(from[0], to[0], fraction),
      from[1] + (to[1] - from[1]) * fraction,
    ]);
  }
  return samples;
}

function terrainServiceError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'AbortError') return error;
  return new Error('Elevation data is unavailable. Check your connection and try again.');
}

async function requestElevations(
  url: URL,
  fetcher: typeof fetch,
  signal: AbortSignal | undefined,
  expectedCount: number,
): Promise<number[]> {
  let response: Response;
  try {
    response = await fetcher(url, { signal });
  } catch (error) {
    throw terrainServiceError(error);
  }
  if (!response.ok) {
    throw new Error(`Elevation data is unavailable (service returned ${response.status}). Try again later.`);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Elevation data is unavailable because the service returned an invalid response.');
  }
  const elevations = typeof payload === 'object' && payload !== null && 'elevation' in payload
    ? (payload as { elevation?: unknown }).elevation
    : undefined;
  if (
    !Array.isArray(elevations)
    || elevations.length !== expectedCount
    || elevations.some((elevation) => (
      typeof elevation !== 'number'
      || !Number.isFinite(elevation)
      || elevation < MINIMUM_TERRAIN_ELEVATION_METERS
      || elevation > MAXIMUM_TERRAIN_ELEVATION_METERS
    ))
  ) {
    throw new Error('Elevation data is unavailable because the service returned invalid measurements.');
  }
  return elevations as number[];
}

export async function loadElevationProfile(
  coordinates: readonly Position[],
  options: LoadElevationProfileOptions = {},
): Promise<ElevationProfile> {
  const requestCoordinates = sampleRouteCoordinates(coordinates);
  const url = new URL(ELEVATION_API_URL);
  url.searchParams.set('latitude', requestCoordinates.map((coordinate) => coordinate[1].toFixed(6)).join(','));
  url.searchParams.set('longitude', requestCoordinates.map((coordinate) => coordinate[0].toFixed(6)).join(','));
  const elevations = await requestElevations(
    url,
    options.fetcher ?? fetch,
    options.signal,
    requestCoordinates.length,
  );

  const distances = [0];
  for (let index = 1; index < requestCoordinates.length; index += 1) {
    distances.push(distances[index - 1] + distanceBetweenPositions(requestCoordinates[index - 1], requestCoordinates[index]));
  }
  let totalAscentMeters = 0;
  let totalDescentMeters = 0;
  for (let index = 1; index < elevations.length; index += 1) {
    const change = elevations[index] - elevations[index - 1];
    if (change > 0) totalAscentMeters += change;
    else totalDescentMeters -= change;
  }
  return {
    samples: requestCoordinates.map((coordinate, index) => ({
      coordinate,
      distanceMeters: distances[index],
      elevationMeters: elevations[index],
    })),
    totalDistanceMeters: distances.at(-1) ?? 0,
    minimumElevationMeters: Math.min(...elevations),
    maximumElevationMeters: Math.max(...elevations),
    totalAscentMeters,
    totalDescentMeters,
    sourceLabel: ELEVATION_SOURCE_LABEL,
  };
}
