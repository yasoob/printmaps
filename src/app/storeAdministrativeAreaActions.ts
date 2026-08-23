import { administrativeAreaById, mergeAdministrativeAreas, type AdministrativeArea } from '../domain/administrativeAreas';
import { createDefaultLayerAppearance, type ContentLayer } from '../domain/project';
import type { ProjectState } from './store';
import { commitDocument, replaceLayers, type ProjectSet } from './storeDocument';

function createAreaLayer(set: ProjectSet, resolveArea: () => AdministrativeArea | undefined) {
  return () => {
    let createdId: string | null = null;
    set((state) => {
      const area = resolveArea();
      if (!area) return state;
      const usedIds = new Set(state.document.layers.map((layer) => layer.id));
      const baseId = `admin-${area.id.toLowerCase().replaceAll('+', '-')}`;
      let id = baseId;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      createdId = id;
      const layer: ContentLayer = {
        id,
        name: area.name,
        type: 'shape',
        visible: true,
        locked: false,
        opacity: 28,
        appearance: createDefaultLayerAppearance('shape'),
        geometry: {
          type: 'Polygon',
          coordinates: area.geometry.coordinates.map((ring) => ring.map(([longitude, latitude]) => (
            [longitude, latitude]
          ))),
        },
      };
      const layers = [...state.document.layers];
      const basemapIndex = layers.findIndex((candidate) => candidate.type === 'basemap');
      layers.splice(basemapIndex === -1 ? layers.length : basemapIndex, 0, layer);
      return {
        ...commitDocument(state, replaceLayers(state.document, layers)),
        selectedId: id,
      };
    });
    return createdId;
  };
}

export function createAdministrativeAreaActions(set: ProjectSet): Pick<ProjectState, 'createAdministrativeArea' | 'createAdministrativeAreas'> {
  return {
    createAdministrativeArea: (areaId) => createAreaLayer(set, () => administrativeAreaById(areaId))(),
    createAdministrativeAreas: (areaIds) => createAreaLayer(set, () => mergeAdministrativeAreas(areaIds))(),
  };
}
