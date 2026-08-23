import { canonicalLayerAppearance } from '../domain/layerAppearance';
import { cloneContentLayer, createDefaultLayerAppearance } from '../domain/project';
import { isValidPosition, moveRouteVertex } from '../domain/routeGeometry';
import type { ProjectState } from './store';
import { commitDocument, replaceLayers, type ProjectSet } from './storeDocument';

type LayerStructureActions = Pick<
  ProjectState,
  'createPoi' | 'createRoute' | 'createShape' | 'deleteLayer' | 'duplicateLayer' | 'importLayers' | 'moveLayer'
>;
type LayerPropertyActions = Pick<
  ProjectState,
  'renameLayer' | 'selectLayer' | 'setLayerAppearance' | 'setLayerOpacity' | 'setPoiCoordinates' | 'setRouteVertex' | 'toggleLayerVisibility' | 'toggleLayerLock'
>;

function createPoiAction(set: ProjectSet): ProjectState['createPoi'] {
  return ([longitude, latitude]) => set((state) => {
    if (
      !Number.isFinite(longitude)
      || !Number.isFinite(latitude)
      || longitude < -180
      || longitude > 180
      || latitude < -90
      || latitude > 90
    ) return state;
    const usedIds = new Set(state.document.layers.map((layer) => layer.id));
    let poiNumber = 0;
    let id: string;
    do {
      poiNumber += 1;
      id = `poi-${String(poiNumber).padStart(2, '0')}`;
    } while (usedIds.has(id));
    const poi = {
      id,
      name: `POI ${String(poiNumber).padStart(2, '0')}`,
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
      selectedId: id,
    };
  });
}

function createRouteAction(set: ProjectSet): ProjectState['createRoute'] {
  return (coordinates) => set((state) => {
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
      appearance: createDefaultLayerAppearance('route'),
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
  });
}

function createShapeAction(set: ProjectSet): ProjectState['createShape'] {
  return (coordinates) => set((state) => {
    const distinctVertices = new Set(coordinates.map(([longitude, latitude]) => `${longitude},${latitude}`));
    if (distinctVertices.size < 3 || coordinates.some(([longitude, latitude]) => (
      !Number.isFinite(longitude)
      || !Number.isFinite(latitude)
      || longitude < -180
      || longitude > 180
      || latitude < -90
      || latitude > 90
    ))) return state;
    const usedIds = new Set(state.document.layers.map((layer) => layer.id));
    let shapeNumber = 0;
    let id: string;
    do {
      shapeNumber += 1;
      id = `shape-${String(shapeNumber).padStart(2, '0')}`;
    } while (usedIds.has(id));
    const ring = coordinates.map(([longitude, latitude]) => [longitude, latitude] as [number, number]);
    const last = ring.at(-1);
    if (!last || last[0] !== ring[0][0] || last[1] !== ring[0][1]) ring.push([...ring[0]]);
    const shape = {
      id,
      name: `Shape ${String(shapeNumber).padStart(2, '0')}`,
      type: 'shape' as const,
      visible: true,
      locked: false,
      opacity: 28,
      appearance: createDefaultLayerAppearance('shape'),
      geometry: {
        type: 'Polygon' as const,
        coordinates: [ring],
      },
    };
    const layers = [...state.document.layers];
    const basemapIndex = layers.findIndex((layer) => layer.type === 'basemap');
    layers.splice(basemapIndex === -1 ? layers.length : basemapIndex, 0, shape);
    return {
      ...commitDocument(state, replaceLayers(state.document, layers)),
      selectedId: id,
    };
  });
}

export function createLayerStructureActions(set: ProjectSet): LayerStructureActions {
  return {
    createPoi: createPoiAction(set),
    createRoute: createRouteAction(set),
    createShape: createShapeAction(set),
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
    setLayerAppearance: (id, appearance) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      const nextAppearance = canonicalLayerAppearance(layer?.type ?? 'basemap', appearance);
      if (!layer || !nextAppearance) return state;
      if (JSON.stringify(layer.appearance) === JSON.stringify(nextAppearance)) return state;

      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((candidate) => (
          candidate.id === id ? { ...candidate, appearance: nextAppearance } : candidate
        )),
      ));
    }),
    setPoiCoordinates: (id, [longitude, latitude]) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      if (
        layer?.type !== 'poi'
        || layer.geometry?.type !== 'Point'
        || !isValidPosition(longitude, latitude)
        || (layer.geometry.coordinates[0] === longitude && layer.geometry.coordinates[1] === latitude)
      ) return state;

      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((candidate) => (
          candidate.id === id
            ? { ...candidate, geometry: { type: 'Point' as const, coordinates: [longitude, latitude] as [number, number] } }
            : candidate
        )),
      ));
    }),
    setRouteVertex: (id, vertexIndex, coordinates) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      const updatedLayer = moveRouteVertex(layer, vertexIndex, coordinates);
      if (!updatedLayer) return state;

      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((candidate) => candidate.id === id ? updatedLayer : candidate),
      ));
    }),
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
