import {
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { SearchResult } from "../../services/mapbox/contracts";
import type { CanvasWorkspaceProps } from "../components/CanvasWorkspace.types";
import type { useCanvasRouteAuthoring } from "./useCanvasRouteAuthoring";
import type { useCanvasShapeAuthoring } from "./useCanvasShapeAuthoring";
import { useLatestValue } from "./useLatestValue";
import type { usePoiAuthoring } from "./usePoiAuthoring";

type PoiAuthoring = ReturnType<typeof usePoiAuthoring>;
type RouteAuthoring = ReturnType<typeof useCanvasRouteAuthoring>;
type ShapeAuthoring = ReturnType<typeof useCanvasShapeAuthoring>;

type ToolActivationOptions = {
  activeTool: string;
  documentEpoch: number;
  onAuthoringChange: CanvasWorkspaceProps["onAuthoringChange"];
  onLayerSelect: CanvasWorkspaceProps["onLayerSelect"];
  poi: PoiAuthoring;
  route: RouteAuthoring;
  setStoredActiveTool: Dispatch<SetStateAction<string>>;
  setToolDocumentEpoch: Dispatch<SetStateAction<number>>;
  shape: ShapeAuthoring;
  storedActiveTool: string;
  toolDocumentEpoch: number;
};

export function useCanvasToolActivation(options: ToolActivationOptions) {
  const getCurrent = useLatestValue(options);
  return useCallback((id: string) => {
    const current = getCurrent();
    if (!current.route.requestToolChange(id)) return;
    current.setToolDocumentEpoch(current.documentEpoch);
    current.setStoredActiveTool(id);
    if (["route", "pin", "shape"].includes(id)) current.onLayerSelect(null);
    if (
      id === current.storedActiveTool
      && current.toolDocumentEpoch === current.documentEpoch
    ) {
      return;
    }
    if (
      id !== "shape"
      || current.toolDocumentEpoch !== current.documentEpoch
    ) {
      current.shape.setPoints([]);
    }
    if (id === "shape") current.shape.setMode("administrative");
    if (
      id !== "pin"
      || current.toolDocumentEpoch !== current.documentEpoch
    ) {
      current.poi.resetSpreadsheet();
    }
    current.onAuthoringChange(
      current.documentEpoch,
      ["route", "pin", "shape"].includes(id),
    );
  }, [getCurrent]);
}

type SearchSelectionOptions = {
  activeTool: string;
  onLocate: CanvasWorkspaceProps["onLocate"];
  poi: PoiAuthoring;
  route: RouteAuthoring;
  shape: ShapeAuthoring;
};

function isSearchResultConsumed(options: SearchSelectionOptions) {
  return (
    options.activeTool === "route" ||
    (options.activeTool === "pin" && !options.poi.spreadsheetOpen) ||
    (options.activeTool === "shape" && options.shape.mode === "isochrone")
  );
}

export function useCanvasSearchSelection(options: SearchSelectionOptions) {
  const getCurrent = useLatestValue(options);
  return useCallback(
    (coordinate: [number, number], result: SearchResult) => {
      const current = getCurrent();
      if (!isSearchResultConsumed(current)) {
        current.onLocate?.(coordinate, () => {});
      }
      if (current.activeTool === "route") {
        current.route.addPoint(
          coordinate,
          `search result ${result.label}`,
        );
      }
      if (current.activeTool === "pin" && !current.poi.spreadsheetOpen) {
        current.poi.placeSearchResult(
          coordinate,
          result.label,
          result.providerFeatureId,
        );
      }
      if (
        current.activeTool === "shape"
        && current.shape.mode === "isochrone"
      ) {
        current.shape.isochrone.setCenter({
          coordinate,
          label: result.label,
        });
      }
    },
    [getCurrent],
  );
}
