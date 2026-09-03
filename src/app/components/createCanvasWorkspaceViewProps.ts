import type { ComponentProps } from "react";
import type { MapCanvas } from "../../map/MapCanvas";
import type { CanvasWorkspaceChrome } from "./CanvasWorkspaceChrome";
import type { LocationSearch } from "./LocationSearch";
import type { CanvasWorkspaceProps } from "./CanvasWorkspace";
import type { CanvasWorkspaceViewProps } from "./CanvasWorkspaceView";
import type { useCanvasRouteAuthoring } from "../hooks/useCanvasRouteAuthoring";
import type { useCanvasShapeAuthoring } from "../hooks/useCanvasShapeAuthoring";
import type { usePoiAuthoring } from "../hooks/usePoiAuthoring";

type ViewInputs = {
  activeTool: string;
  activateTool: (id: string) => void;
  fitLayerRequest: { id: string | null; request: number };
  fitPage: () => void;
  fitRequest: number;
  geometryLayers: CanvasWorkspaceProps["layers"];
  handleMapClick?: (coordinate: [number, number]) => void;
  handleSearchSelect: ComponentProps<typeof LocationSearch>["onSelect"];
  poi: ReturnType<typeof usePoiAuthoring>;
  props: CanvasWorkspaceProps;
  route: ReturnType<typeof useCanvasRouteAuthoring>;
  shape: ReturnType<typeof useCanvasShapeAuthoring>;
};

function createSearchProps(
  inputs: ViewInputs,
): ComponentProps<typeof LocationSearch> {
  return {
    provider: inputs.props.searchProvider,
    proximity: inputs.props.camera.center,
    onSelect: inputs.handleSearchSelect,
  };
}

function createMapProps(
  inputs: ViewInputs,
): Omit<ComponentProps<typeof MapCanvas>, "previewedId"> {
  const props = inputs.props;
  const basemap = props.layers.find(({ type }) => type === 'basemap');
  return {
    assets: props.assets,
    basemapVisible: basemap?.visible ?? true,
    camera: props.camera,
    contentRevision: inputs.geometryLayers,
    featureVisibility: props.featureVisibility,
    fitImportBounds: props.importFitRequest.bounds,
    fitImportRequest: props.importFitRequest.request,
    fitLayerId: inputs.fitLayerRequest.id,
    fitLayerRequest: inputs.fitLayerRequest.request,
    fitRequest: inputs.fitRequest,
    interactionMode: inputs.activeTool,
    language: props.language,
    layers: inputs.geometryLayers,
    locationRequest: props.locationRequest ?? { request: 0 },
    onBackgroundClick: props.onBackgroundClick,
    onCameraViewportChange: props.onCameraViewportChange,
    onExporterChange: props.onExporterChange,
    onFitPage: inputs.fitPage,
    onLayerSelect: props.onLayerSelect,
    onMapClick: inputs.handleMapClick,
    onPoiCoordinatesChange: props.onPoiCoordinatesChange,
    onRouteGeometryChange: props.onRouteGeometryChange,
    onRouteVertexChange: props.onRouteVertexChange,
    onRouteVertexInsert: props.onRouteVertexInsert,
    routeAuthoring: inputs.route.terraAuthoring,
    routeDraftEditing: inputs.route.draftEditing,
    onShapeGeometryChange: props.onShapeGeometryChange,
    orientation: props.page.orientation,
    page: props.page,
    pageBoundaryVisible: props.pageBoundaryVisible,
    selectedId: props.selectedId,
    shapeEditMode: inputs.shape.editMode,
    stylePreset: props.stylePreset,
    styleCustomization: props.styleCustomization,
    textScalePercent: props.textScalePercent,
  };
}

function createChromeProps(
  inputs: ViewInputs,
): Omit<ComponentProps<typeof CanvasWorkspaceChrome>, "selectToolRef" | "topDock"> {
  return {
    activeTool: inputs.activeTool,
    onActivateTool: inputs.activateTool,
    poiPanelProps: {
      active: inputs.activeTool === "pin",
      documentEpoch: inputs.props.documentEpoch,
      error: inputs.poi.placementError,
      searchProvider: inputs.props.searchProvider,
      spreadsheetOpen: inputs.poi.spreadsheetOpen,
      spreadsheetTriggerRef: inputs.poi.spreadsheetTriggerRef,
      onCancel: inputs.poi.cancel,
      onCancelSpreadsheet: inputs.poi.cancelSpreadsheet,
      onOpenSpreadsheet: inputs.poi.openSpreadsheet,
      onSubmitSpreadsheet: inputs.poi.submitSpreadsheet,
    },
    routePanelProps: inputs.route.panelProps,
    selectedShape: {
      canEditPoints: inputs.shape.canEditPoints,
      mode: inputs.shape.editMode,
      onChange: inputs.shape.setEditMode,
      selectedId: inputs.props.selectedId,
    },
    shapePanelProps: inputs.shape.panelProps,
  };
}

export function createCanvasWorkspaceViewProps(
  inputs: ViewInputs,
): Omit<CanvasWorkspaceViewProps, "selectToolRef"> {
  return {
    activePanel: inputs.props.activePanel,
    activeTool: inputs.activeTool,
    chromeProps: createChromeProps(inputs),
    isRouteDiscardOpen: inputs.route.isDiscardOpen,
    layersTriggerRef: inputs.props.layersTriggerRef,
    mapProps: createMapProps(inputs),
    onDiscardRoute: () => {
      const nextTool = inputs.route.discard();
      if (nextTool && nextTool !== "select") {
        window.setTimeout(() => inputs.activateTool(nextTool), 0);
      }
    },
    onKeepEditingRoute: inputs.route.keepEditing,
    onOpenPanel: inputs.props.openPanel,
    propertiesTriggerRef: inputs.props.propertiesTriggerRef,
    searchKey: inputs.props.documentEpoch,
    searchProps: createSearchProps(inputs),
  };
}
