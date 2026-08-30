import type { ProjectState } from './store';
import { mapStyleBasemapName } from '../domain/project';
import { MAP_STYLE_PRESETS } from '../domain/mapStylePresets';
import {
  createDefaultMapStyleCustomization,
  isMapStyleCustomized,
  isMapStyleHexColor,
  MAP_STYLE_TONES,
} from '../domain/mapStyleCustomization';
import { commitDocument, type ProjectSet } from './storeDocument';

type StyleActions = Pick<ProjectState,
  | 'resetMapStyle'
  | 'resetMapStyleCustomization'
  | 'setMapFeatureVisibility'
  | 'setMapLanguage'
  | 'setMapStyle'
  | 'setMapStyleAdjustment'
  | 'setMapStyleColor'
  | 'setMapStyleTone'
  | 'setMapTextScale'
>;
const GENERATED_BASEMAP_NAMES = new Set(MAP_STYLE_PRESETS.map(({ id }) => mapStyleBasemapName(id)));
const MAP_STYLE_TONE_VALUES = new Set(MAP_STYLE_TONES);

function commitStyle(
  state: ProjectState,
  style: ProjectState['document']['style'],
  mode: 'history' | 'amend',
) {
  const document = { ...state.document, style };
  return mode === 'amend'
    ? { document, future: [], canRedo: false }
    : commitDocument(state, document);
}

export function createStyleActions(set: ProjectSet): StyleActions {
  return {
    resetMapStyle: () => set((state) => {
      if (state.document.style.preset === 'paper'
        && !isMapStyleCustomized(state.document.style.customization)) return state;
      return commitDocument(state, {
        ...state.document,
        style: {
          ...state.document.style,
          preset: 'paper',
          customization: createDefaultMapStyleCustomization(),
        },
        layers: state.document.layers.map((layer) => layer.type === 'basemap' && GENERATED_BASEMAP_NAMES.has(layer.name)
          ? { ...layer, name: mapStyleBasemapName('paper') }
          : layer),
      });
    }),
    resetMapStyleCustomization: () => set((state) => {
      if (!isMapStyleCustomized(state.document.style.customization)) return state;
      return commitStyle(state, {
        ...state.document.style,
        customization: createDefaultMapStyleCustomization(),
      }, 'history');
    }),
    setMapLanguage: (language) => set((state) => {
      if (state.document.style.language === language) return state;
      return commitDocument(state, {
        ...state.document,
        style: { ...state.document.style, language },
      });
    }),
    setMapFeatureVisibility: (category, isVisible) => set((state) => {
      if (state.document.style.visibility[category] === isVisible) return state;
      return commitDocument(state, {
        ...state.document,
        style: {
          ...state.document.style,
          visibility: { ...state.document.style.visibility, [category]: isVisible },
        },
      });
    }),
    setMapStyle: (preset) => set((state) => {
      if (state.document.style.preset === preset) return state;
      return commitDocument(state, {
        ...state.document,
        style: {
          ...state.document.style,
          preset,
          customization: createDefaultMapStyleCustomization(),
        },
        layers: state.document.layers.map((layer) => layer.type === 'basemap' && GENERATED_BASEMAP_NAMES.has(layer.name)
          ? { ...layer, name: mapStyleBasemapName(preset) }
          : layer),
      });
    }),
    setMapStyleAdjustment: (adjustment, value, mode = 'history') => set((state) => {
      if (!Number.isFinite(value) || value < 0 || value > 100
        || state.document.style.customization[adjustment] === value) return state;
      return commitStyle(state, {
        ...state.document.style,
        customization: {
          ...state.document.style.customization,
          [adjustment]: value,
        },
      }, mode);
    }),
    setMapStyleColor: (role, color, mode = 'history') => set((state) => {
      if (color !== null && !isMapStyleHexColor(color)) return state;
      const current = state.document.style.customization.colors[role];
      const normalized = color?.toLowerCase();
      if (current === normalized || (current === undefined && normalized === undefined)) return state;
      const colors = { ...state.document.style.customization.colors };
      if (normalized) colors[role] = normalized;
      else delete colors[role];
      return commitStyle(state, {
        ...state.document.style,
        customization: {
          ...state.document.style.customization,
          colors,
        },
      }, mode);
    }),
    setMapStyleTone: (tone) => set((state) => {
      if (!MAP_STYLE_TONE_VALUES.has(tone) || state.document.style.customization.tone === tone) return state;
      return commitStyle(state, {
        ...state.document.style,
        customization: {
          ...state.document.style.customization,
          tone,
        },
      }, 'history');
    }),
    setMapTextScale: (textScalePercent) => set((state) => {
      if (
        !Number.isFinite(textScalePercent)
        || textScalePercent < 50
        || textScalePercent > 200
        || state.document.style.textScalePercent === textScalePercent
      ) return state;
      return commitDocument(state, {
        ...state.document,
        style: { ...state.document.style, textScalePercent },
      });
    }),
  };
}