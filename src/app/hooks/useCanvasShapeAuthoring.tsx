import { useState, type RefObject } from "react";
import type { ContentLayer, IsochroneAreaInput } from "../../domain/project";
import type { AdministrativeArea } from "../../domain/administrativeAreas";
import {
  canDirectlyEditShapePoints,
  type ShapeEditMode,
} from "../../map/ShapeVertexEditing";
import type { ShapeAuthoringMode } from "../components/ShapeDrawingPanel";
import { IsochronePanel } from "../components/IsochronePanel";
import { countDistinctPoints } from "../components/authoringDraftLayers";
import { useIsochroneAuthoring } from "./useIsochroneAuthoring";
import { useShapeDrawingDraft } from "./useShapeDrawingDraft";
import { useShapeDrawingKeyboard } from "./useShapeDrawingKeyboard";
import type { LayerMutationResult, ProjectMutationResult } from "../../domain/projectMutation";

type CanvasShapeAuthoringParameters = {
  activeTool: string;
  isModalOpen: boolean;
  isMobileViewport: boolean;
  center: readonly [number, number];
  documentEpoch: number;
  layers: ContentLayer[];
  onAuthoringChange: (documentEpoch: number, isActive: boolean) => void;
  onCreateAdministrativeArea: (area: AdministrativeArea) => LayerMutationResult;
  onCreateIsochroneArea: (
    input: IsochroneAreaInput,
    expectedDocumentEpoch: number,
  ) => LayerMutationResult;
  onCreateShape: (coordinates: readonly (readonly [number, number])[]) => ProjectMutationResult;
  selectToolRef: RefObject<HTMLButtonElement | null>;
  selectedId: string | null;
  setActiveTool: (id: string) => void;
  setFitLayerRequest: (
    update: (current: { id: string | null; request: number }) => {
      id: string | null;
      request: number;
    },
  ) => void;
};

function resolvedShapeEditMode(
  selectedId: string | null,
  canEditPoints: boolean,
  stored: { id: string; mode: ShapeEditMode } | null,
): ShapeEditMode {
  if (stored?.id === selectedId) return stored.mode;
  return canEditPoints ? "points" : "transform";
}

export function useCanvasShapeAuthoring(
  parameters: CanvasShapeAuthoringParameters,
) {
  const drawing = useShapeDrawingDraft(parameters.documentEpoch, parameters.center);
  const [commitError, setCommitError] = useState<{ epoch: number; mode: ShapeAuthoringMode; message: string } | null>(null);
  const error = commitError?.epoch === parameters.documentEpoch && commitError.mode === drawing.mode ? commitError.message : null;
  const { mode, points } = drawing;
  const [storedEditMode, setStoredEditMode] = useState<{
    id: string;
    mode: ShapeEditMode;
  } | null>(null);
  const selectedLayer = parameters.layers.find(
    (layer) => layer.id === parameters.selectedId,
  );
  const canEditPoints = canDirectlyEditShapePoints(selectedLayer);
  const editMode = resolvedShapeEditMode(
    parameters.selectedId,
    canEditPoints,
    storedEditMode,
  );
  const canFinish = countDistinctPoints(points) >= 3;
  const exit = () => {
    parameters.setActiveTool("select");
    parameters.onAuthoringChange(parameters.documentEpoch, false);
    window.setTimeout(() => parameters.selectToolRef.current?.focus(), 0);
  };
  const isochrone = useIsochroneAuthoring({
    active: parameters.activeTool === "shape" && mode === "isochrone",
    documentEpoch: parameters.documentEpoch,
    onCreate: parameters.onCreateIsochroneArea,
    onCreated: (id) => {
      parameters.setFitLayerRequest((current) => ({ id, request: current.request + 1 }));
      exit();
    },
  });
  const finish = () => {
    if (!canFinish) return;
    const result = parameters.onCreateShape(points);
    if (!result.ok) {
      setCommitError({ epoch: parameters.documentEpoch, mode: 'draw', message: result.error });
      return;
    }
    setCommitError(null);
    drawing.clear();
    exit();
  };
  const close = () => {
    isochrone.cancel();
    exit();
  };
  const cancel = () => {
    setCommitError(null);
    if (mode === "draw") drawing.clear();
    close();
  };
  useShapeDrawingKeyboard({
    active: parameters.activeTool === "shape",
    isDrawing: mode === "draw",
    isModalOpen: parameters.isModalOpen,
    canFinish,
    canUndo: points.length > 0,
    onClose: close,
    onFinish: finish,
    onUndo: drawing.undo,
  });
  const addAdministrativeArea = (area: AdministrativeArea) => {
    const result = parameters.onCreateAdministrativeArea(area);
    if (result.ok) {
      setCommitError(null);
      parameters.setFitLayerRequest((current) => ({ id: result.layerId, request: current.request + 1 }));
      exit();
    } else setCommitError({ epoch: parameters.documentEpoch, mode: 'administrative', message: result.error });
  };
  const panelProps = {
    isCompactViewport: parameters.isMobileViewport,
    pointCount: points.length,
    pointInput: drawing.pointInput,
    pointError: drawing.error ?? error,
    admissionError: error,
    shouldAutoCollapse: drawing.lastPointSource === "map",
    canFinish,
    mode,
    onModeChange: (nextMode: ShapeAuthoringMode) => {
      isochrone.cancel();
      drawing.setMode(nextMode);
    },
    onAddAdministrativeArea: addAdministrativeArea,
    onCancel: cancel,
    onClose: close,
    onUndo: drawing.undo,
    onFinish: finish,
    isochronePanel: (
      <IsochronePanel
        center={isochrone.center}
        error={isochrone.error}
        isGenerating={isochrone.isGenerating}
        minutes={isochrone.minutes}
        profile={isochrone.profile}
        onCancel={cancel}
        onGenerate={() => {
          void isochrone.generate();
        }}
        onMinutesChange={isochrone.setMinutes}
        onProfileChange={isochrone.setProfile}
      />
    ),
  };
  return {
    addPoint: drawing.addPoint,
    hasUnfinishedWork: drawing.hasUnfinishedWork,
    canEditPoints,
    editMode,
    isochrone,
    mode,
    panelProps,
    points,
    setEditMode: setStoredEditMode,
  };
}
