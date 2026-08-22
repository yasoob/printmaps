import type { ProjectState } from './store';
import { mapStyleBasemapName } from '../domain/project';
import { commitDocument, type ProjectSet } from './storeDocument';

type StyleActions = Pick<ProjectState, 'setMapStyle'>;
const GENERATED_BASEMAP_NAMES = new Set([
  mapStyleBasemapName('liberty'),
  mapStyleBasemapName('positron'),
]);

export function createStyleActions(set: ProjectSet): StyleActions {
  return {
    setMapStyle: (preset) => set((state) => {
      if (state.document.style.preset === preset) return state;
      return commitDocument(state, {
        ...state.document,
        style: { preset },
        layers: state.document.layers.map((layer) => layer.type === 'basemap' && GENERATED_BASEMAP_NAMES.has(layer.name)
          ? { ...layer, name: mapStyleBasemapName(preset) }
          : layer),
      });
    }),
  };
}