import type { LinkedFile, PlacedLayer } from 'ag-psd';
import type { PsdSvgRasterLayer } from './layeredPsdSvg';

export type PsdSmartObject = Readonly<{
  linkedFile: LinkedFile;
  placedLayer: PlacedLayer;
}>;

function hash32(value: string, seed: number): string {
  let hash = 0x81_1C_9D_C5 ^ seed;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.codePointAt(index) ?? 0;
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stableUuid(value: string): string {
  const hexadecimal = [0, 1, 2, 3].map((seed) => hash32(value, seed)).join('');
  const variant = ((Number.parseInt(hexadecimal[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  return [
    hexadecimal.slice(0, 8),
    hexadecimal.slice(8, 12),
    `4${hexadecimal.slice(13, 16)}`,
    `${variant}${hexadecimal.slice(17, 20)}`,
    hexadecimal.slice(20, 32),
  ].join('-');
}

function svgFilename(name: string, index: number): string {
  const slug = name
    .normalize('NFKD')
    .replaceAll(/[\u{0300}-\u{036F}]/gu, '')
    .replaceAll(/[^a-z0-9._-]+/gi, '-')
    .replaceAll(/^[-.]+|[-.]+$/g, '')
    .toLowerCase() || 'layer';
  return `${String(index + 1).padStart(3, '0')}-${slug}.svg`;
}

export function createPsdSmartObject(
  layer: PsdSvgRasterLayer,
  options: Readonly<{
    documentId: string;
    effectiveDpi: number;
    index: number;
    output: Readonly<{ width: number; height: number }>;
  }>,
): PsdSmartObject {
  const identity = `${options.documentId}\0${options.index}\0${layer.name}`;
  const linkedId = stableUuid(`linked\0${identity}`);
  const placedId = stableUuid(`placed\0${identity}`);
  const { width, height } = options.output;
  return {
    linkedFile: {
      data: new TextEncoder().encode(layer.svg),
      id: linkedId,
      name: svgFilename(layer.name, options.index),
    },
    placedLayer: {
      id: linkedId,
      placed: placedId,
      type: 'vector',
      transform: [0, 0, width, 0, width, height, 0, height],
      width,
      height,
      resolution: { value: options.effectiveDpi, units: 'Density' },
    },
  };
}
