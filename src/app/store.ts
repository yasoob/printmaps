import { createStore } from 'zustand/vanilla';
import {
  createInitialProjectDocument,
  type ContentLayer,
  type LayerAppearance,
  type MapFeatureVisibilityCategory,
  type MapStylePreset,
  type PageOrientation,
  type StandardPagePreset,
  type ProjectDocument,
} from '../domain/project';
import { copyDocument, createDocumentActions } from './storeDocument';
import { createCameraActions } from './storeCameraActions';
import { createLayerPropertyActions, createLayerStructureActions } from './storeLayerActions';
import { createPageActions } from './storePageActions';
import { createStyleActions } from './storeStyleActions';

export type ProjectState = {
  document: ProjectDocument;
  documentEpoch: number;
  selectedId: string | null;
  past: ProjectDocument[];
  future: ProjectDocument[];
  canUndo: boolean;
  canRedo: boolean;
  createPoi: (coordinates: readonly [number, number]) => void;
  createRoute: (coordinates: readonly (readonly [number, number])[]) => void;
  createShape: (coordinates: readonly (readonly [number, number])[]) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  importLayers: (layers: readonly ContentLayer[], documentEpoch: number) => boolean;
  moveLayer: (id: string, toIndex: number) => void;
  openDocument: (document: ProjectDocument) => void;
  renameLayer: (id: string, name: string) => void;
  selectLayer: (id: string | null) => void;
  setCameraBearing: (bearing: number) => void;
  setCameraPitch: (pitch: number) => void;
  setPageDimension: (dimension: 'widthMm' | 'heightMm', value: number) => void;
  setPageOrientation: (orientation: PageOrientation) => void;
  setPagePreset: (preset: StandardPagePreset) => void;
  setLayerAppearance: (id: string, appearance: LayerAppearance) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  setMapStyle: (preset: MapStylePreset) => void;
  setMapTextScale: (textScalePercent: number) => void;
  setMapFeatureVisibility: (category: MapFeatureVisibilityCategory, isVisible: boolean) => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  undo: () => void;
  redo: () => void;
};

export function createProjectStore(
  initialDocument: ProjectDocument = createInitialProjectDocument(),
) {
  return createStore<ProjectState>((set) => ({
    document: copyDocument(initialDocument),
    documentEpoch: 0,
    selectedId: null,
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
    ...createCameraActions(set),
    ...createLayerStructureActions(set),
    ...createLayerPropertyActions(set),
    ...createPageActions(set),
    ...createStyleActions(set),
    ...createDocumentActions(set),
  }));
}
