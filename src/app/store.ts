import { createStore } from "zustand/vanilla";
import {
  createNewProjectDocument,
  type ContentLayer,
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
  ) => boolean;
  createAdministrativeArea: (area: AdministrativeArea) => string | null;
  createIsochroneArea: (
    input: IsochroneAreaInput,
    expectedDocumentEpoch: number,
  ) => string | null;
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
  createPoi: (coordinates: readonly [number, number]) => void;
  createPoiBatch: (
    entries: readonly PoiSpreadsheetEntry[],
    expectedDocumentEpoch?: number,
  ) => void;
  createSearchPoi: (
    input: SearchPoiInput,
    expectedDocumentEpoch: number,
  ) => string | null;
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
  createShape: (coordinates: readonly (readonly [number, number])[]) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  importLayers: (
    layers: readonly ContentLayer[],
    documentEpoch: number,
    sourceDocument: ProjectDocument,
  ) => boolean;
  insertRouteVertex: (
    id: string,
    vertexIndex: number,
    coordinate?: readonly [number, number],
  ) => void;
  moveLayer: (id: string, toIndex: number) => void;
  openDocument: (document: ProjectDocument) => void;
  setProjectTitle: (title: string) => void;
  renameLayer: (id: string, name: string) => void;
  replaceLayerFromImport: (
    id: string,
    layer: ContentLayer,
    documentEpoch: number,
    sourceDocument: ProjectDocument,
  ) => boolean;
  selectLayer: (id: string | null) => void;
  setCameraBearing: (bearing: number) => void;
  setCameraViewport: (
    center: readonly [number, number],
    zoom: number,
    mode?: "amend" | "history",
  ) => void;
  setMapAreaLocked: (isLocked: boolean) => void;
  setCameraPitch: (pitch: number) => void;
  setPageDimension: (dimension: "widthMm" | "heightMm", value: number) => void;
  setPageBoundaryVisible: (isVisible: boolean) => void;
  setPageOrientation: (orientation: PageOrientation) => void;
  setPagePreset: (preset: PagePreset) => void;
  setLayerAppearance: (id: string, appearance: LayerAppearance) => void;
  setRouteMarker: (id: string, marker: RouteMarkerAppearance | null) => void;
  setRouteSegmentStyle: (
    id: string,
    segmentIndex: number,
    style: RouteSegmentStyleOverride | null,
  ) => void;
  setPoiCoordinates: (
    id: string,
    coordinates: readonly [number, number],
  ) => void;
  setPoiCustomMarker: (id: string, asset: CustomMarkerAsset | null) => void;
  setRouteVertex: (
    id: string,
    vertexIndex: number,
    coordinates: readonly [number, number],
  ) => void;
  setArcSegmentCurvature: (
    id: string,
    segmentIndex: number,
    curvature: number,
  ) => void;
  setShapeGeometry: (
    id: string,
    geometry: import("../domain/project").ShapeGeometry,
  ) => void;
  setShapeVertex: (
    id: string,
    ringIndex: number,
    vertexIndex: number,
    coordinates: readonly [number, number],
  ) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  setMapStyle: (preset: MapStylePreset) => void;
  setMapStyleAdjustment: (
    adjustment: "contrast" | "detail",
    value: number,
    mode?: "history" | "amend",
  ) => void;
  setMapStyleColor: (
    role: MapStyleTokenRole,
    color: string | null,
    mode?: "history" | "amend",
  ) => void;
  setMapStyleTone: (tone: MapStyleTone) => void;
  resetMapStyle: () => void;
  resetMapStyleCustomization: () => void;
  setMapLanguage: (language: MapLanguage) => void;
  setMapTextScale: (textScalePercent: number) => void;
  setMapFeatureVisibility: (
    category: MapFeatureVisibilityCategory,
    isVisible: boolean,
  ) => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  undo: () => void;
  redo: () => void;
  removeRouteVertex: (id: string, vertexIndex: number) => void;
  replaceRouteGeometry: (
    id: string,
    coordinates: readonly (readonly [number, number])[],
  ) => void;
};

export function createProjectStore(
  initialDocument: ProjectDocument = createNewProjectDocument(),
) {
  return createStore<ProjectState>((set) => ({
    document: copyDocument(initialDocument),
    documentEpoch: 0,
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
  }));
}
