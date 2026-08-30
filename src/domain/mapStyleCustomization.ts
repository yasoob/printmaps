import {
  MAP_STYLE_PRESETS,
  MAP_STYLE_TOKEN_ROLES,
  type MapStylePreset,
  type MapStyleTokenRole,
  type MapStyleTokens,
} from './mapStylePresets';

export const MAP_STYLE_TONES = ['cool', 'balanced', 'warm'] as const;
export type MapStyleTone = typeof MAP_STYLE_TONES[number];
export type MapStyleColorOverrides = Partial<Record<MapStyleTokenRole, string>>;

export type MapStyleCustomization = {
  tone: MapStyleTone;
  contrast: number;
  detail: number;
  colors: MapStyleColorOverrides;
};

export function createDefaultMapStyleCustomization(): MapStyleCustomization {
  return { tone: 'balanced', contrast: 50, detail: 50, colors: {} };
}

export function isMapStyleHexColor(value: string): boolean {
  return /^#[\dA-Fa-f]{6}$/.test(value);
}

export function isMapStyleCustomized(customization: MapStyleCustomization): boolean {
  return customization.tone !== 'balanced'
    || customization.contrast !== 50
    || customization.detail !== 50
    || Object.keys(customization.colors).length > 0;
}

type Rgb = readonly [number, number, number];

function parseHexColor(value: string): Rgb {
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

function toHexColor(rgb: Rgb): string {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

function mixColor(source: string, target: string, amount: number): string {
  const from = parseHexColor(source);
  const to = parseHexColor(target);
  const ratio = Math.min(1, Math.max(0, amount));
  return toHexColor([
    from[0] + (to[0] - from[0]) * ratio,
    from[1] + (to[1] - from[1]) * ratio,
    from[2] + (to[2] - from[2]) * ratio,
  ]);
}

function isLightColor(value: string): boolean {
  const [red, green, blue] = parseHexColor(value);
  return (red * 0.299 + green * 0.587 + blue * 0.114) / 255 > 0.52;
}

const SURFACE_ROLES = new Set<MapStyleTokenRole>([
  'canvas', 'land', 'water', 'park', 'building', 'majorRoad', 'minorRoad', 'labelHalo',
]);
const CONTRAST_ROLES = new Set<MapStyleTokenRole>([
  'park', 'building', 'majorRoad', 'minorRoad', 'boundary', 'transit', 'label',
]);
const DETAIL_ROLES = new Set<MapStyleTokenRole>([
  'park', 'building', 'minorRoad', 'boundary', 'transit',
]);

function applyTone(tokens: MapStyleTokens, tone: MapStyleTone): MapStyleTokens {
  if (tone === 'balanced') return tokens;
  const target = tone === 'warm' ? '#f2b87f' : '#8fc7e8';
  return Object.fromEntries(MAP_STYLE_TOKEN_ROLES.map((role) => [
    role,
    mixColor(tokens[role], target, SURFACE_ROLES.has(role) ? 0.12 : 0.045),
  ])) as MapStyleTokens;
}

function applyContrast(tokens: MapStyleTokens, contrast: number): MapStyleTokens {
  const normalized = (contrast - 50) / 50;
  if (normalized === 0) return tokens;
  const land = tokens.land;
  const contrastTarget = isLightColor(land) ? '#101418' : '#f7f4ed';
  return Object.fromEntries(MAP_STYLE_TOKEN_ROLES.map((role) => {
    if (!CONTRAST_ROLES.has(role)) return [role, tokens[role]];
    const amount = normalized > 0
      ? normalized * (role === 'label' ? 0.22 : 0.12)
      : Math.abs(normalized) * (role === 'label' ? 0.32 : 0.24);
    return [role, mixColor(tokens[role], normalized > 0 ? contrastTarget : land, amount)];
  })) as MapStyleTokens;
}

function applyDetail(tokens: MapStyleTokens, detail: number): MapStyleTokens {
  const normalized = (detail - 50) / 50;
  if (normalized === 0) return tokens;
  const detailTarget = isLightColor(tokens.land) ? '#384247' : '#d7ddd8';
  return Object.fromEntries(MAP_STYLE_TOKEN_ROLES.map((role) => {
    if (!DETAIL_ROLES.has(role)) return [role, tokens[role]];
    return [
      role,
      mixColor(tokens[role], normalized > 0 ? detailTarget : tokens.land, Math.abs(normalized) * (normalized > 0 ? 0.1 : 0.68)),
    ];
  })) as MapStyleTokens;
}

export function resolveMapStyleTokens(
  preset: MapStylePreset,
  customization: MapStyleCustomization,
): MapStyleTokens {
  const definition = MAP_STYLE_PRESETS.find(({ id }) => id === preset) ?? MAP_STYLE_PRESETS[0];
  const detailed = applyDetail(applyContrast(applyTone({ ...definition.tokens }, customization.tone), customization.contrast), customization.detail);
  return {
    ...detailed,
    ...customization.colors,
  };
}
