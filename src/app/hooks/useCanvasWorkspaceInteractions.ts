import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { SearchResult } from "../../services/mapbox/contracts";
import { trackEditorAction } from "../../analytics/editorAnalytics";
import type { ContentLayer, LayerGeometry } from "../../domain/project";
import type { SearchSelectionFeedback } from "../components/LocationSearchFeedback";
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
  storedActiveTool: string;
  toolDocumentEpoch: number;
};

const TOOL_ACTIVATION_ACTIONS = {
  select: "selectToolActivated",
  route: "routeToolActivated",
  pin: "poiToolActivated",
  shape: "shapeToolActivated",
} as const;

export function useCanvasToolActivation(options: ToolActivationOptions) {
  const getCurrent = useLatestValue(options);
  return useCallback((id: string) => {
    const current = getCurrent();
    if (!current.route.requestToolChange(id)) return;
    if (!current.poi.requestToolChange(id)) return;
    current.setToolDocumentEpoch(current.documentEpoch);
    current.setStoredActiveTool(id);
    if (["route", "pin", "shape"].includes(id)) current.onLayerSelect(null);
    if (
      id === current.storedActiveTool
      && current.toolDocumentEpoch === current.documentEpoch
    ) {
      return;
    }
    if (Object.hasOwn(TOOL_ACTIVATION_ACTIONS, id)) {
      trackEditorAction(TOOL_ACTIVATION_ACTIONS[id as keyof typeof TOOL_ACTIVATION_ACTIONS]);
    }
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
  documentEpoch: number;
  isMapLocked: boolean;
  layers: readonly ContentLayer[];
  selectToolRef: RefObject<HTMLButtonElement | null>;
  onLocate: CanvasWorkspaceProps["onLocate"];
  poi: PoiAuthoring;
  route: RouteAuthoring;
  shape: ShapeAuthoring;
};

type CreatedPlace = { documentEpoch: number; id: string; providerFeatureId: string };
type SearchPointLayer = ContentLayer & { geometry: Extract<LayerGeometry, { type: "Point" }> };

function isCreatedPlace(layer: ContentLayer | undefined, placement: CreatedPlace): layer is SearchPointLayer {
  return layer !== undefined && layer.id === placement.id && layer.type === "poi"
    && layer.geometry?.type === "Point" && layer.provenance?.service === "geocoding-v6"
    && layer.provenance.providerFeatureId === placement.providerFeatureId;
}

function isSearchResultConsumed(options: SearchSelectionOptions) {
  return (
    options.activeTool === "route" ||
    (options.activeTool === "pin" && !options.poi.spreadsheetOpen) ||
    (options.activeTool === "shape" && options.shape.mode === "isochrone")
  );
}

export function useCanvasSearchSelection(options: SearchSelectionOptions) {
  const getCurrent = useLatestValue(options);
  const [placement, setPlacement] = useState<CreatedPlace | null>(null);
  const createdLayer = placement && placement.documentEpoch === options.documentEpoch
    ? options.layers.find((layer) => layer.id === placement.id) : undefined;
  const clearFeedback = useCallback(() => setPlacement(null), []);
  const dismissFeedback = useCallback(() => {
    clearFeedback();
    getCurrent().selectToolRef.current?.focus();
  }, [clearFeedback, getCurrent]);
  // Retire obsolete confirmation state so Undo cannot revive an old action.
  if (placement && (options.activeTool !== "select" || !isCreatedPlace(createdLayer, placement))) {
    setPlacement(null);
  }
  const reveal = useCallback(() => {
    if (!placement) return;
    const current = getCurrent();
    const layer = current.layers.find((candidate) => candidate.id === placement.id);
    if (current.documentEpoch !== placement.documentEpoch || current.activeTool !== "select"
      || current.isMapLocked || !isCreatedPlace(layer, placement) || !layer.visible) return;
    current.selectToolRef.current?.focus();
    current.onLocate?.([layer.geometry.coordinates[0], layer.geometry.coordinates[1]], () => {
      setPlacement((latest) => latest === placement ? null : latest);
    });
  }, [getCurrent, placement]);
  const feedback = useMemo<SearchSelectionFeedback | null>(() => {
    if (!placement || options.activeTool !== "select" || !isCreatedPlace(createdLayer, placement)) return null;
    const disabledReason = options.isMapLocked ? "Unlock the map area to show this location."
      : (createdLayer.visible ? undefined : "Show this layer before locating it.");
    return {
      message: `Added ${createdLayer.name}.`,
      onDismiss: dismissFeedback,
      action: options.onLocate ? { label: "Show on map", onInvoke: reveal, disabledReason } : undefined,
    };
  }, [createdLayer, dismissFeedback, options.activeTool, options.isMapLocked, options.onLocate, placement, reveal]);
  const onSelect = useCallback(
    (coordinate: [number, number], result: SearchResult) => {
      const current = getCurrent();
      setPlacement(null);
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
        const id = current.poi.placeSearchResult(
          coordinate,
          result.label,
          result.providerFeatureId,
        );
        if (id) setPlacement({ documentEpoch: current.documentEpoch, id, providerFeatureId: result.providerFeatureId });
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
  return { onSelect, feedback, clearFeedback };
}
