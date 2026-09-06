import { createStore } from "zustand/vanilla";
import {
  createNewProjectDocument,
  type ContentLayer,
  type CameraSettings,
  type DirectionsRouteInput,
  type ArcGeometry,
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
  type RouteKind,
  type RouteMarkerAppearance,
  type RouteSegmentStyleOverride,
} from "../domain/project";
import type { MapStyleTone } from "../domain/mapStyleCustomization";
import type { MapStyleTokenRole } from "../domain/mapStylePresets";
import type {
  RouteAuthoringOptions,
  RouteTravelMarker,
} from "../domain/routeProfiles";
import type { PoiSpreadsheetEntry } from "../domain/poiSpreadsheet";
import type { CustomMarkerAsset } from "../domain/customMarkerAssets";
import type { AdministrativeArea } from "../domain/administrativeAreas";
import { copyDocument, createDocumentActions } from "./storeDocument";
import { createCameraActions } from "./storeCameraActions";
import {
  createLayerPropertyActions,
  createLayerStructureActions,
} from "./storeLayerActions";
import { createPageActions } from "./storePageActions";
import { createShapeGeometryActions } from "./storeShapeActions";
import { createStyleActions } from "./storeStyleActions";
import { createIsochroneActions } from "./storeIsochroneActions";
import { parseProjectDocument, ProjectValidationCache } from "../domain/projectFile";
import { createProjectSetter } from "./storeMutation";
import type { LayerMutationResult, ProjectMutationResult } from "../domain/projectMutation";

export type RouteMutationResult =
  { ok: true; routeId: string } | { ok: false; error: string };

export type ReplaceDirectionsRouteRequest = {
  id: string;
  input: DirectionsRouteInput;
  options: RouteAuthoringOptions;
  expectedDocumentEpoch: number;
  expectedLayer: ContentLayer;
  selectRoute?: boolean;
};

export type RouteTransformOperation =
  | { type: "convert"; targetKind: RouteKind }
  | { type: "reverse" }
  | { type: "close" }
  | { type: "open" };

export type TransformRouteRequest = {
  id: string;
  operation: RouteTransformOperation;
  expectedDocumentEpoch: number;
  expectedLayer: ContentLayer;
  road?: DirectionsRouteInput;
};

export type ReplaceRouteDraftRequest = {
  id: string;
  points: readonly (readonly [number, number])[];
  expectedDocumentEpoch: number;
  expectedLayer: ContentLayer;
  road?: DirectionsRouteInput;
  travelMarker: RouteTravelMarker | null;
};

