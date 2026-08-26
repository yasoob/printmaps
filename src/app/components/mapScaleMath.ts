const EARTH_CIRCUMFERENCE_METERS = 40_075_016.686;
const MAP_TILE_SIZE = 512;

function niceDistance(maximumMeters: number): number {
  if (!Number.isFinite(maximumMeters) || maximumMeters <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(maximumMeters));
  for (const multiplier of [5, 2, 1]) {
    const candidate = multiplier * magnitude;
    if (candidate <= maximumMeters) return candidate;
  }
  return magnitude / 2;
}

export function calculateMapScale(latitude: number, zoom: number, maxWidthPx = 96) {
  const boundedLatitude = Math.max(-85.051129, Math.min(85.051129, latitude));
  const metersPerPixel = Math.cos(boundedLatitude * Math.PI / 180)
    * EARTH_CIRCUMFERENCE_METERS / (MAP_TILE_SIZE * 2 ** zoom);
  const distanceMeters = niceDistance(metersPerPixel * maxWidthPx);
  const label = distanceMeters >= 1000
    ? `${Number((distanceMeters / 1000).toFixed(1))} km`
    : `${Math.round(distanceMeters)} m`;
  return { distanceMeters, label, widthPx: distanceMeters / metersPerPixel };
}
