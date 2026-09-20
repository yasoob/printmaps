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

function cross(a: Point2, b: Point2): number { return a.x * b.y - a.y * b.x; }

function inverseFrame(point: Point2, across: Point2, down: Point2, warp: Point2): Point2 {
  const determinant = cross(across, down);
  let u = cross(point, down) / determinant;
  let v = cross(across, point) / determinant;
  // Terrain-aware unprojection bends the footprint even at pitch zero. Invert the
  // same bilinear surface used to sample the DEM, rather than dropping corner four.
  for (let iteration = 0; iteration < 12; iteration++) {
    const error = { x: across.x * u + down.x * v + warp.x * u * v - point.x, y: across.y * u + down.y * v + warp.y * u * v - point.y };
    const du = { x: across.x + warp.x * v, y: across.y + warp.y * v };
    const dv = { x: down.x + warp.x * u, y: down.y + warp.y * u };
    const jacobian = cross(du, dv);
    if (Math.abs(jacobian) < determinant * 0.000001) throw new Error('The route cannot be projected onto this terrain footprint. Zoom out or disable the route ridge.');
    const deltaU = cross(error, dv) / jacobian;
    const deltaV = cross(du, error) / jacobian;
    u -= deltaU; v -= deltaV;
    if (Math.abs(deltaU) + Math.abs(deltaV) < 0.0000001) return { x: u, y: v };
  }
  throw new Error('The route is too far from this terrain footprint. Choose a route within the print area.');
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
  const warp = { x: bottomRight.x - topRight.x - bottomLeft.x + origin.x, y: bottomRight.y - topRight.y - bottomLeft.y + origin.y };
  const farAcross = { x: across.x + warp.x, y: across.y + warp.y };
  const farDown = { x: down.x + warp.x, y: down.y + warp.y };
  const width = (Math.hypot(across.x, across.y) + Math.hypot(farAcross.x, farAcross.y)) / 2;
  const height = (Math.hypot(down.x, down.y) + Math.hypot(farDown.x, farDown.y)) / 2;
  const determinant = cross(across, down);
  if (width <= 0 || height <= 0 || width > 0.25 || height > 0.25 || determinant <= 0) {
    throw new Error('Zoom in to a smaller, non-empty print area before exporting terrain.');
  }
  if ([cross(farAcross, down), cross(across, farDown), cross(farAcross, farDown)].some((area) => area <= width * height * 0.01)) {
    throw new Error('The terrain print footprint folds over itself. Reduce exaggeration or zoom out before exporting.');
  }
  const centerY = origin.y + (across.y + down.y) / 2 + warp.y / 4;
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * centerY)));
  const metersPerWorld = EARTH_CIRCUMFERENCE_METERS * Math.cos(latitude);
  return {
    widthMeters: width * metersPerWorld,
    heightMeters: height * metersPerWorld,
    sample: (u: number, v: number): Point2 => ({
      x: origin.x + across.x * u + down.x * v + warp.x * u * v,
      y: origin.y + across.y * u + down.y * v + warp.y * u * v,
    }),
    projectRoute: (coordinate: LngLat): Point2 => {
      const projected = projectTerrainCoordinate(coordinate);
      const centerX = origin.x + (across.x + down.x) / 2 + warp.x / 4;
      const x = projected.x + Math.round(centerX - projected.x) - origin.x;
      const y = projected.y - origin.y;
      return inverseFrame({ x, y }, across, down, warp);
    },
  };
}
