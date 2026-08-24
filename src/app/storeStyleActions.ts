import type { ProjectState } from './store';
import { mapStyleBasemapName } from '../domain/project';
import { MAP_STYLE_PRESETS } from '../domain/mapStylePresets';
import { commitDocument, type ProjectSet } from './storeDocument';

type StyleActions = Pick<ProjectState, 'setMapFeatureVisibility' | 'setMapLanguage' | 'setMapStyle' | 'setMapTextScale'>;
const GENERATED_BASEMAP_NAMES = new Set(MAP_STYLE_PRESETS.map(({ id }) => mapStyleBasemapName(id)));

export function createStyleActions(set: ProjectSet): StyleActions {
  return {
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
        style: { ...state.document.style, preset },
        layers: state.document.layers.map((layer) => layer.type === 'basemap' && GENERATED_BASEMAP_NAMES.has(layer.name)
          ? { ...layer, name: mapStyleBasemapName(preset) }
          : layer),
      });
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