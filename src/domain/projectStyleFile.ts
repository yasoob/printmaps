import type { MapLanguage, MapStylePreset, ProjectDocument } from './project';
import {
  isMapStyleHexColor,
  MAP_STYLE_TONES,
  type MapStyleColorOverrides,
  type MapStyleTone,
} from './mapStyleCustomization';
import {
  MAP_STYLE_PRESETS,
  MAP_STYLE_TOKEN_ROLES,
  type MapStyleTokenRole,
} from './mapStylePresets';
import { ProjectFileError } from './projectFileError';

type JsonObject = Record<string, unknown>;

const MAP_STYLE_PRESET_VALUES = new Set<MapStylePreset>(MAP_STYLE_PRESETS.map(({ id }) => id));
const MAP_LANGUAGE_VALUES = new Set<MapLanguage>(['local', 'en', 'de', 'fr', 'it', 'es', 'zh']);
const MAP_STYLE_TONE_VALUES = new Set<MapStyleTone>(MAP_STYLE_TONES);
const MAP_STYLE_TOKEN_ROLE_VALUES = new Set<MapStyleTokenRole>(MAP_STYLE_TOKEN_ROLES);

function styleObjectAt(value: unknown, label: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProjectFileError(`${label} must be a JSON object.`);
  }
  return value as JsonObject;
}

function styleNumberAt(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ProjectFileError(`${label} must be a finite number.`);
  }
  return value;
}

function isStyleBooleanAt(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new ProjectFileError(`${label} must be true or false.`);
  return value;
}

function mapStylePresetAt(value: unknown): MapStylePreset {
  if (typeof value !== 'string' || !MAP_STYLE_PRESET_VALUES.has(value as MapStylePreset)) {
    throw new ProjectFileError('Map style preset is not supported by this version of Print Map Studio.');
  }
  return value as MapStylePreset;
}

function mapLanguageAt(value: unknown): MapLanguage {
  if (typeof value !== 'string' || !MAP_LANGUAGE_VALUES.has(value as MapLanguage)) {
    throw new ProjectFileError('Map language must be local, en, de, fr, it, es, or zh.');
  }
  return value as MapLanguage;
}

function mapStyleToneAt(value: unknown): MapStyleTone {
  if (typeof value !== 'string' || !MAP_STYLE_TONE_VALUES.has(value as MapStyleTone)) {
    throw new ProjectFileError('Map style tone must be cool, balanced, or warm.');
  }
  return value as MapStyleTone;
}

function parseStyleColors(value: unknown): MapStyleColorOverrides {
  const colorValues = styleObjectAt(value, 'Map style color overrides');
  const colors: MapStyleColorOverrides = {};
  for (const [role, color] of Object.entries(colorValues)) {
    if (!MAP_STYLE_TOKEN_ROLE_VALUES.has(role as MapStyleTokenRole)) {
      throw new ProjectFileError(`Map style color role ${role} is not supported.`);
    }
    if (typeof color !== 'string' || !isMapStyleHexColor(color)) {
      throw new ProjectFileError(`Map style ${role} color must be a six-digit hexadecimal color.`);
    }
    colors[role as MapStyleTokenRole] = color.toLowerCase();
  }
  return colors;
}

export function parseProjectStyle(value: unknown): ProjectDocument['style'] {
  const style = styleObjectAt(value, 'Project style');
  const preset = mapStylePresetAt(style.preset);
  const language = mapLanguageAt(style.language);
  const textScalePercent = styleNumberAt(style.textScalePercent, 'Map text scale');
  if (textScalePercent < 50 || textScalePercent > 200) {
    throw new ProjectFileError('Map text scale must be between 50 and 200 percent.');
  }
  const visibility = styleObjectAt(style.visibility, 'Map feature visibility');
  const customization = styleObjectAt(style.customization, 'Map style customization');
  const tone = mapStyleToneAt(customization.tone);
  const contrast = styleNumberAt(customization.contrast, 'Map style contrast');
  if (contrast < 0 || contrast > 100) throw new ProjectFileError('Map style contrast must be between 0 and 100.');
  const detail = styleNumberAt(customization.detail, 'Map style detail');
  if (detail < 0 || detail > 100) throw new ProjectFileError('Map style detail must be between 0 and 100.');
  return {
    preset,
    language,
    textScalePercent,
    visibility: {
      roads: isStyleBooleanAt(visibility.roads, 'Map road visibility'),
      buildings: isStyleBooleanAt(visibility.buildings, 'Map building visibility'),
      labels: isStyleBooleanAt(visibility.labels, 'Map label visibility'),
      water: isStyleBooleanAt(visibility.water, 'Map water visibility'),
      parks: isStyleBooleanAt(visibility.parks, 'Map park visibility'),
      landuse: isStyleBooleanAt(visibility.landuse, 'Map land-detail visibility'),
      transit: isStyleBooleanAt(visibility.transit, 'Map transit visibility'),
    },
    customization: {
      tone,
      contrast,
      detail,
      colors: parseStyleColors(customization.colors),
    },
  };
}
