export const PAGE_PRESET_DEFINITIONS = [
  { id: 'A2', label: 'A2', longEdgeMm: 594, shortEdgeMm: 420 },
  { id: 'A3', label: 'A3', longEdgeMm: 420, shortEdgeMm: 297 },
  { id: 'A4', label: 'A4', longEdgeMm: 297, shortEdgeMm: 210 },
  { id: 'A5', label: 'A5', longEdgeMm: 210, shortEdgeMm: 148 },
  { id: 'A6', label: 'A6', longEdgeMm: 148, shortEdgeMm: 105 },
  { id: 'US Letter', label: 'US Letter', longEdgeMm: 279.4, shortEdgeMm: 215.9 },
] as const;

export type StandardPagePreset = (typeof PAGE_PRESET_DEFINITIONS)[number]['id'];
export type PagePreset = StandardPagePreset | 'Custom';

export function pagePresetDimensions(preset: StandardPagePreset): readonly [number, number] {
  const definition = PAGE_PRESET_DEFINITIONS.find(({ id }) => id === preset);
  if (!definition) throw new Error(`Unsupported page preset: ${preset}`);
  return [definition.longEdgeMm, definition.shortEdgeMm];
}
