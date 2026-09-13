import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ContentLayer } from "../../domain/project";
import { trackEditorAction } from "../../analytics/editorAnalytics";
import type { ShapeAuthoringMode } from "./ShapeDrawingPanel";
import {
  createIsochroneCenterLayer,
  createRouteDraftLayers,
  createShapeDraftLayers,
} from "./authoringDraftLayers";
import { CanvasWorkspaceView } from "./CanvasWorkspaceView";
import { createCanvasWorkspaceViewProps } from "./createCanvasWorkspaceViewProps";
import type { CanvasWorkspaceProps } from "./CanvasWorkspace.types";
import type { useCanvasRouteAuthoring } from "../hooks/useCanvasRouteAuthoring";
import type { useCanvasShapeAuthoring } from "../hooks/useCanvasShapeAuthoring";
import {
  useCanvasSearchSelection,
  useCanvasToolActivation,
} from "../hooks/useCanvasWorkspaceInteractions";
import { useCanvasAuthoringModels } from "../hooks/useCanvasAuthoringModels";
import { shouldBlockEditorShortcuts } from "../keyboardScope";
import { useUnfinishedDrawingProtection } from "../hooks/useUnfinishedDrawingProtection";

export type { CanvasWorkspaceProps } from "./CanvasWorkspace.types";

const TOOL_SHORTCUTS: Record<string, string> = {
  v: "select",
  r: "route",
  p: "pin",
  s: "shape",
};

function shouldIgnoreToolShortcut(event: KeyboardEvent) {
  return (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    shouldBlockEditorShortcuts(event.target)
  );
}

function resolvedToolShortcut(
  event: KeyboardEvent,
  isMapLocked: boolean,
): string | null {
  if (event.shiftKey && (event.code === "Digit1" || event.key === "1")) return isMapLocked ? null : "frame";
  if (event.shiftKey) return null;
  const toolId = TOOL_SHORTCUTS[event.key.toLowerCase()];
  return toolId ?? null;
}

function useToolShortcuts({
  activateTool,
  fitPage,
  isMapLocked,
  isBlocked,
}: {
  activateTool: (id: string) => void;
  fitPage: () => void;
  isMapLocked: boolean;
  isBlocked: boolean;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isBlocked || shouldIgnoreToolShortcut(event)) return;
      const toolId = resolvedToolShortcut(event, isMapLocked);
      if (!toolId) return;
      event.preventDefault();
      if (toolId === "frame") fitPage();
      else activateTool(toolId);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activateTool, fitPage, isBlocked, isMapLocked]);
}

type MapClickOptions = {
  activeTool: string;
  placePoi?: (coordinate: [number, number]) => void;
  addShapePoint: (coordinate: readonly [number, number]) => void;
  setIsochroneCenter?: (coordinate: [number, number]) => void;
  shapeMode: ShapeAuthoringMode;
};

function mapClickForAuthoring(options: MapClickOptions) {
  if (options.activeTool === "pin") return options.placePoi;
  if (options.activeTool === "shape" && options.shapeMode === "isochrone")
    return options.setIsochroneCenter;
  if (options.activeTool !== "shape" || options.shapeMode !== "draw") return;
  return options.addShapePoint;
}

function useCanvasGeometryLayers(
  activeTool: string,
  layers: ContentLayer[],
  route: ReturnType<typeof useCanvasRouteAuthoring>,
  shape: ReturnType<typeof useCanvasShapeAuthoring>,
) {
  const hiddenExtensionLayerId = route.options.lineShape === "road"
    ? route.extensionLayerId
    : null;
  return useMemo(
    () => [
      ...createRouteDraftLayers(
        activeTool === "route" && route.points.length > 0
          ? route.draftPoints
          : [],
        layers,
        route.options,
        {
          isClosed: route.isClosed,
          roadPreview: route.preview,
        },
      ),
      ...(activeTool === "shape" && shape.mode === "draw"
        ? createShapeDraftLayers(shape.points, layers)
        : []),
      ...createIsochroneCenterLayer(
        activeTool === "shape" && shape.mode === "isochrone"
          ? shape.isochrone.center?.coordinate
          : undefined,
        layers,
      ),
      ...layers.filter((layer) =>
        layer.geometry && layer.id !== hiddenExtensionLayerId
      ),
    ],
    [
      activeTool,
      layers,
      route.draftPoints,
      route.options,
      route.isClosed,
      route.preview,
      route.points.length,
      hiddenExtensionLayerId,
      shape.isochrone.center,
      shape.mode,
      shape.points,
    ],
  );
}

