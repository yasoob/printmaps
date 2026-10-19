import { PAGE_PRESET_DEFINITIONS } from '../domain/pagePresets';
import { millimetresToPixels } from '../export/preflight';

/**
 * Paper sizes for the print size guide. Every pixel figure is computed with the exporter's own
 * `millimetresToPixels`, so the guide and the editor agree on rounding.
 */
export type PrintSize = {
  name: string;
  longEdgeMm: number;
  shortEdgeMm: number;
  /**
  True when the size is a page preset in the editor rather than a custom entry.
  */
  preset: boolean;
};

const presetSizes: PrintSize[] = PAGE_PRESET_DEFINITIONS.map(({ label, longEdgeMm, shortEdgeMm }) => ({
  name: label,
  longEdgeMm,
  shortEdgeMm,
  preset: true,
}));

const customSizes: PrintSize[] = [
  { name: 'Tabloid (11 × 17 in)', longEdgeMm: 431.8, shortEdgeMm: 279.4, preset: false },
  { name: '18 × 24 in', longEdgeMm: 609.6, shortEdgeMm: 457.2, preset: false },
  { name: '50 × 70 cm', longEdgeMm: 700, shortEdgeMm: 500, preset: false },
  { name: 'A1', longEdgeMm: 841, shortEdgeMm: 594, preset: false },
  { name: '24 × 36 in', longEdgeMm: 914.4, shortEdgeMm: 609.6, preset: false },
];

function sortedByArea(sizes: PrintSize[]): PrintSize[] {
  sizes.sort((a, b) => a.longEdgeMm * a.shortEdgeMm - b.longEdgeMm * b.shortEdgeMm);
  return sizes;
}

export const PRINT_SIZES: readonly PrintSize[] = sortedByArea([...presetSizes, ...customSizes]);

export function printSize(name: string): PrintSize {
  const size = PRINT_SIZES.find((candidate) => candidate.name === name);
  if (!size) throw new Error(`Unknown print size: ${name}`);
  return size;
}

/**
Joins two measurements with non-breaking spaces so a pair such as 297 × 210 never wraps mid-value.
*/
export function dimensionPair(first: string, second: string): string {
  return `${first}\u{A0}×\u{A0}${second}`;
}

export function formatMillimetres(value: number): string {
  return Number.isSafeInteger(value) ? String(value) : value.toFixed(1);
}

export function formatInches(mm: number): string {
  const inches = mm / 25.4;
  return Number.isSafeInteger(Math.round(inches * 100) / 100) ? String(Math.round(inches)) : inches.toFixed(1);
}

export function pixelDimensions(size: Pick<PrintSize, 'longEdgeMm' | 'shortEdgeMm'>, dpi: number): string {
  const long = millimetresToPixels(size.longEdgeMm, dpi, 'round');
  const short = millimetresToPixels(size.shortEdgeMm, dpi, 'round');
  return dimensionPair(long.toLocaleString('en-US'), short.toLocaleString('en-US'));
}

export function megapixels(size: Pick<PrintSize, 'longEdgeMm' | 'shortEdgeMm'>, dpi: number): number {
  const long = millimetresToPixels(size.longEdgeMm, dpi, 'round');
  const short = millimetresToPixels(size.shortEdgeMm, dpi, 'round');
  return Math.round((long * short) / 1e6);
}

/**
One arcminute of visual acuity expressed as pixels per inch at a given distance.
*/
export function pixelsPerInchForDistance(distanceCm: number): number {
  const distanceInches = distanceCm / 2.54;
  return 1 / (distanceInches * Math.tan(Math.PI / (180 * 60)));
}
