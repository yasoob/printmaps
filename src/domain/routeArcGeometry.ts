import { MAX_MERCATOR_LATITUDE } from './project';

export const DEFAULT_ARC_CURVATURE = 0.35;
export const MIN_ARC_CURVATURE = -1;
export const MAX_ARC_CURVATURE = 1;
export const DEFAULT_ARC_SEGMENTS = 24;

export type Position = [number, number];
export type ArcGeometry = {
  type: 'Arc';
  anchors: [Position, Position, ...Position[]];
  curvatures: [number, ...number[]];
};

type ReadonlyPosition = readonly [number, number];
type ProjectedPosition = { x: number; y: number };

const MAX_LATITUDE = 85.051129;

function toMercator([longitude, latitude]: ReadonlyPosition): ProjectedPosition {
  const radians = latitude * Math.PI / 180;
  return {
    x: (longitude + 180) / 360,
    y: (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2,
  };
}

function toPosition({ x, y }: ProjectedPosition): Position {
  const wrappedX = ((x % 1) + 1) % 1;
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
  return [
    Number((wrappedX * 360 - 180).toFixed(6)),
    Number(Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude)).toFixed(6)),
  ];
}

function toContinuousPosition({ x, y }: ProjectedPosition): Position {
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
  return [
    Number((x * 360 - 180).toFixed(6)),
    Number(Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude)).toFixed(6)),
  ];
}

function normalizedPair(startPosition: ReadonlyPosition, endPosition: ReadonlyPosition): [ProjectedPosition, ProjectedPosition] {
  const start = toMercator(startPosition);
  const end = toMercator(endPosition);
  while (end.x - start.x > 0.5) end.x -= 1;
  while (end.x - start.x < -0.5) end.x += 1;
  const shift = Math.floor((start.x + end.x) / 2);
  start.x -= shift;
  end.x -= shift;
  return [start, end];
}

function canonicalPair(startPosition: ReadonlyPosition, endPosition: ReadonlyPosition) {
  const pair = normalizedPair(startPosition, endPosition);
  return pair[0].x < pair[1].x || (pair[0].x === pair[1].x && pair[0].y <= pair[1].y)
    ? pair
    : [pair[1], pair[0]] as [ProjectedPosition, ProjectedPosition];
}

function controlPoint(startPosition: ReadonlyPosition, endPosition: ReadonlyPosition, curvature: number): ProjectedPosition {
  const [start, end] = canonicalPair(startPosition, endPosition);
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  return {
    x: (start.x + end.x) / 2 + deltaY * curvature,
    y: (start.y + end.y) / 2 - deltaX * curvature,
  };
}

function isValidAnchor(longitude: number, latitude: number) {
  return Number.isFinite(longitude)
    && Number.isFinite(latitude)
    && longitude >= -180
    && longitude <= 180
    && latitude >= -MAX_MERCATOR_LATITUDE
    && latitude <= MAX_MERCATOR_LATITUDE;
}

export function isValidArcCurvature(curvature: number) {
  return Number.isFinite(curvature)
    && curvature >= MIN_ARC_CURVATURE
    && curvature <= MAX_ARC_CURVATURE;
}

function isValidSegment(start: ReadonlyPosition, end: ReadonlyPosition) {
  if (start[0] === end[0] && start[1] === end[1]) return false;
  return Math.abs(end[0] - start[0]) !== 180;
}

export function createArcGeometry(
  anchors: readonly ReadonlyPosition[],
  curvatures: readonly number[] = Array.from(
    { length: Math.max(0, anchors.length - 1) },
    () => DEFAULT_ARC_CURVATURE,
  ),
): ArcGeometry | null {
  if (
    anchors.length < 2
    || anchors.some(([longitude, latitude]) => !isValidAnchor(longitude, latitude))
    || anchors.slice(1).some((anchor, index) => !isValidSegment(anchors[index], anchor))
    || curvatures.length !== anchors.length - 1
    || curvatures.some((curvature) => !isValidArcCurvature(curvature))
  ) return null;
  return {
    type: 'Arc',
    anchors: anchors.map(([longitude, latitude]) => [longitude, latitude]) as ArcGeometry['anchors'],
    curvatures: [...curvatures] as ArcGeometry['curvatures'],
  };
}

export function arcSegmentControlPosition(arc: ArcGeometry, segmentIndex: number): Position {
  const start = arc.anchors[segmentIndex];
  const end = arc.anchors[segmentIndex + 1];
  const curvature = arc.curvatures[segmentIndex];
  if (!start || !end || curvature === undefined) throw new RangeError('Arc segment index is out of range.');
  return toPosition(controlPoint(start, end, curvature));
}

