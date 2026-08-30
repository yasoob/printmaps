import { createStore } from 'zustand/vanilla';
import {
  createNewProjectDocument,
  type ContentLayer,
  type DirectionsRouteInput,
  type LayerAppearance,
  type IsochroneAreaInput,
  type MapLanguage,
  type MapFeatureVisibilityCategory,
  type MapMatchingInput,
  type MapStylePreset,
  type PageOrientation,
  type PagePreset,
  type ProjectDocument,
  type SearchPoiInput,
} from '../domain/project';
import type { RouteAuthoringOptions } from '../domain/routeProfiles';
import type { PoiSpreadsheetEntry } from '../domain/poiSpreadsheet';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';
import type { AdministrativeArea, AdministrativeAreaId } from '../domain/administrativeAreas';
import { copyDocument, createDocumentActions } from './storeDocument';
import { createCameraActions } from './storeCameraActions';
import { createLayerPropertyActions, createLayerStructureActions } from './storeLayerActions';
import { createPageActions } from './storePageActions';
import { createShapeGeometryActions } from './storeShapeActions';
import { createStyleActions } from './storeStyleActions';
import { createIsochroneActions } from './storeIsochroneActions';

export type ProjectState = {
  document: ProjectDocument;
  documentEpoch: number;
  selectedId: string | null;
  past: ProjectDocument[];
  future: ProjectDocument[];
  canUndo: boolean;
  canRedo: boolean;
  applyMapMatching: (id: string, input: MapMatchingInput, expectedDocumentEpoch: number) => boolean;
  createAdministrativeArea: (area: AdministrativeAreaId | AdministrativeArea) => string | null;
  createAdministrativeAreas: (areas: readonly (AdministrativeAreaId | AdministrativeArea)[]) => string | null;
  createIsochroneArea: (input: IsochroneAreaInput, expectedDocumentEpoch: number) => string | null;
  createDirectionsRoute: (
    input: DirectionsRouteInput,
    options: RouteAuthoringOptions,
    expectedDocumentEpoch: number,
  ) => string | null;
  createPoi: (coordinates: readonly [number, number]) => void;
  createPoiBatch: (entries: readonly PoiSpreadsheetEntry[], expectedDocumentEpoch?: number) => void;
  createSearchPoi: (input: SearchPoiInput, expectedDocumentEpoch: number) => string | null;
  createRoute: (
    coordinates: readonly (readonly [number, number])[],
    options?: RouteAuthoringOptions,
  ) => void;
  createShape: (coordinates: readonly (readonly [number, number])[]) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  importLayers: (layers: readonly ContentLayer[], documentEpoch: number, sourceDocument: ProjectDocument) => boolean;
  insertRouteVertex: (id: string, vertexIndex: number, coordinate?: readonly [number, number]) => void;
  moveLayer: (id: string, toIndex: number) => void;
  openDocument: (document: ProjectDocument) => void;
  setProjectTitle: (title: string) => void;
  renameLayer: (id: string, name: string) => void;
  replaceLayerFromImport: (id: string, layer: ContentLayer, documentEpoch: number, sourceDocument: ProjectDocument) => boolean;
  selectLayer: (id: string | null) => void;
  setCameraBearing: (bearing: number) => void;
  setCameraViewport: (center: readonly [number, number], zoom: number, mode?: 'amend' | 'history') => void;
  setMapAreaLocked: (isLocked: boolean) => void;
  setCameraPitch: (pitch: number) => void;
  setPageDimension: (dimension: 'widthMm' | 'heightMm', value: number) => void;
  setPageOrientation: (orientation: PageOrientation) => void;
  setPagePreset: (preset: PagePreset) => void;
  setLayerAppearance: (id: string, appearance: LayerAppearance) => void;
  setPoiCoordinates: (id: string, coordinates: readonly [number, number]) => void;
  setPoiCustomMarker: (id: string, asset: CustomMarkerAsset | null) => void;
  setRouteVertex: (id: string, vertexIndex: number, coordinates: readonly [number, number]) => void;
  setShapeGeometry: (id: string, geometry: import('../domain/project').ShapeGeometry) => void;
  setShapeVertex: (id: string, ringIndex: number, vertexIndex: number, coordinates: readonly [number, number]) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  setMapStyle: (preset: MapStylePreset) => void;
  setMapLanguage: (language: MapLanguage) => void;
  setMapTextScale: (textScalePercent: number) => void;
  setMapFeatureVisibility: (category: MapFeatureVisibilityCategory, isVisible: boolean) => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  undo: () => void;
  redo: () => void;
  removeRouteVertex: (id: string, vertexIndex: number) => void;
  replaceRouteGeometry: (id: string, coordinates: readonly (readonly [number, number])[]) => void;
};

export function createProjectStore(
  initialDocument: ProjectDocument = createNewProjectDocument(),
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
    ...createIsochroneActions(set),
    ...createLayerPropertyActions(set),
    ...createShapeGeometryActions(set),
    ...createPageActions(set),
    ...createStyleActions(set),
    ...createDocumentActions(set),
  }));
}
