import type { ContentLayer, ShapeAppearance } from '../domain/project';
import type { PagePoint } from './scene';

type ShapeElementOptions = Readonly<{
  layer: ContentLayer;
  appearance: ShapeAppearance;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidthMm: number;
  project: (coordinate: readonly [number, number]) => PagePoint;
  fail: (message: string) => never;
}>;

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function pointText(point: PagePoint): string {
  return `${formatNumber(point.x)} ${formatNumber(point.y)}`;
}

export function serializeShapeElement(options: ShapeElementOptions): string {
  const geometry = options.layer.geometry;
  if (geometry?.type !== 'Polygon' || geometry.coordinates.length === 0) {
    options.fail(`Layer "${options.layer.id}" polygon must contain at least one ring.`);
  }
  const rings = geometry.coordinates.map((ring) => {
    if (ring.length < 4) {
      options.fail(`Layer "${options.layer.id}" polygon rings must contain at least four coordinates.`);
    }
    const first = ring[0];
    const last = ring.at(-1);
    if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
      options.fail(`Layer "${options.layer.id}" polygon rings must be closed.`);
    }
    return ring.map((coordinate, index) => (
      `${index === 0 ? 'M' : 'L'} ${pointText(options.project(coordinate))}`
    )).join(' ') + ' Z';
  });
  const ringPath = rings.join(' ');
  const stroke = `stroke="${options.stroke}" stroke-width="${formatNumber(options.strokeWidthMm)}"`;
  if (!options.appearance.invert) {
    return `<path d="${ringPath}" fill="${options.fill}" ${stroke} fill-rule="evenodd" stroke-linejoin="round"/>`;
  }
  const width = formatNumber(options.width);
  const height = formatNumber(options.height);
  const pagePath = `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;
  return `<path data-shape-fill="inverted" d="${pagePath} ${ringPath}" fill="${options.fill}" stroke="none" fill-rule="evenodd"/><path data-shape-outline="true" d="${ringPath}" fill="none" ${stroke} stroke-linejoin="round"/>`;
}
