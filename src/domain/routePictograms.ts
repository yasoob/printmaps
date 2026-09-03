import type { RouteTravelMarker } from './routeProfiles';

export const ROUTE_PICTOGRAM_VIEWBOX = 24;
export const ROUTE_PICTOGRAM_CONTENT_SCALE = 0.82;

export type PictogramPrimitive =
  | Readonly<{ type: 'circle'; cx: number; cy: number; r: number; fill?: boolean; strokeWidth?: number }>
  | Readonly<{ type: 'path'; points: readonly (readonly [number, number])[]; closed?: boolean; fill?: boolean; strokeWidth?: number }>;

const path = (
  points: readonly (readonly [number, number])[],
  options: Omit<Extract<PictogramPrimitive, { type: 'path' }>, 'type' | 'points'> = {},
): PictogramPrimitive => ({ type: 'path', points, ...options });

/*
 * These compact, normalized shapes were drawn for Print Map Studio. Keeping the
 * source as primitives lets screen, SVG, and PDF output share the exact artwork.
 */
export const ROUTE_PICTOGRAMS: Readonly<Record<RouteTravelMarker, readonly PictogramPrimitive[]>> = {
  air: [
    path([[3, 13], [10, 11], [11, 3], [13, 3], [14, 11], [21, 13], [21, 15], [14, 14], [14, 18], [17, 20], [17, 21], [12, 20], [7, 21], [7, 20], [10, 18], [10, 14], [3, 15]], { closed: true, fill: true }),
  ],
  rail: [
    path([[7, 4], [17, 4], [19, 7], [19, 16], [16, 19], [8, 19], [5, 16], [5, 7]], { closed: true, strokeWidth: 2 }),
    path([[6, 10], [18, 10]], { strokeWidth: 2 }),
    path([[8, 19], [6, 22]], { strokeWidth: 2 }),
    path([[16, 19], [18, 22]], { strokeWidth: 2 }),
    { type: 'circle', cx: 9, cy: 15, r: 1.2, fill: true },
    { type: 'circle', cx: 15, cy: 15, r: 1.2, fill: true },
  ],
  car: [
    path([[4, 14], [6, 9], [9, 7], [16, 7], [19, 11], [21, 13], [20, 18], [4, 18]], { closed: true, strokeWidth: 2 }),
    path([[7, 11], [18, 11]], { strokeWidth: 2 }),
    { type: 'circle', cx: 8, cy: 18, r: 2, fill: true },
    { type: 'circle', cx: 17, cy: 18, r: 2, fill: true },
  ],
  walk: [
    { type: 'circle', cx: 13, cy: 4.5, r: 2, fill: true },
    path([[12, 8], [9, 13], [5, 15]], { strokeWidth: 2.4 }),
    path([[12, 8], [16, 11], [20, 11]], { strokeWidth: 2.4 }),
    path([[12, 9], [13, 15], [18, 21]], { strokeWidth: 2.4 }),
    path([[13, 15], [9, 21]], { strokeWidth: 2.4 }),
  ],
  bike: [
    { type: 'circle', cx: 6, cy: 17, r: 4, strokeWidth: 1.8 },
    { type: 'circle', cx: 18, cy: 17, r: 4, strokeWidth: 1.8 },
    path([[6, 17], [10, 10], [14, 17], [6, 17], [11, 17], [16, 9], [19, 9]], { strokeWidth: 1.8 }),
    path([[9, 8], [13, 8]], { strokeWidth: 1.8 }),
  ],
  ship: [
    path([[4, 13], [20, 13], [17, 19], [12, 21], [7, 19]], { closed: true, fill: true }),
    path([[8, 13], [8, 8], [16, 8], [16, 13]], { strokeWidth: 2 }),
    path([[11, 8], [11, 4], [15, 6], [11, 6]], { closed: true, fill: true }),
  ],
};

export const routePictogramImageId = (pictogram: RouteTravelMarker, color: string) => (
  `studio-route-pictogram-${pictogram}-${color.replace('#', '').toLowerCase()}`
);

function traceCanvasPrimitive(context: CanvasRenderingContext2D, primitive: PictogramPrimitive) {
  context.beginPath();
  if (primitive.type === 'circle') {
    // Path2D is unavailable in some supported lightweight canvas implementations.
    // eslint-disable-next-line unicorn/prefer-path2d
    context.arc(primitive.cx, primitive.cy, primitive.r, 0, Math.PI * 2);
  } else {
    const [first, ...rest] = primitive.points;
    if (!first) return;
    context.moveTo(first[0], first[1]);
    for (const point of rest) context.lineTo(point[0], point[1]);
    if (primitive.closed) context.closePath();
  }
  if (primitive.fill) context.fill();
  if (!primitive.fill || primitive.strokeWidth) {
    context.lineWidth = primitive.strokeWidth ?? 1.8;
    context.stroke();
  }
}

