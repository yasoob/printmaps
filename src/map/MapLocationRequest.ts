export type MapLocationRequest = Readonly<{
  coordinate?: readonly [number, number];
  onApplied?: () => void;
  request: number;
}>;

const EMPTY_MAP_LOCATION_REQUEST: MapLocationRequest = { request: 0 };

export function resolveMapLocationRequest(request?: MapLocationRequest): MapLocationRequest {
  return request ?? EMPTY_MAP_LOCATION_REQUEST;
}

export function mapLocationRequestDiagnostic(candidate?: MapLocationRequest): string {
  const request = resolveMapLocationRequest(candidate);
  return request.coordinate ? `${request.request}:${request.coordinate.join(',')}` : `${request.request}`;
}

type LocationMap = {
  easeTo: (options: { center: [number, number]; duration: number; zoom: number }) => void;
  getZoom: () => number;
};

export function applyMapLocation(map: LocationMap, coordinate: readonly [number, number]): void {
  const [longitude, latitude] = coordinate;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)
    || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return;
  const currentZoom = map.getZoom();
  map.easeTo({
    center: [longitude, latitude],
    duration: 0,
    zoom: Number.isFinite(currentZoom) ? Math.max(currentZoom, 14) : 14,
  });
}