export function arcSegmentPoint(arc: ArcGeometry, segmentIndex: number, fraction: number): Position {
  const startPosition = arc.anchors[segmentIndex];
  const endPosition = arc.anchors[segmentIndex + 1];
  const curvature = arc.curvatures[segmentIndex];
  if (!startPosition || !endPosition || curvature === undefined) throw new RangeError('Arc segment index is out of range.');
  const boundedFraction = Math.max(0, Math.min(1, fraction));
  if (boundedFraction === 0) return [...startPosition];
  if (boundedFraction === 1) return [...endPosition];
  const inverse = 1 - boundedFraction;
  const [start, end] = normalizedPair(startPosition, endPosition);
  const control = controlPoint(startPosition, endPosition, curvature);
  return toPosition({
    x: inverse * inverse * start.x + 2 * inverse * boundedFraction * control.x + boundedFraction * boundedFraction * end.x,
    y: inverse * inverse * start.y + 2 * inverse * boundedFraction * control.y + boundedFraction * boundedFraction * end.y,
  });
}

export function sampleArc(arc: ArcGeometry, segmentsPerArc = DEFAULT_ARC_SEGMENTS): Position[] {
  const count = Math.max(1, Math.floor(segmentsPerArc));
  const samples = arc.curvatures.flatMap((_, segmentIndex) => (
    Array.from({ length: count + 1 }, (_unused, pointIndex) => (
      arcSegmentPoint(arc, segmentIndex, pointIndex / count)
    )).slice(segmentIndex === 0 ? 0 : 1)
  ));
  for (let index = 1; index < samples.length; index += 1) {
    while (samples[index][0] - samples[index - 1][0] > 180) samples[index][0] -= 360;
    while (samples[index][0] - samples[index - 1][0] < -180) samples[index][0] += 360;
  }
  return samples;
}

export function sampledPathMidpoint(coordinates: readonly ReadonlyPosition[]): Position {
  if (coordinates.length < 2) throw new RangeError('A path needs at least two positions.');
  const projected: ProjectedPosition[] = [];
  for (const coordinate of coordinates) {
    const point = toMercator(coordinate);
    const previous = projected.at(-1);
    if (previous) {
      while (point.x - previous.x > 0.5) point.x -= 1;
      while (point.x - previous.x < -0.5) point.x += 1;
    }
    projected.push(point);
  }
  const segments = projected.slice(1).map((end, index) => {
    const start = projected[index];
    return { end, length: Math.hypot(end.x - start.x, end.y - start.y), start };
  });
  const target = segments.reduce((total, segment) => total + segment.length, 0) / 2;
  let traversed = 0;
  for (const segment of segments) {
    if (traversed + segment.length >= target) {
      const fraction = segment.length === 0 ? 0 : (target - traversed) / segment.length;
      return toContinuousPosition({
        x: segment.start.x + (segment.end.x - segment.start.x) * fraction,
        y: segment.start.y + (segment.end.y - segment.start.y) * fraction,
      });
    }
    traversed += segment.length;
  }
  return [...coordinates.at(-1)!];
}

export function rebasePathLongitudes(
  coordinates: readonly ReadonlyPosition[],
  referenceLongitude?: number,
): Position[] {
  if (coordinates.length === 0) return [];
  const continuous = coordinates.map(([longitude, latitude]) => [longitude, latitude] as Position);
  for (let index = 1; index < continuous.length; index += 1) {
    while (continuous[index][0] - continuous[index - 1][0] > 180) continuous[index][0] -= 360;
    while (continuous[index][0] - continuous[index - 1][0] < -180) continuous[index][0] += 360;
  }
  const worldOffset = referenceLongitude === undefined
    ? 0
    : Math.round((referenceLongitude - continuous[0][0]) / 360) * 360;
  return continuous.map(([longitude, latitude]) => [longitude + worldOffset, latitude]);
}

export function arcPoint(arc: ArcGeometry, fraction: number): Position {
  const boundedFraction = Math.max(0, Math.min(1, fraction));
  const scaled = boundedFraction * arc.curvatures.length;
  const segmentIndex = Math.min(Math.floor(scaled), arc.curvatures.length - 1);
  return arcSegmentPoint(arc, segmentIndex, scaled - segmentIndex);
}

export function arcControlPosition(arc: ArcGeometry): Position {
  return arcSegmentControlPosition(arc, 0);
}
