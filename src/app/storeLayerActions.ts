import { cloneContentLayer } from '../domain/project';
import type { ProjectState } from './store';
import { commitDocument, replaceLayers, type ProjectSet } from './storeDocument';

type LayerStructureActions = Pick<
  ProjectState,
  'createRoute' | 'deleteLayer' | 'duplicateLayer' | 'importLayers' | 'moveLayer'
>;
type LayerPropertyActions = Pick<
  ProjectState,
  'renameLayer' | 'selectLayer' | 'setLayerOpacity' | 'toggleLayerVisibility' | 'toggleLayerLock'
>;

export function createLayerStructureActions(set: ProjectSet): LayerStructureActions {
  return {
    createRoute: (coordinates) => set((state) => {
      if (coordinates.length < 2 || coordinates.some(([longitude, latitude]) => (
        !Number.isFinite(longitude)
        || !Number.isFinite(latitude)
        || longitude < -180
        || longitude > 180
        || latitude < -90
        || latitude > 90
      ))) return state;
      const usedIds = new Set(state.document.layers.map((layer) => layer.id));
      let routeNumber = 0;
      let id: string;
      do {
        routeNumber += 1;
        id = `route-${String(routeNumber).padStart(2, '0')}`;
      } while (usedIds.has(id));
      const route = {
        id,
        name: `Route ${String(routeNumber).padStart(2, '0')}`,
        type: 'route' as const,
        visible: true,
        locked: false,
        opacity: 100,
        geometry: {
          type: 'LineString' as const,
          coordinates: coordinates.map(([longitude, latitude]) => [longitude, latitude] as [number, number]),
        },
      };
      const layers = [...state.document.layers];
      const basemapIndex = layers.findIndex((layer) => layer.type === 'basemap');
      layers.splice(basemapIndex === -1 ? layers.length : basemapIndex, 0, route);
      return {
        ...commitDocument(state, replaceLayers(state.document, layers)),
        selectedId: id,
      };
    }),
    deleteLayer: (id) => set((state) => {
      if (state.document.layers.every((layer) => layer.id !== id)) return state;

      return {
        ...commitDocument(
          state,
          replaceLayers(state.document, state.document.layers.filter((layer) => layer.id !== id)),
        ),
        selectedId: state.selectedId === id ? null : state.selectedId,
      };
    }),
    duplicateLayer: (id) => set((state) => {
      const sourceIndex = state.document.layers.findIndex((layer) => layer.id === id);
      if (sourceIndex === -1) return state;

      const source = state.document.layers[sourceIndex];
      const usedIds = new Set(state.document.layers.map((layer) => layer.id));
      let suffix = 1;
      let duplicateId = `${id}-copy`;
      while (usedIds.has(duplicateId)) {
        suffix += 1;
        duplicateId = `${id}-copy-${suffix}`;
      }

      const duplicate = { ...cloneContentLayer(source), id: duplicateId, name: `${source.name} copy` };
      const layers = [...state.document.layers];
      layers.splice(sourceIndex + 1, 0, duplicate);
      return {
        ...commitDocument(state, replaceLayers(state.document, layers)),
        selectedId: duplicateId,
      };
    }),
    importLayers: (importedLayers, documentEpoch) => {
      let wasImported = false;
      set((state) => {
        if (importedLayers.length === 0 || documentEpoch !== state.documentEpoch) return state;
        wasImported = true;

        const layers = [...state.document.layers];
        const basemapIndex = layers.findIndex((layer) => layer.type === 'basemap');
        const insertionIndex = basemapIndex === -1 ? layers.length : basemapIndex;
        const usedIds = new Set(layers.map((layer) => layer.id));
        const importedCopies = importedLayers.map((layer) => {
          let id = layer.id;
          let suffix = 2;
          while (usedIds.has(id)) {
            id = `${layer.id}-${suffix}`;
            suffix += 1;
          }
          usedIds.add(id);
          return { ...cloneContentLayer(layer), id };
        });
        layers.splice(insertionIndex, 0, ...importedCopies);
        return {
          ...commitDocument(state, replaceLayers(state.document, layers)),
          selectedId: importedCopies[0].id,
        };
      });
      return wasImported;
    },
    moveLayer: (id, toIndex) => set((state) => {
      if (!Number.isFinite(toIndex)) return state;
      const fromIndex = state.document.layers.findIndex((layer) => layer.id === id);
      const targetIndex = Math.max(0, Math.min(Math.trunc(toIndex), state.document.layers.length - 1));
      if (fromIndex === -1 || fromIndex === targetIndex) return state;

      const layers = [...state.document.layers];
      const [layer] = layers.splice(fromIndex, 1);
      layers.splice(targetIndex, 0, layer);
      return commitDocument(state, replaceLayers(state.document, layers));
    }),
  };
}

export function createLayerPropertyActions(set: ProjectSet): LayerPropertyActions {
  return {
    renameLayer: (id, name) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      if (!layer || !name.trim() || layer.name === name) return state;

      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((candidate) => (
          candidate.id === id ? { ...candidate, name } : candidate
        )),
      ));
    }),
    selectLayer: (id) => set((state) => ({
      selectedId: id === null || state.document.layers.some((layer) => layer.id === id)
        ? id
        : state.selectedId,
    })),
    setLayerOpacity: (id, opacity) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      const nextOpacity = Math.max(0, Math.min(100, opacity));
      if (!layer || !Number.isFinite(opacity) || layer.opacity === nextOpacity) return state;

      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((candidate) => (
          candidate.id === id ? { ...candidate, opacity: nextOpacity } : candidate
        )),
      ));
    }),
    toggleLayerVisibility: (id) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      if (!layer) return state;

      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((candidate) => (
          candidate.id === id ? { ...candidate, visible: !candidate.visible } : candidate
        )),
      ));
    }),
    toggleLayerLock: (id) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      if (!layer) return state;

      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((candidate) => (
          candidate.id === id ? { ...candidate, locked: !candidate.locked } : candidate
        )),
      ));
    }),
  };
}
