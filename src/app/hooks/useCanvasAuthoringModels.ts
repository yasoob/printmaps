import type {
  Dispatch,
  RefObject,
  SetStateAction,
} from "react";
import type { CanvasWorkspaceProps } from "../components/CanvasWorkspace.types";
import { useCanvasRouteAuthoring } from "./useCanvasRouteAuthoring";
import { useCanvasShapeAuthoring } from "./useCanvasShapeAuthoring";
import { usePoiAuthoring } from "./usePoiAuthoring";

type CanvasAuthoringModelOptions = {
  activeTool: string;
  props: CanvasWorkspaceProps;
  selectToolRef: RefObject<HTMLButtonElement | null>;
  setActiveTool: Dispatch<SetStateAction<string>>;
  setFitLayerRequest: Dispatch<
    SetStateAction<{ id: string | null; request: number }>
  >;
  setToolDocumentEpoch: Dispatch<SetStateAction<number>>;
  toolDocumentEpoch: number;
};

export function useCanvasAuthoringModels({
  activeTool,
  props,
  selectToolRef,
  setActiveTool,
  setFitLayerRequest,
  setToolDocumentEpoch,
  toolDocumentEpoch,
}: CanvasAuthoringModelOptions) {
  const poi = usePoiAuthoring({
    active: activeTool === "pin",
    documentEpoch: props.documentEpoch,
    selectToolRef,
    setActiveTool,
    onAuthoringChange: props.onAuthoringChange,
    onCreatePoi: props.onCreatePoi,
    onCreatePoiBatch: props.onCreatePoiBatch,
    onCreateSearchPoi: props.onCreateSearchPoi,
  });
  const route = useCanvasRouteAuthoring({
    activeTool,
    camera: props.camera,
    directionsProvider: props.directionsProvider,
    documentEpoch: props.documentEpoch,
    layers: props.layers,
    onAuthoringChange: props.onAuthoringChange,
    onCreateDirectionsRoute: props.onCreateDirectionsRoute,
    onCreateRoute: props.onCreateRoute,
    onLayerSelect: props.onLayerSelect,
    onReplaceAuthoredRoute: props.onReplaceAuthoredRoute,
    onReplaceDirectionsRoute: props.onReplaceDirectionsRoute,
    onReplaceRouteDraft: props.onReplaceRouteDraft,
    routeExtensionRequest: props.routeExtensionRequest,
    selectToolRef,
    setActiveTool,
    setToolDocumentEpoch,
    toolDocumentEpoch,
  });
  const shape = useCanvasShapeAuthoring({
    activeTool,
    documentEpoch: props.documentEpoch,
    layers: props.layers,
    onAuthoringChange: props.onAuthoringChange,
    onCreateAdministrativeArea: props.onCreateAdministrativeArea,
    onCreateIsochroneArea: props.onCreateIsochroneArea,
    onCreateShape: props.onCreateShape,
    selectToolRef,
    selectedId: props.selectedId,
    setActiveTool,
    setFitLayerRequest,
    setToolDocumentEpoch,
    toolDocumentEpoch,
  });
  return { poi, route, shape };
}
