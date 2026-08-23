export const POI_MARKER_SHAPES = ['circle', 'square', 'diamond'] as const;
export type PoiMarkerShape = (typeof POI_MARKER_SHAPES)[number];

export const POI_MARKER_SHAPE_LABELS: Record<PoiMarkerShape, string> = {
  circle: 'Circle',
  square: 'Square',
  diamond: 'Diamond',
};

export const POI_MARKER_SYMBOLS = ['none', 'information', 'coffee', 'food', 'lodging', 'parking'] as const;
export type PoiMarkerSymbol = (typeof POI_MARKER_SYMBOLS)[number];

export const POI_MARKER_SYMBOL_LABELS: Record<PoiMarkerSymbol, string> = {
  none: 'None',
  information: 'Information',
  coffee: 'Coffee',
  food: 'Food',
  lodging: 'Lodging',
  parking: 'Parking',
};

export const POI_MARKER_SYMBOL_GLYPHS: Record<PoiMarkerSymbol, string> = {
  none: '',
  information: 'i',
  coffee: 'C',
  food: 'F',
  lodging: 'B',
  parking: 'P',
};

export const MAX_POI_LABEL_CHARACTERS = 40;

export function hasPoiLabelControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

export function isPoiLabelValid(value: string): boolean {
  return value.trim() === value
    && !hasPoiLabelControlCharacter(value)
    && [...value].length <= MAX_POI_LABEL_CHARACTERS;
}
