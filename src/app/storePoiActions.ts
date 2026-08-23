import { isPoiLabelValid } from '../domain/poiMarkers';
import { MAX_POI_SPREADSHEET_ROWS } from '../domain/poiSpreadsheet';
import { createDefaultLayerAppearance } from '../domain/project';
import { isValidPosition } from '../domain/routeGeometry';
import type { ProjectState } from './store';
import { commitDocument, replaceLayers, type ProjectSet } from './storeDocument';

type PoiStructureActions = Pick<ProjectState, 'createPoi' | 'createPoiBatch'>;

function nextPoiIdentity(usedIds: Set<string>): { id: string; number: number } {
  let number = 0;
  let id: string;
  do {
    number += 1;
    id = `poi-${String(number).padStart(2, '0')}`;
  } while (usedIds.has(id));
  usedIds.add(id);
  return { id, number };
}

export function createPoiStructureActions(set: ProjectSet): PoiStructureActions {
  return {
    createPoi: ([longitude, latitude]) => set((state) => {
      if (!isValidPosition(longitude, latitude)) return state;
      const usedIds = new Set(state.document.layers.map((layer) => layer.id));
      const identity = nextPoiIdentity(usedIds);
      const poi = {
        id: identity.id,
        name: `POI ${String(identity.number).padStart(2, '0')}`,
        type: 'poi' as const,
        visible: true,
        locked: false,
        opacity: 100,
        appearance: createDefaultLayerAppearance('poi'),
        geometry: {
          type: 'Point' as const,
          coordinates: [longitude, latitude] as [number, number],
        },
      };
      const layers = [...state.document.layers];
      const basemapIndex = layers.findIndex((layer) => layer.type === 'basemap');
      layers.splice(basemapIndex === -1 ? layers.length : basemapIndex, 0, poi);
      return {
        ...commitDocument(state, replaceLayers(state.document, layers)),
        selectedId: identity.id,
      };
    }),
    createPoiBatch: (entries) => set((state) => {
      if (
        entries.length === 0
        || entries.length > MAX_POI_SPREADSHEET_ROWS
        || entries.some((entry) => (
          !entry.name
          || !isPoiLabelValid(entry.name)
          || !isValidPosition(entry.coordinates[0], entry.coordinates[1])
        ))
      ) return state;

      const appearance = createDefaultLayerAppearance('poi');
      if (appearance?.kind !== 'poi') return state;
      const usedIds = new Set(state.document.layers.map((layer) => layer.id));
      const createdPois = entries.map((entry) => {
        const identity = nextPoiIdentity(usedIds);
        return {
          id: identity.id,
          name: entry.name,
          type: 'poi' as const,
          visible: true,
          locked: false,
          opacity: 100,
          appearance: { ...appearance, label: entry.name },
          geometry: {
            type: 'Point' as const,
            coordinates: [...entry.coordinates] as [number, number],
          },
        };
      });
      const layers = [...state.document.layers];
      const basemapIndex = layers.findIndex((layer) => layer.type === 'basemap');
      layers.splice(basemapIndex === -1 ? layers.length : basemapIndex, 0, ...createdPois);
      return {
        ...commitDocument(state, replaceLayers(state.document, layers)),
        selectedId: createdPois[0].id,
      };
    }),
  };
}
