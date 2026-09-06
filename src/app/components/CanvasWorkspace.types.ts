import type { ReactNode, RefObject } from "react";
import type { AdministrativeArea } from "../../domain/administrativeAreas";
import type { CustomMarkerAsset } from "../../domain/customMarkerAssets";
import type { PoiSpreadsheetEntry } from "../../domain/poiSpreadsheet";
import type {
  CameraSettings,
  ContentLayer,
  IsochroneAreaInput,
  MapFeatureVisibility,
  MapLanguage,
  MapStylePreset,
  PageSettings,
  SearchPoiInput,
  ShapeGeometry,
} from "../../domain/project";
import type { MapStyleCustomization } from "../../domain/mapStyleCustomization";
import type {
  RouteAuthoringOptions,
  RouteTravelMarker,
} from "../../domain/routeProfiles";
import type { PreviewPngExporter } from "../../export/previewPng";
import type { CameraViewportChangeMode } from "../../map/MapCameraViewport";
import type { MapBounds } from "../../map/MapLayerBounds";
import type { MapLocationRequest } from "../../map/MapLocationRequest";
import type {
  DirectionsProvider,
  SearchProvider,
} from "../../services/mapbox/contracts";
import type { MobilePanel } from "../hooks/useMobilePanels";
import type { ProjectState, RouteMutationResult } from "../store";
import type { CreateDirectionsRoute } from "./routeAuthoringActions";
import type { RouteExtensionRequest } from "../hooks/useCanvasRouteAuthoring";
import type { GeometryEditResult, LayerMutationResult, ProjectMutationResult } from "../../domain/projectMutation";

export type CanvasWorkspaceProps = {
  statusNotice?: ReactNode;
  layers: ContentLayer[];
  assets: Record<string, CustomMarkerAsset>;
  camera: CameraSettings;
  getCanonicalCamera?: () => CameraSettings;
  stylePreset: MapStylePreset;
  styleCustomization: MapStyleCustomization;
  language: MapLanguage;
  textScalePercent: number;
  featureVisibility: MapFeatureVisibility;
  selectedId: string | null;
  page: PageSettings;
  pageBoundaryVisible: boolean;
  documentEpoch: number;
  importFitRequest: { bounds?: MapBounds; request: number };
  locationRequest?: MapLocationRequest;
  activePanel: MobilePanel | null;
  isModalOpen: boolean;
  isMobileViewport: boolean;
  layersTriggerRef: RefObject<HTMLButtonElement | null>;
  propertiesTriggerRef: RefObject<HTMLButtonElement | null>;
  onLayerSelect: (id: string | null) => void;
  onLocate?: (coordinate: [number, number], onApplied: () => void) => void;
  onPoiCoordinatesChange?: (
    id: string,
    coordinate: readonly [number, number],
  ) => ProjectMutationResult;
  onRouteGeometryChange?: (
    id: string,
    coordinates: readonly (readonly [number, number])[],
  ) => ProjectMutationResult;
  onRouteVertexChange?: (
    id: string,
    vertexIndex: number,
    coordinate: readonly [number, number],
  ) => GeometryEditResult;
  onRouteVertexInsert?: (id: string, segmentIndex: number) => ProjectMutationResult;
  onShapeGeometryChange?: (id: string, geometry: ShapeGeometry) => ProjectMutationResult;
  onCameraViewportChange: (
    center: readonly [number, number],
    zoom: number,
    mode: CameraViewportChangeMode,
    orientation: Pick<CameraSettings, "bearing" | "pitch">,
  ) => ProjectMutationResult;
  onCreateAdministrativeArea: (area: AdministrativeArea) => LayerMutationResult;
  onCreateDirectionsRoute: CreateDirectionsRoute;
  onReplaceDirectionsRoute: ProjectState["replaceDirectionsRoute"];
  onReplaceRouteDraft: ProjectState["replaceRouteDraft"];
  directionsProvider?: DirectionsProvider;
  searchProvider?: SearchProvider;
  onCreateIsochroneArea: (
    input: IsochroneAreaInput,
    expectedDocumentEpoch: number,
  ) => LayerMutationResult;
  onCreatePoi: (coordinates: readonly [number, number]) => ProjectMutationResult;
  onCreatePoiBatch: (
    entries: readonly PoiSpreadsheetEntry[],
    expectedDocumentEpoch?: number,
  ) => ProjectMutationResult;
  onCreateSearchPoi: (
    input: SearchPoiInput,
    expectedDocumentEpoch: number,
  ) => LayerMutationResult;
  onCreateRoute: (
    coordinates: readonly (readonly [number, number])[],
    options?: RouteAuthoringOptions,
  ) => RouteMutationResult;
  onReplaceAuthoredRoute: (
    id: string,
    geometry:
      | import("../../domain/project").ArcGeometry
      | { type: "LineString"; coordinates: [number, number][] },
    travelMarker: RouteTravelMarker | null,
    expectedLayer: ContentLayer,
  ) => RouteMutationResult;
  onCreateShape: (coordinates: readonly (readonly [number, number])[]) => ProjectMutationResult;
  onAuthoringChange: (documentEpoch: number, isActive: boolean) => void;
  onUnfinishedDrawingChange?: ProjectState["setHasUnfinishedDrawing"];
  onBackgroundClick: () => void;
  onExporterChange: (exporter: PreviewPngExporter | null) => void;
  openPanel: (panel: MobilePanel) => void;
  routeExtensionRequest: RouteExtensionRequest | null;
};
