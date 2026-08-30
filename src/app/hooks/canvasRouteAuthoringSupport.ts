import { useEffect, type RefObject } from "react";
import type { CameraSettings, ContentLayer } from "../../domain/project";
import {
  DEFAULT_ROUTE_AUTHORING_OPTIONS,
  type RoadTravelMode,
  type RouteAuthoringOptions,
  type RouteLineShape,
  type RouteTravelMarker,
} from "../../domain/routeProfiles";
import { semanticRoutePositions } from "../../domain/routeGeometry";
import type { DirectionsProvider } from "../../services/mapbox/contracts";
import type { ProjectState, RouteMutationResult } from "../store";
import type {
  CreateDirectionsRoute,
  RouteExtensionEndpoint,
} from "../components/routeAuthoringActions";

export type RouteExtensionRequest = {
  endpoint: RouteExtensionEndpoint;
  layer: ContentLayer;
  request: number;
  trigger: HTMLButtonElement;
};

export type RouteAuthoringParameters = {
  activeTool: string;
  camera: CameraSettings;
  directionsProvider?: DirectionsProvider;
  documentEpoch: number;
  layers: ContentLayer[];
  onAuthoringChange: (documentEpoch: number, isActive: boolean) => void;
  onCreateDirectionsRoute: CreateDirectionsRoute;
  onCreateRoute: (
    coordinates: readonly (readonly [number, number])[],
    options?: RouteAuthoringOptions,
  ) => RouteMutationResult;
  onLayerSelect: (id: string | null) => void;
  onReplaceAuthoredRoute: (
    id: string,
    geometry:
      | import("../../domain/project").ArcGeometry
      | { type: "LineString"; coordinates: [number, number][] },
    travelMarker: RouteTravelMarker | null,
    expectedLayer: ContentLayer,
  ) => RouteMutationResult;
  onReplaceDirectionsRoute: ProjectState["replaceDirectionsRoute"];
  routeExtensionRequest: RouteExtensionRequest | null;
  selectToolRef: RefObject<HTMLButtonElement | null>;
  setActiveTool: (id: string) => void;
  setToolDocumentEpoch: (epoch: number) => void;
  toolDocumentEpoch: number;
};

export type RouteStateSetters = {
  setAnnouncement: (value: string | null) => void;
  setError: (value: string | null) => void;
  setExtension: (value: RouteExtensionRequest | null) => void;
  setLineShape: (value: RouteLineShape) => void;
  setPoints: (value: [number, number][]) => void;
  setRoadTravelMode: (value: RoadTravelMode) => void;
  setTravelMarker: (value: RouteTravelMarker | null) => void;
};

function routeLineShape(layer: ContentLayer): RouteLineShape {
  if (layer.provenance?.service === "directions-v5") return "road";
  return layer.geometry?.type === "Arc" ? "arc" : "straight";
}

function routeRoadMode(layer: ContentLayer): RoadTravelMode {
  if (layer.provenance?.service !== "directions-v5")
    return DEFAULT_ROUTE_AUTHORING_OPTIONS.roadTravelMode;
  if (layer.provenance.profile === "walking") return "walk";
  return layer.provenance.profile === "cycling" ? "bike" : "car";
}

export function useRouteExtensionActivation(
  parameters: RouteAuthoringParameters,
  extension: RouteExtensionRequest | null,
  setters: RouteStateSetters,
) {
  useEffect(() => {
    const request = parameters.routeExtensionRequest;
    if (!request || request.request === extension?.request) return;
    const timeout = window.setTimeout(() => {
      const current = parameters.layers.find(
        (layer) => layer.id === request.layer.id,
      );
      if (
        current !== request.layer ||
        current.type !== "route" ||
        current.locked ||
        !current.visible
      ) {
        setters.setError(
          "This route changed before extension could start. Select it and try again.",
        );
        return;
      }
      setters.setExtension(request);
      setters.setPoints([]);
      setters.setError(null);
      setters.setAnnouncement(
        `Extending ${current.name} from its ${request.endpoint}.`,
      );
      setters.setLineShape(routeLineShape(current));
      setters.setRoadTravelMode(routeRoadMode(current));
      setters.setTravelMarker(
        current.appearance?.kind === "route"
          ? current.appearance.travelMarker
          : null,
      );
      parameters.setToolDocumentEpoch(parameters.documentEpoch);
      parameters.setActiveTool("route");
      parameters.onLayerSelect(null);
      parameters.onAuthoringChange(parameters.documentEpoch, true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [extension?.request, parameters, setters]);
}

type RouteKeyboardOptions = {
  active: boolean;
  canFinish: boolean;
  canUndo: boolean;
  isDiscardOpen: boolean;
  isRouting: boolean;
  onCancel: (trigger: HTMLElement | null) => void;
  onFinish: () => void;
  onUndo: () => void;
};

function shouldIgnoreRouteKey(
  event: KeyboardEvent,
  options: RouteKeyboardOptions,
) {
  return (
    !options.active ||
    options.isDiscardOpen ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  );
}

function isRouteTypingTarget(target: HTMLElement | null) {
  return (
    target?.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"]',
    ) !== null
  );
}

function isRouteInteractiveTarget(target: HTMLElement | null) {
  return target?.closest('button, a, [role="button"], [role="radio"]') !== null;
}

function isFinishRouteKey(event: KeyboardEvent, options: RouteKeyboardOptions) {
  return event.key === "Enter" && options.canFinish && !options.isRouting;
}

function isUndoRouteKey(event: KeyboardEvent, options: RouteKeyboardOptions) {
  return (
    (event.key === "Backspace" || event.key === "Delete") &&
    options.canUndo &&
    !options.isRouting
  );
}

function handleRouteKey(event: KeyboardEvent, options: RouteKeyboardOptions) {
  if (shouldIgnoreRouteKey(event, options)) return;
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (isRouteTypingTarget(target)) return;
  if (event.key === "Escape") {
    event.preventDefault();
    options.onCancel(target);
    return;
  }
  if (isRouteInteractiveTarget(target)) return;
  if (isFinishRouteKey(event, options)) {
    event.preventDefault();
    options.onFinish();
    return;
  }
  if (isUndoRouteKey(event, options)) {
    event.preventDefault();
    options.onUndo();
  }
}

export function useRouteKeyboard(options: RouteKeyboardOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) =>
      handleRouteKey(event, options);
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [options]);
}

export function extensionDraftPoints(
  extension: RouteExtensionRequest | null,
  points: [number, number][],
) {
  if (!extension) return points;
  const positions = semanticRoutePositions(extension.layer);
  const endpoint =
    extension.endpoint === "start" ? positions?.[0] : positions?.at(-1);
  return endpoint
    ? [[endpoint[0], endpoint[1]] as [number, number], ...points]
    : points;
}