export function drawRoutePictogram(
  context: CanvasRenderingContext2D,
  pictogram: RouteTravelMarker,
  color: string,
  size: number,
) {
  context.save();
  context.scale(size / ROUTE_PICTOGRAM_VIEWBOX, size / ROUTE_PICTOGRAM_VIEWBOX);
  context.fillStyle = color;
  context.beginPath();
  context.arc(12, 12, 11, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#ffffff';
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.fillStyle = '#ffffff';
  context.translate(12, 12);
  context.scale(ROUTE_PICTOGRAM_CONTENT_SCALE, ROUTE_PICTOGRAM_CONTENT_SCALE);
  context.translate(-12, -12);
  const primitives = ROUTE_PICTOGRAMS[pictogram];
  for (const primitive of primitives) traceCanvasPrimitive(context, primitive);
  context.restore();
}

export function createRoutePictogramImage(
  pictogram: RouteTravelMarker,
  color: string,
  size = 48,
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Route pictogram rendering requires a 2D canvas.');
  drawRoutePictogram(context, pictogram, color, size);
  return context.getImageData(0, 0, size, size);
}

function svgPrimitive(primitive: PictogramPrimitive): string {
  const paint = primitive.fill
    ? `fill="#ffffff"${primitive.strokeWidth ? ` stroke="#ffffff" stroke-width="${primitive.strokeWidth}"` : ''}`
    : `fill="none" stroke="#ffffff" stroke-width="${primitive.strokeWidth ?? 1.8}"`;
  if (primitive.type === 'circle') {
    return `<circle cx="${primitive.cx}" cy="${primitive.cy}" r="${primitive.r}" ${paint}/>`;
  }
  const commands = primitive.points.map((point, index) => (
    `${index === 0 ? 'M' : 'L'} ${point[0]} ${point[1]}`
  )).join(' ');
  return `<path d="${commands}${primitive.closed ? ' Z' : ''}" ${paint}/>`;
}

export function routePictogramSvg(
  pictogram: RouteTravelMarker,
  color: string,
  options: Readonly<{
    point: Readonly<{ x: number; y: number }>;
    radius: number;
    bearing: number;
  }>,
): string {
  const scale = options.radius * 2 / ROUTE_PICTOGRAM_VIEWBOX;
  const primitives = ROUTE_PICTOGRAMS[pictogram]
    .map((primitive) => svgPrimitive(primitive))
    .join('');
  return `<g data-route-pictogram="${pictogram}" transform="translate(${options.point.x} ${options.point.y}) rotate(${options.bearing}) scale(${scale}) translate(-12 -12)" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="11" fill="${color}"/><g transform="translate(12 12) scale(${ROUTE_PICTOGRAM_CONTENT_SCALE}) translate(-12 -12)">${primitives}</g></g>`;
}

function transformPoint(
  point: readonly [number, number],
  center: Readonly<{ x: number; y: number }>,
  radius: number,
  bearing: number,
) {
  const scale = radius * 2 / ROUTE_PICTOGRAM_VIEWBOX;
  const angle = bearing * Math.PI / 180;
  const x = (point[0] - 12) * scale;
  const y = (12 - point[1]) * scale;
  return {
    x: center.x + x * Math.cos(angle) + y * Math.sin(angle),
    y: center.y - x * Math.sin(angle) + y * Math.cos(angle),
  };
}

export type PdfPictogramPrimitive =
  | Readonly<{ type: 'circle'; center: { x: number; y: number }; radius: number; fill: boolean; strokeWidth: number }>
  | Readonly<{ type: 'path'; points: readonly { x: number; y: number }[]; closed: boolean; fill: boolean; strokeWidth: number }>;

export function routePictogramPdfGeometry(
  pictogram: RouteTravelMarker,
  center: Readonly<{ x: number; y: number }>,
  radius: number,
  bearing: number,
): readonly PdfPictogramPrimitive[] {
  const scale = radius * 2 / ROUTE_PICTOGRAM_VIEWBOX;
  const contentRadius = radius * ROUTE_PICTOGRAM_CONTENT_SCALE;
  const contentScale = scale * ROUTE_PICTOGRAM_CONTENT_SCALE;
  return [
    { type: 'circle', center, radius: radius * 11 / 12, fill: true, strokeWidth: 0 },
    ...ROUTE_PICTOGRAMS[pictogram].map((primitive): PdfPictogramPrimitive => primitive.type === 'circle'
      ? {
          type: 'circle',
          center: transformPoint([primitive.cx, primitive.cy], center, contentRadius, bearing),
          radius: primitive.r * contentScale,
          fill: primitive.fill ?? false,
          strokeWidth: (primitive.strokeWidth ?? 1.8) * contentScale,
        }
      : {
          type: 'path',
          points: primitive.points.map((point) => transformPoint(point, center, contentRadius, bearing)),
          closed: primitive.closed ?? false,
          fill: primitive.fill ?? false,
          strokeWidth: (primitive.strokeWidth ?? 1.8) * contentScale,
        }),
  ];
}