export type ProjectState = {
  document: ProjectDocument;
  documentEpoch: number;
  hasUnfinishedDrawing: boolean;
  setHasUnfinishedDrawing: (documentEpoch: number, hasUnfinishedDrawing: boolean) => void;
  pageBoundaryVisible: boolean;
  selectedId: string | null;
  past: ProjectDocument[];
  future: ProjectDocument[];
  canUndo: boolean;
  canRedo: boolean;
  applyMapMatching: (
    id: string,
    input: MapMatchingInput,
    expectedDocumentEpoch: number,
  ) => ProjectMutationResult;
  createAdministrativeArea: (area: AdministrativeArea) => LayerMutationResult;
  createIsochroneArea: (
    input: IsochroneAreaInput,
    expectedDocumentEpoch: number,
  ) => LayerMutationResult;
  createDirectionsRoute: (
    input: DirectionsRouteInput,
    options: RouteAuthoringOptions,
    expectedDocumentEpoch: number,
  ) => RouteMutationResult;
  replaceDirectionsRoute: (
    request: ReplaceDirectionsRouteRequest,
  ) => RouteMutationResult;
  replaceRouteDraft: (request: ReplaceRouteDraftRequest) => RouteMutationResult;
  transformRoute: (request: TransformRouteRequest) => RouteMutationResult;
  createPoi: (coordinates: readonly [number, number]) => ProjectMutationResult;
  createPoiBatch: (
    entries: readonly PoiSpreadsheetEntry[],
    expectedDocumentEpoch?: number,
  ) => ProjectMutationResult;
  createSearchPoi: (
    input: SearchPoiInput,
    expectedDocumentEpoch: number,
  ) => LayerMutationResult;
  createRoute: (
    coordinates: readonly (readonly [number, number])[],
    options?: RouteAuthoringOptions,
  ) => RouteMutationResult;
  replaceAuthoredRoute: (
    id: string,
    geometry:
      ArcGeometry | { type: "LineString"; coordinates: [number, number][] },
    travelMarker: RouteTravelMarker | null,
    expectedLayer: ContentLayer,
  ) => RouteMutationResult;
  createShape: (coordinates: readonly (readonly [number, number])[]) => ProjectMutationResult;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => ProjectMutationResult;
  importLayers: (
    layers: readonly ContentLayer[],
    documentEpoch: number,
    sourceDocument: ProjectDocument,
  ) => ProjectMutationResult;
  insertRouteVertex: (
    id: string,
    vertexIndex: number,
    coordinate?: readonly [number, number],
  ) => ProjectMutationResult;
  moveLayer: (id: string, toIndex: number) => void;
  openDocument: (document: ProjectDocument) => ProjectMutationResult;
  setProjectTitle: (title: string) => ProjectMutationResult;
  renameLayer: (id: string, name: string) => ProjectMutationResult;
  replaceLayerFromImport: (
    id: string,
    layer: ContentLayer,
    documentEpoch: number,
    sourceDocument: ProjectDocument,
  ) => ProjectMutationResult;
  selectLayer: (id: string | null) => void;
  setCameraBearing: (bearing: number) => ProjectMutationResult;
  setCameraViewport: (
    center: readonly [number, number],
    zoom: number,
    mode?: "amend" | "history",
    orientation?: Pick<CameraSettings, "bearing" | "pitch">,
  ) => ProjectMutationResult;
  setMapAreaLocked: (isLocked: boolean) => ProjectMutationResult;
  setCameraPitch: (pitch: number) => ProjectMutationResult;
  setPageDimension: (dimension: "widthMm" | "heightMm", value: number) => ProjectMutationResult;
  setPageBoundaryVisible: (isVisible: boolean) => void;
  setPageOrientation: (orientation: PageOrientation) => ProjectMutationResult;
  setPagePreset: (preset: PagePreset) => ProjectMutationResult;
  setLayerAppearance: (id: string, appearance: LayerAppearance) => ProjectMutationResult;
  setRouteMarker: (id: string, marker: RouteMarkerAppearance | null) => ProjectMutationResult;
  setRouteSegmentStyle: (
    id: string,
    segmentIndex: number,
    style: RouteSegmentStyleOverride | null,
  ) => ProjectMutationResult;
  setPoiCoordinates: (
    id: string,
    coordinates: readonly [number, number],
  ) => ProjectMutationResult;
  setPoiCustomMarker: (id: string, asset: CustomMarkerAsset | null) => ProjectMutationResult;
  setRouteVertex: (
    id: string,
    vertexIndex: number,
    coordinates: readonly [number, number],
  ) => ProjectMutationResult;
  setArcSegmentCurvature: (
    id: string,
    segmentIndex: number,
    curvature: number,
  ) => ProjectMutationResult;
  setShapeGeometry: (
    id: string,
    geometry: import("../domain/project").ShapeGeometry,
  ) => ProjectMutationResult;
  setShapeVertex: (
    id: string,
    ringIndex: number,
    vertexIndex: number,
    coordinates: readonly [number, number],
  ) => ProjectMutationResult;
  setLayerOpacity: (id: string, opacity: number) => ProjectMutationResult;
  setMapStyle: (preset: MapStylePreset) => ProjectMutationResult;
  setMapStyleAdjustment: (
    adjustment: "contrast" | "detail",
    value: number,
    mode?: "history" | "amend",
  ) => ProjectMutationResult;
  setMapStyleColor: (
    role: MapStyleTokenRole,
    color: string | null,
    mode?: "history" | "amend",
  ) => ProjectMutationResult;
  setMapStyleTone: (tone: MapStyleTone) => ProjectMutationResult;
  resetMapStyle: () => ProjectMutationResult;
  resetMapStyleCustomization: () => ProjectMutationResult;
  setMapLanguage: (language: MapLanguage) => ProjectMutationResult;
  setMapTextScale: (textScalePercent: number) => ProjectMutationResult;
  setMapFeatureVisibility: (
    category: MapFeatureVisibilityCategory,
    isVisible: boolean,
  ) => ProjectMutationResult;
  toggleLayerVisibility: (id: string) => ProjectMutationResult;
  toggleLayerLock: (id: string) => ProjectMutationResult;
  undo: () => void;
  redo: () => void;
  removeRouteVertex: (id: string, vertexIndex: number) => ProjectMutationResult;
  replaceRouteGeometry: (
    id: string,
    coordinates: readonly (readonly [number, number])[],
  ) => ProjectMutationResult;
};

export function createProjectStore(
  initialDocument: ProjectDocument = createNewProjectDocument(),
) {
  const document = copyDocument(initialDocument);
  const cache = new ProjectValidationCache();
  parseProjectDocument(document, cache);
  return createStore<ProjectState>((rawSet) => {
    const set = createProjectSetter(rawSet, cache);
    return {
    document,
    documentEpoch: 0,
    hasUnfinishedDrawing: false,
    setHasUnfinishedDrawing: (documentEpoch, hasUnfinishedDrawing) => set((state) => (
      state.documentEpoch !== documentEpoch || state.hasUnfinishedDrawing === hasUnfinishedDrawing
        ? state : { hasUnfinishedDrawing }
    )),
    pageBoundaryVisible: true,
    selectedId: null,
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
    setPageBoundaryVisible: (isVisible) => set((state) => (
      state.pageBoundaryVisible === isVisible ? state : { pageBoundaryVisible: isVisible }
    )),
    ...createCameraActions(set),
    ...createLayerStructureActions(set),
    ...createIsochroneActions(set),
    ...createLayerPropertyActions(set),
    ...createShapeGeometryActions(set),
    ...createPageActions(set),
    ...createStyleActions(set),
    ...createDocumentActions(set),
    };
  });
}
