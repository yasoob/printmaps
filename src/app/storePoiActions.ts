import { isPoiLabelValid } from '../domain/poiMarkers';
import { MAX_POI_SPREADSHEET_ROWS } from '../domain/poiSpreadsheet';
import { createDefaultLayerAppearance, type SearchPoiInput } from '../domain/project';
import { isValidPosition } from '../domain/routeGeometry';
import type { ProjectState } from './store';
import { commitDocument, replaceLayers, type ProjectSet } from './storeDocument';

type PoiStructureActions = Pick<ProjectState, 'createPoi' | 'createPoiBatch' | 'createSearchPoi'>;
const MAX_PROVIDER_FEATURE_ID_CHARACTERS = 256;

function validSearchInput(input: SearchPoiInput) {
  return isValidPosition(input.coordinate[0], input.coordinate[1])
    && Boolean(input.label)
    && isPoiLabelValid(input.label)
    && input.providerFeatureId.trim() === input.providerFeatureId
    && input.providerFeatureId.length > 0
    && [...input.providerFeatureId].length <= MAX_PROVIDER_FEATURE_ID_CHARACTERS
    && !/[\p{Cc}\p{Cf}]/u.test(input.providerFeatureId);
}

function isValidProviderFeatureId(value: string | undefined) {
  return value === undefined || (
    value.trim() === value
    && value.length > 0
    && [...value].length <= MAX_PROVIDER_FEATURE_ID_CHARACTERS
    && !/[\p{Cc}\p{Cf}]/u.test(value)
  );
}

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
    createSearchPoi: (input, expectedDocumentEpoch) => {
      let createdId: string | null = null;
      set((state) => {
        if (state.documentEpoch !== expectedDocumentEpoch || !validSearchInput(input)) return state;
        const usedIds = new Set(state.document.layers.map((layer) => layer.id));
        const identity = nextPoiIdentity(usedIds);
        const appearance = createDefaultLayerAppearance('poi');
        if (appearance?.kind !== 'poi') return state;
        const poi = {
          id: identity.id,
          name: input.label,
          type: 'poi' as const,
          visible: true,
          locked: false,
          opacity: 100,
          appearance: { ...appearance, label: input.label },
          geometry: { type: 'Point' as const, coordinates: [...input.coordinate] as [number, number] },
          provenance: {
            provider: 'mapbox' as const,
            service: 'geocoding-v6' as const,
            providerFeatureId: input.providerFeatureId,
          },
        };
        const layers = [...state.document.layers];
        const basemapIndex = layers.findIndex((layer) => layer.type === 'basemap');
        layers.splice(basemapIndex === -1 ? layers.length : basemapIndex, 0, poi);
        createdId = identity.id;
        return {
          ...commitDocument(state, replaceLayers(state.document, layers)),
          selectedId: identity.id,
        };
      });
      return createdId;
    },
    createPoiBatch: (entries, expectedDocumentEpoch) => set((state) => {
      if (
        (expectedDocumentEpoch !== undefined && state.documentEpoch !== expectedDocumentEpoch)
        || entries.length === 0
        || entries.length > MAX_POI_SPREADSHEET_ROWS
        || entries.some((entry) => (
          !entry.name
          || !isPoiLabelValid(entry.name)
          || !isValidPosition(entry.coordinates[0], entry.coordinates[1])
          || !isValidProviderFeatureId(entry.providerFeatureId)
        ))
      ) return state;

      const appearance = createDefaultLayerAppearance('poi');
      if (appearance?.kind !== 'poi') return state;
      const usedIds = new Set(state.document.layers.map((layer) => layer.id));
      const createdPois = entries.map((entry) => {
        const identity = nextPoiIdentity(usedIds);
        const provenance = entry.providerFeatureId ? {
          provider: 'mapbox' as const,
          service: 'geocoding-v6' as const,
          providerFeatureId: entry.providerFeatureId,
        } : undefined;
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
          ...(provenance && { provenance }),
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
