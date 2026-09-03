import type { RefObject } from "react";
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

export type CanvasWorkspaceProps = {
  layers: ContentLayer[];
  assets: Record<string, CustomMarkerAsset>;
  camera: CameraSettings;
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
  layersTriggerRef: RefObject<HTMLButtonElement | null>;
  propertiesTriggerRef: RefObject<HTMLButtonElement | null>;
  onLayerSelect: (id: string | null) => void;
  onLocate?: (coordinate: [number, number], onApplied: () => void) => void;
  onPoiCoordinatesChange?: (
    id: string,
    coordinate: readonly [number, number],
  ) => void;
  onRouteGeometryChange?: (
    id: string,
    coordinates: readonly (readonly [number, number])[],
  ) => void;
  onRouteVertexChange?: (
    id: string,
    vertexIndex: number,
    coordinate: readonly [number, number],
  ) => void;
  onRouteVertexInsert?: (id: string, segmentIndex: number) => void;
  onShapeGeometryChange?: (id: string, geometry: ShapeGeometry) => void;
  onCameraViewportChange: (
    center: readonly [number, number],
    zoom: number,
    mode: CameraViewportChangeMode,
    orientation: Pick<CameraSettings, "bearing" | "pitch">,
  ) => void;
  onCreateAdministrativeArea: (area: AdministrativeArea) => string | null;
  onCreateDirectionsRoute: CreateDirectionsRoute;
  onReplaceDirectionsRoute: ProjectState["replaceDirectionsRoute"];
  onReplaceRouteDraft: ProjectState["replaceRouteDraft"];
  directionsProvider?: DirectionsProvider;
  searchProvider?: SearchProvider;
  onCreateIsochroneArea: (
    input: IsochroneAreaInput,
    expectedDocumentEpoch: number,
  ) => string | null;
  onCreatePoi: (coordinates: readonly [number, number]) => void;
  onCreatePoiBatch: (
    entries: readonly PoiSpreadsheetEntry[],
    expectedDocumentEpoch?: number,
  ) => void;
  onCreateSearchPoi: (
    input: SearchPoiInput,
    expectedDocumentEpoch: number,
  ) => string | null;
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
  onCreateShape: (coordinates: readonly (readonly [number, number])[]) => void;
  onAuthoringChange: (documentEpoch: number, isActive: boolean) => void;
  onBackgroundClick: () => void;
  onExporterChange: (exporter: PreviewPngExporter | null) => void;
  openPanel: (panel: MobilePanel) => void;
  routeExtensionRequest: RouteExtensionRequest | null;
};
