import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ContentLayer } from "../../domain/project";
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
    shape,
    storedActiveTool,
    toolDocumentEpoch,
  });
  const fitPage = useCallback(
    () => setFitRequest((request) => request + 1),
    [],
  );
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
  const handleSearchSelect = useCanvasSearchSelection({
    activeTool,
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
        handleSearchSelect,
        poi: poiAuthoring,
        props,
        route,
        shape,
      })}
      selectToolRef={selectToolRef}
    />
  );
}
