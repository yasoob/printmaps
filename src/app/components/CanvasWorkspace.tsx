import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ContentLayer } from "../../domain/project";
import { usePoiAuthoring } from "../hooks/usePoiAuthoring";
import type { ShapeAuthoringMode } from "./ShapeDrawingPanel";
import {
  createIsochroneCenterLayer,
  createRouteDraftLayers,
  createShapeDraftLayers,
} from "./authoringDraftLayers";
import { useCanvasRouteAuthoring } from "../hooks/useCanvasRouteAuthoring";
import { useCanvasShapeAuthoring } from "../hooks/useCanvasShapeAuthoring";
import { CanvasWorkspaceView } from "./CanvasWorkspaceView";
import { createCanvasWorkspaceViewProps } from "./createCanvasWorkspaceViewProps";
import type { CanvasWorkspaceProps } from "./CanvasWorkspace.types";

export type { CanvasWorkspaceProps } from "./CanvasWorkspace.types";

const TOOL_SHORTCUTS: Record<string, string> = {
  v: "select",
  r: "route",
  p: "pin",
  s: "shape",
};

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"]',
    ) !== null
  );
}

function shouldIgnoreToolShortcut(event: KeyboardEvent) {
  return (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    isTypingTarget(event.target)
  );
}

function resolvedToolShortcut(
  event: KeyboardEvent,
  isMapLocked: boolean,
): string | null {
  if (event.key === "1" && event.shiftKey) return isMapLocked ? null : "frame";
  if (event.shiftKey) return null;
  const toolId = TOOL_SHORTCUTS[event.key.toLowerCase()];
  return toolId ?? null;
}

function useToolShortcuts({
  activateTool,
  fitPage,
  isMapLocked,
}: {
  activateTool: (id: string) => void;
  fitPage: () => void;
  isMapLocked: boolean;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreToolShortcut(event)) return;
      const toolId = resolvedToolShortcut(event, isMapLocked);
      if (!toolId) return;
      event.preventDefault();
      if (toolId === "frame") fitPage();
      else activateTool(toolId);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activateTool, fitPage, isMapLocked]);
}

type MapClickOptions = {
  activeTool: string;
  documentEpoch: number;
  placePoi?: (coordinate: [number, number]) => void;
  setShapePoints: Dispatch<SetStateAction<[number, number][]>>;
  setIsochroneCenter?: (coordinate: [number, number]) => void;
  setToolDocumentEpoch: Dispatch<SetStateAction<number>>;
  shapeMode: ShapeAuthoringMode;
  toolDocumentEpoch: number;
};

function mapClickForAuthoring(options: MapClickOptions) {
  if (options.activeTool === "pin") return options.placePoi;
  if (options.activeTool === "shape" && options.shapeMode === "isochrone")
    return options.setIsochroneCenter;
  if (options.activeTool !== "shape" || options.shapeMode !== "draw") return;
  return (coordinate: [number, number]) => {
    options.setToolDocumentEpoch(options.documentEpoch);
    options.setShapePoints((points) =>
      options.toolDocumentEpoch === options.documentEpoch
        ? [...points, coordinate]
        : [coordinate],
    );
  };
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
      ...(shape.mode === "draw"
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
    camera, directionsProvider, documentEpoch, layers, onAuthoringChange,
    onCreateAdministrativeArea, onCreateDirectionsRoute, onCreateIsochroneArea,
    onCreatePoi, onCreatePoiBatch, onCreateRoute, onCreateSearchPoi, onCreateShape,
    onLayerSelect, onReplaceAuthoredRoute, onReplaceDirectionsRoute,
    onReplaceRouteDraft,
    routeExtensionRequest, selectedId,
  } = props;
  const activeTool =
    toolDocumentEpoch === documentEpoch ? storedActiveTool : "select";
  const poiAuthoring = usePoiAuthoring({
    active: activeTool === "pin",
    documentEpoch,
    selectToolRef,
    setActiveTool: setStoredActiveTool,
    onAuthoringChange,
    onCreatePoi,
    onCreatePoiBatch,
    onCreateSearchPoi,
  });
  const route = useCanvasRouteAuthoring({
    activeTool,
    camera,
    directionsProvider,
    documentEpoch,
    layers,
    onAuthoringChange,
    onCreateDirectionsRoute,
    onCreateRoute,
    onLayerSelect,
    onReplaceAuthoredRoute,
    onReplaceDirectionsRoute,
    onReplaceRouteDraft,
    routeExtensionRequest,
    selectToolRef,
    setActiveTool: setStoredActiveTool,
    setToolDocumentEpoch,
    toolDocumentEpoch,
  });
  const shape = useCanvasShapeAuthoring({
    activeTool,
    documentEpoch,
    layers,
    onAuthoringChange,
    onCreateAdministrativeArea,
    onCreateIsochroneArea,
    onCreateShape,
    selectToolRef,
    selectedId,
    setActiveTool: setStoredActiveTool,
    setFitLayerRequest,
    setToolDocumentEpoch,
    toolDocumentEpoch,
  });
  const geometryLayers = useCanvasGeometryLayers(
    activeTool,
    layers,
    route,
    shape,
  );
  const activateTool = (id: string) => {
    if (!route.requestToolChange(id)) return;
    setToolDocumentEpoch(documentEpoch);
    setStoredActiveTool(id);
    if (["route", "pin", "shape"].includes(id)) onLayerSelect(null);
    if (id === storedActiveTool && toolDocumentEpoch === documentEpoch) return;
    if (id !== "shape" || toolDocumentEpoch !== documentEpoch)
      shape.setPoints([]);
    if (id === "shape") shape.setMode("administrative");
    if (id !== "pin" || toolDocumentEpoch !== documentEpoch)
      poiAuthoring.resetSpreadsheet();
    onAuthoringChange(documentEpoch, ["route", "pin", "shape"].includes(id));
  };
  const fitPage = () => setFitRequest((request) => request + 1);
  useToolShortcuts({ activateTool, fitPage, isMapLocked: camera.locked });
  const handleMapClick =
    activeTool === "route"
      ? (coordinate: [number, number]) =>
          route.addPoint(coordinate, "map click", true)
      : mapClickForAuthoring({
          activeTool,
          documentEpoch,
          placePoi: poiAuthoring.spreadsheetOpen
            ? undefined
            : poiAuthoring.place,
          setIsochroneCenter: (coordinate) =>
            shape.isochrone.setCenter({
              coordinate,
              label: "Selected map point",
            }),
          setShapePoints: shape.setPoints,
          setToolDocumentEpoch,
          shapeMode: shape.mode,
          toolDocumentEpoch,
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
        poi: poiAuthoring,
        props,
        route,
        shape,
      })}
      selectToolRef={selectToolRef}
    />
  );
}
