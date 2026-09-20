export type StudioPoint = Readonly<{ x: number; y: number }>;
export type StudioBox = Readonly<StudioPoint & { width: number; height: number }>;
export type StudioProjector = (coordinate: readonly [number, number]) => StudioPoint;
const CENTER_FOCAL_POINT = { x: 0.5, y: 0.5 };

export function xml(value: string): string {
  return value.replaceAll(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]!);
}

export function decimal(value: number): string {
  if (!Number.isFinite(value)) throw new Error('The poster projection returned a non-finite coordinate.');
  return String(Math.round(value * 1e6) / 1e6);
}

export function boxAttributes(box: StudioBox): string {
  return `x="${decimal(box.x)}" y="${decimal(box.y)}" width="${decimal(box.width)}" height="${decimal(box.height)}"`;
}

export function coverImageBox(
  image: Readonly<{ width: number; height: number }>,
  box: StudioBox,
  focal: Readonly<{ x: number; y: number }> = CENTER_FOCAL_POINT,
): StudioBox {
  const scale = Math.max(box.width / image.width, box.height / image.height);
  const width = image.width * scale, height = image.height * scale;
  return {
    x: box.x - (width - box.width) * focal.x,
    y: box.y - (height - box.height) * focal.y,
    width, height,
  };
}

export function niceDistance(maximum: number): number {
  if (!Number.isFinite(maximum) || maximum <= 0) {
    throw new Error('The map projection cannot provide a reliable scale at this location.');
  }
  const power = 10 ** Math.floor(Math.log10(maximum));
  const unit = maximum / power;
  return (unit >= 5 ? 5 : (unit >= 2 ? 2 : 1)) * power;
}

export function distanceLabel(metres: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    const feet = metres / 0.3048;
    return feet >= 5280 ? `${Number((feet / 5280).toPrecision(4))} mi` : `${Number(feet.toPrecision(4))} ft`;
  }
  return metres >= 1000 ? `${Number((metres / 1000).toPrecision(4))} km` : `${Number(metres.toPrecision(4))} m`;
}

export function scaleAtCenter(
  center: readonly [number, number],
  project: StudioProjector,
  maximumWidthMm: number,
  units: 'metric' | 'imperial',
): Readonly<{ widthMm: number; metres: number; label: string }> {
  // A symmetric differential of Web Mercator measures local ground scale, not screen zoom.
  const delta = 0.0001;
  const west = project([center[0] - delta, center[1]]);
  const east = project([center[0] + delta, center[1]]);
  const groundMetres = 6_378_137 * Math.cos(center[1] * Math.PI / 180) * 2 * delta * Math.PI / 180;
  const mmPerMetre = Math.hypot(east.x - west.x, east.y - west.y) / groundMetres;
  const maximumMetres = maximumWidthMm / mmPerMetre;
  let metres = niceDistance(maximumMetres);
  if (units === 'imperial') {
    const unit = maximumMetres >= 1609.344 ? 1609.344 : 0.3048;
    metres = niceDistance(maximumMetres / unit) * unit;
  }
  return { metres, widthMm: metres * mmPerMetre, label: distanceLabel(metres, units) };
}

export function projectedNorthAngle(center: readonly [number, number], project: StudioProjector): number {
  const from = project(center);
  const to = project([center[0], Math.min(85.051129, center[1] + 0.001)]);
  if (Math.hypot(to.x - from.x, to.y - from.y) < 1e-9) {
    throw new Error('North cannot be determined at this camera position.');
  }
  return Math.atan2(to.x - from.x, from.y - to.y) * 180 / Math.PI;
}

export function fittedText(options: Readonly<{
  text: string; x: number; y: number; size: number; maxWidth: number;
  color: string; family: string; weight?: number; anchor?: 'start' | 'middle';
}>): string {
  const { text, x, y, size, maxWidth, color, family, weight = 400, anchor = 'middle' } = options;
  if (!text) return '';
  const length = [...text].length;
  const fittedSize = Math.min(size, maxWidth / Math.max(1, length * 0.72));
  return `<text x="${decimal(x)}" y="${decimal(y)}" fill="${xml(color)}" font-family="${xml(family)}" font-size="${decimal(fittedSize)}" font-weight="${weight}" text-anchor="${anchor}">${xml(text)}</text>`;
}
