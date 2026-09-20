export type LngLat = readonly [number, number];
export type Point2 = Readonly<{ x: number; y: number }>;
export type TerrainFootprint = Readonly<{
  corners: readonly [LngLat, LngLat, LngLat, LngLat];
  widthPx: number;
  heightPx: number;
  bearing: number;
  pitch: number;
}>;

const EARTH_CIRCUMFERENCE_METERS = 40_075_016.68557849;
const MAX_LATITUDE = 85.0511287798066;

export function projectTerrainCoordinate([longitude, latitude]: LngLat): Point2 {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(latitude) > MAX_LATITUDE) {
    throw new Error('Terrain requires finite coordinates within Web Mercator elevation coverage (85 degrees latitude).');
  }
  const radians = latitude * Math.PI / 180;
  return { x: (longitude + 180) / 360, y: (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 };
}

export function terrainFrame(footprint: TerrainFootprint) {
  if (!Number.isFinite(footprint.pitch) || Math.abs(footprint.pitch) > 0.000001) {
    throw new Error('Set camera Pitch to 0 degrees before exporting STL. Bearing is supported; a perspective footprint cannot preserve model scale.');
  }
  if ([footprint.widthPx, footprint.heightPx].some((value) => !(Number.isFinite(value) && value > 0))) {
    throw new Error('The print frame must have positive dimensions.');
  }
  // Unprojected frame longitudes are already continuous, including across the dateline.
  const [origin, topRight, bottomRight, bottomLeft] = footprint.corners.map((coordinate) => projectTerrainCoordinate(coordinate));
  const across = { x: topRight.x - origin.x, y: topRight.y - origin.y };
  const down = { x: bottomLeft.x - origin.x, y: bottomLeft.y - origin.y };
  const width = Math.hypot(across.x, across.y);
  const height = Math.hypot(down.x, down.y);
  const determinant = across.x * down.y - across.y * down.x;
  if (width <= 0 || height <= 0 || width > 0.25 || height > 0.25 || determinant <= 0) {
    throw new Error('Zoom in to a smaller, non-empty print area before exporting terrain.');
  }
  const closureError = Math.hypot(bottomRight.x - origin.x - across.x - down.x, bottomRight.y - origin.y - across.y - down.y);
  if (closureError > Math.max(width, height) * 0.005 || Math.abs(across.x * down.x + across.y * down.y) > width * height * 0.005) {
    throw new Error('The terrain print footprint is not rectangular. Set Pitch to 0 and retry.');
  }
  const centerY = origin.y + (across.y + down.y) / 2;
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * centerY)));
  const metersPerWorld = EARTH_CIRCUMFERENCE_METERS * Math.cos(latitude);
  return {
    widthMeters: width * metersPerWorld,
    heightMeters: height * metersPerWorld,
    sample: (u: number, v: number): Point2 => ({
      x: origin.x + across.x * u + down.x * v,
      y: origin.y + across.y * u + down.y * v,
    }),
    projectRoute: (coordinate: LngLat): Point2 => {
      const projected = projectTerrainCoordinate(coordinate);
      const centerX = origin.x + (across.x + down.x) / 2;
      const x = projected.x + Math.round(centerX - projected.x) - origin.x;
      const y = projected.y - origin.y;
      return { x: (x * down.y - y * down.x) / determinant, y: (across.x * y - across.y * x) / determinant };
    },
  };
}