export function CanvasWorkspace(props: CanvasWorkspaceProps) {
  const [storedActiveTool, setStoredActiveTool] = useState("select");
  const [toolDocumentEpoch, setToolDocumentEpoch] = useState(props.documentEpoch);
  const [fitRequest, setFitRequest] = useState(0);
  const [fitLayerRequest, setFitLayerRequest] = useState({ id: null as string | null, request: 0 });
  const selectToolRef = useRef<HTMLButtonElement>(null);
  const {
    camera, documentEpoch, layers, onAuthoringChange, onLayerSelect,
  } = props;
  const activeTool =
    toolDocumentEpoch === documentEpoch ? storedActiveTool : "select";
  const {
    poi: poiAuthoring,
    route,
    shape,
  } = useCanvasAuthoringModels({
    activeTool,
    props,
    selectToolRef,
    setActiveTool: setStoredActiveTool,
    setFitLayerRequest,
    setToolDocumentEpoch,
    toolDocumentEpoch,
  });
  useUnfinishedDrawingProtection(
    documentEpoch, route.hasUnfinishedWork || shape.hasUnfinishedWork || poiAuthoring.hasUnfinishedWork, props.onUnfinishedDrawingChange,
  );
  const geometryLayers = useCanvasGeometryLayers(
    activeTool,
    layers,
    route,
    shape,
  );
  const activateTool = useCanvasToolActivation({
    activeTool,
    documentEpoch,
    onAuthoringChange,
    onLayerSelect,
    poi: poiAuthoring,
    route,
    setStoredActiveTool,
    setToolDocumentEpoch,
    storedActiveTool,
    toolDocumentEpoch,
  });
  const fitPage = useCallback(
    () => {
      trackEditorAction("fitPageRequested");
      setFitRequest((request) => request + 1);
    },
    [],
  );
  useToolShortcuts({
    activateTool,
    fitPage,
    isMapLocked: camera.locked,
    isBlocked: props.isModalOpen || route.isDiscardOpen || (activeTool === "pin" && poiAuthoring.spreadsheetOpen),
  });
  const handleMapClick =
    activeTool === "route"
      ? (coordinate: [number, number]) =>
          route.addPoint(coordinate, "map click", true)
      : mapClickForAuthoring({
          activeTool,
          placePoi: poiAuthoring.spreadsheetOpen
            ? undefined
            : poiAuthoring.place,
          setIsochroneCenter: (coordinate) =>
            shape.isochrone.setCenter({
              coordinate,
              label: "Selected map point",
            }),
          addShapePoint: shape.addPoint,
          shapeMode: shape.mode,
        });
  const searchSelection = useCanvasSearchSelection({
    activeTool,
    documentEpoch,
    isMapLocked: camera.locked,
    layers,
    selectToolRef,
    onLocate: props.onLocate,
    poi: poiAuthoring,
    route,
    shape,
  });

  return (
    <CanvasWorkspaceView
      {...createCanvasWorkspaceViewProps({
        activeTool,
        activateTool,
        fitLayerRequest,
        fitPage,
        fitRequest,
        geometryLayers,
        handleMapClick,
        searchSelection,
        poi: poiAuthoring,
        props,
        route,
        shape,
      })}
      selectToolRef={selectToolRef}
    />
  );
}
