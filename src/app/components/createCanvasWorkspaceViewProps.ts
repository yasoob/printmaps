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
  poi: ReturnType<typeof usePoiAuthoring>;
  props: CanvasWorkspaceProps;
  route: ReturnType<typeof useCanvasRouteAuthoring>;
  shape: ReturnType<typeof useCanvasShapeAuthoring>;
};

function isSearchResultConsumed(
  activeTool: string,
  shapeMode: string,
  isSpreadsheetOpen: boolean,
) {
  return (
    activeTool === "route" ||
    (activeTool === "pin" && !isSpreadsheetOpen) ||
    (activeTool === "shape" && shapeMode === "isochrone")
  );
}

function createSearchProps(
  inputs: ViewInputs,
): ComponentProps<typeof LocationSearch> {
  return {
    provider: inputs.props.searchProvider,
    proximity: inputs.props.camera.center,
    onSelect: (coordinate, result) => {
      const isConsumed = isSearchResultConsumed(
        inputs.activeTool,
        inputs.shape.mode,
        inputs.poi.spreadsheetOpen,
      );
      if (!isConsumed) inputs.props.onLocate?.(coordinate, () => {});
      if (inputs.activeTool === "route") {
        inputs.route.addPoint(coordinate, `search result ${result.label}`);
      }
      if (inputs.activeTool === "pin" && !inputs.poi.spreadsheetOpen) {
        inputs.poi.placeSearchResult(
          coordinate,
          result.label,
          result.providerFeatureId,
        );
      }
      if (inputs.activeTool === "shape" && inputs.shape.mode === "isochrone") {
        inputs.shape.isochrone.setCenter({ coordinate, label: result.label });
      }
    },
  };
}

function createMapProps(inputs: ViewInputs): ComponentProps<typeof MapCanvas> {
  const props = inputs.props;
  return {
    assets: props.assets,
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
    onLayerSelect: props.onLayerSelect,
    onMapClick: inputs.handleMapClick,
    onPoiCoordinatesChange: props.onPoiCoordinatesChange,
    onRouteGeometryChange: props.onRouteGeometryChange,
    onRouteVertexChange: props.onRouteVertexChange,
    onRouteVertexInsert: props.onRouteVertexInsert,
    onShapeGeometryChange: props.onShapeGeometryChange,
    orientation: props.page.orientation,
    page: props.page,
    previewedId: props.previewedId,
    selectedId: props.selectedId,
    shapeEditMode: inputs.shape.editMode,
    stylePreset: props.stylePreset,
    textScalePercent: props.textScalePercent,
  };
}

function createChromeProps(
  inputs: ViewInputs,
): Omit<ComponentProps<typeof CanvasWorkspaceChrome>, "selectToolRef"> {
  return {
    activeTool: inputs.activeTool,
    camera: inputs.props.camera,
    onActivateTool: inputs.activateTool,
    onFitPage: inputs.fitPage,
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
