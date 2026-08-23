import { canonicalLayerAppearance } from '../domain/layerAppearance';
import { cloneContentLayer, createDefaultLayerAppearance, type ContentLayer } from '../domain/project';
import { isValidPosition, moveRouteVertex } from '../domain/routeGeometry';
import { buildRouteCoordinates, DEFAULT_ROUTE_AUTHORING_OPTIONS, isRouteAuthoringOptions } from '../domain/routeProfiles';
import { validateCustomMarkerAssetCollection, validateStoredCustomMarkerAsset, type CustomMarkerAsset } from '../domain/customMarkerAssets';
import type { ProjectState } from './store';
import { commitDocument, replaceLayers, type ProjectSet } from './storeDocument';
import { createPoiStructureActions } from './storePoiActions';
import { createAdministrativeAreaActions } from './storeAdministrativeAreaActions';
type LayerPropertyActions = Pick<ProjectState, 'renameLayer' | 'selectLayer' | 'setLayerAppearance' | 'setLayerOpacity' | 'setPoiCoordinates' | 'setPoiCustomMarker' | 'setRouteVertex' | 'toggleLayerVisibility' | 'toggleLayerLock'>;

function isCanonicalCustomMarkerAsset(asset: CustomMarkerAsset): boolean {
  try {
    validateStoredCustomMarkerAsset(asset);
    return true;
  } catch {
    return false;
  }
}

function assetsReferencedBy(layers: ProjectState['document']['layers']): Set<string> {
  return new Set(layers.flatMap(({ appearance }) => (
    appearance?.kind === 'poi' && appearance.customAssetId ? [appearance.customAssetId] : []
  )));
}

function createRouteAction(set: ProjectSet): ProjectState['createRoute'] {
  return (coordinates, options = DEFAULT_ROUTE_AUTHORING_OPTIONS) => set((state) => {
    const distinctCoordinates = new Set(coordinates.map(([longitude, latitude]) => `${longitude},${latitude}`));
    if (!isRouteAuthoringOptions(options) || distinctCoordinates.size < 2 || coordinates.some(([longitude, latitude]) => (
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
    const routeCoordinates = buildRouteCoordinates(coordinates, options.lineShape);
    if (routeCoordinates.length < 2) return state;
    const defaultAppearance = createDefaultLayerAppearance('route');
    if (defaultAppearance?.kind !== 'route') return state;
    const route = {
      id,
      name: `Route ${String(routeNumber).padStart(2, '0')}`,
      type: 'route' as const,
      visible: true,
      locked: false,
      opacity: 100,
      appearance: {
        ...defaultAppearance,
        travelProfile: options.travelProfile,
        showTravelModeIcon: options.showTravelModeIcon,
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: routeCoordinates,
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

export function createLayerStructureActions(set: ProjectSet): Pick<ProjectState, 'createAdministrativeArea' | 'createAdministrativeAreas' | 'createPoi' | 'createPoiBatch' | 'createRoute' | 'createShape' | 'deleteLayer' | 'duplicateLayer' | 'importLayers' | 'moveLayer'> {
  return {
    ...createPoiStructureActions(set),
    ...createAdministrativeAreaActions(set),
    createRoute: createRouteAction(set),
    createShape: createShapeAction(set),
    deleteLayer: (id) => set((state) => {
      if (state.document.layers.every((layer) => layer.id !== id)) return state;
      const layers = state.document.layers.filter((layer) => layer.id !== id);
      const referencedAssets = assetsReferencedBy(layers);
      const assets = Object.fromEntries(Object.entries(state.document.assets)
        .filter(([assetId]) => referencedAssets.has(assetId)));
      return {
        ...commitDocument(
          state,
          { ...state.document, assets, layers },
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
    importLayers: (importedLayers, documentEpoch, sourceDocument) => {
      let wasImported = false;
      set((state) => {
        if (importedLayers.length === 0 || documentEpoch !== state.documentEpoch || sourceDocument !== state.document) return state;
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
      const canonicalAppearance = canonicalLayerAppearance(layer?.type ?? 'basemap', appearance);
      if (!layer || !canonicalAppearance) return state;
      const nextAppearance = canonicalAppearance.kind === 'poi' ? { ...canonicalAppearance, customAssetId: layer.appearance?.kind === 'poi' ? layer.appearance.customAssetId ?? null : null } : canonicalAppearance;
      if (JSON.stringify(layer.appearance) === JSON.stringify(nextAppearance)) return state;

      return commitDocument(state, replaceLayers(state.document, state.document.layers.map((candidate) => (
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
    setPoiCustomMarker: (id, asset) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      if (layer?.type !== 'poi' || layer.appearance?.kind !== 'poi') return state;
      if (asset && !isCanonicalCustomMarkerAsset(asset)) return state;
      const appearance = layer.appearance;
      const customAssetId = asset?.id ?? null;
      if (appearance.customAssetId === customAssetId) return state;
      const layers: ContentLayer[] = state.document.layers.map((candidate) => candidate.id === id
        ? { ...candidate, appearance: { ...appearance, customAssetId } }
        : candidate);
      const referenced = assetsReferencedBy(layers);
      const assets = Object.fromEntries(Object.entries(state.document.assets)
        .filter(([assetId]) => referenced.has(assetId)));
      if (asset) assets[asset.id] = { ...asset };
      try {
        validateCustomMarkerAssetCollection(assets);
      } catch {
        return state;
      }
      return commitDocument(state, { ...state.document, assets, layers });
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
