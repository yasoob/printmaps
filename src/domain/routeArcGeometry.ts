import { MAX_MERCATOR_LATITUDE } from './project';

export type ArcGeometry = {
  type: 'Arc';
  anchors: [[number, number], [number, number]];
};

type Position = readonly [number, number];
type ProjectedPosition = { x: number; y: number };

const BULGE = 0.35;
const MAX_LATITUDE = 85.051129;

function toMercator([longitude, latitude]: Position): ProjectedPosition {
  const radians = latitude * Math.PI / 180;
  return {
    x: (longitude + 180) / 360,
    y: (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2,
  };
}

function toPosition({ x, y }: ProjectedPosition): [number, number] {
  const wrappedX = ((x % 1) + 1) % 1;
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
  return [
    Number((wrappedX * 360 - 180).toFixed(6)),
    Number(Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude)).toFixed(6)),
  ];
}

function normalizedPair(anchors: ArcGeometry['anchors']): [ProjectedPosition, ProjectedPosition] {
  const first = toMercator(anchors[0]);
  const second = toMercator(anchors[1]);
  while (second.x - first.x > 0.5) second.x -= 1;
  while (second.x - first.x < -0.5) second.x += 1;
  const shift = Math.floor((first.x + second.x) / 2);
  first.x -= shift;
  second.x -= shift;
  return [first, second];
}

function canonicalPair(arc: ArcGeometry) {
  const pair = normalizedPair(arc.anchors);
  return pair[0].x < pair[1].x || (pair[0].x === pair[1].x && pair[0].y <= pair[1].y)
    ? pair
    : [pair[1], pair[0]] as [ProjectedPosition, ProjectedPosition];
}

function controlPoint(arc: ArcGeometry): ProjectedPosition {
  const [start, end] = canonicalPair(arc);
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  return {
    x: (start.x + end.x) / 2 + deltaY * BULGE,
    y: (start.y + end.y) / 2 - deltaX * BULGE,
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

export function createArcGeometry(anchors: readonly Position[]): ArcGeometry | null {
  if (anchors.length !== 2 || anchors.some(([longitude, latitude]) => !isValidAnchor(longitude, latitude))) return null;
  const [start, end] = anchors;
  if (start[0] === end[0] && start[1] === end[1]) return null;
  if (Math.abs(end[0] - start[0]) === 180) return null;
  return {
    type: 'Arc',
    anchors: [[start[0], start[1]], [end[0], end[1]]],
  };
}

export function arcControlPosition(arc: ArcGeometry): [number, number] {
  return toPosition(controlPoint(arc));
}

export function sampleArc(arc: ArcGeometry, segments = 24): [number, number][] {
  const count = Math.max(1, Math.floor(segments));
  return Array.from({ length: count + 1 }, (_, index) => arcPoint(arc, index / count));
}

export function arcPoint(arc: ArcGeometry, fraction: number): [number, number] {
  const boundedFraction = Math.max(0, Math.min(1, fraction));
  const inverse = 1 - boundedFraction;
  const [start, end] = normalizedPair(arc.anchors);
  const control = controlPoint(arc);
  return toPosition({
    x: inverse * inverse * start.x + 2 * inverse * boundedFraction * control.x + boundedFraction * boundedFraction * end.x,
    y: inverse * inverse * start.y + 2 * inverse * boundedFraction * control.y + boundedFraction * boundedFraction * end.y,
  });
}
