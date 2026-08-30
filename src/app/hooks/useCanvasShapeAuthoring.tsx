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

type CanvasShapeAuthoringParameters = {
  activeTool: string;
  documentEpoch: number;
  layers: ContentLayer[];
  onAuthoringChange: (documentEpoch: number, isActive: boolean) => void;
  onCreateAdministrativeArea: (area: AdministrativeArea) => string | null;
  onCreateIsochroneArea: (
    input: IsochroneAreaInput,
    expectedDocumentEpoch: number,
  ) => string | null;
  onCreateShape: (coordinates: readonly (readonly [number, number])[]) => void;
  selectToolRef: RefObject<HTMLButtonElement | null>;
  selectedId: string | null;
  setActiveTool: (id: string) => void;
  setFitLayerRequest: (
    update: (current: { id: string | null; request: number }) => {
      id: string | null;
      request: number;
    },
  ) => void;
  setToolDocumentEpoch: (epoch: number) => void;
  toolDocumentEpoch: number;
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
  const [points, setPoints] = useState<[number, number][]>([]);
  const [mode, setMode] = useState<ShapeAuthoringMode>("administrative");
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
  const currentPoints =
    parameters.toolDocumentEpoch === parameters.documentEpoch ? points : [];
  const canFinish = countDistinctPoints(currentPoints) >= 3;
  const exit = () => {
    setPoints([]);
    parameters.setActiveTool("select");
    parameters.onAuthoringChange(parameters.documentEpoch, false);
    window.setTimeout(() => parameters.selectToolRef.current?.focus(), 0);
  };
  const isochrone = useIsochroneAuthoring({
    active: parameters.activeTool === "shape" && mode === "isochrone",
    documentEpoch: parameters.documentEpoch,
    onCreate: parameters.onCreateIsochroneArea,
    onCreated: (id) => {
      parameters.setFitLayerRequest((current) => ({
        id,
        request: current.request + 1,
      }));
      exit();
    },
  });
  const finish = () => {
    if (!canFinish) return;
    parameters.onCreateShape(currentPoints);
    exit();
  };
  const cancel = () => {
    isochrone.cancel();
    exit();
  };
  const addAdministrativeArea = (area: AdministrativeArea) => {
    const createdId = parameters.onCreateAdministrativeArea(area);
    if (createdId) {
      parameters.setFitLayerRequest((current) => ({
        id: createdId,
        request: current.request + 1,
      }));
    }
    exit();
  };
  const panelProps = {
    pointCount: currentPoints.length,
    canFinish,
    mode,
    onModeChange: (nextMode: ShapeAuthoringMode) => {
      isochrone.cancel();
      setMode(nextMode);
      setPoints([]);
    },
    onAddAdministrativeArea: addAdministrativeArea,
    onCancel: cancel,
    onUndo: () => setPoints((current) => current.slice(0, -1)),
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
    canEditPoints,
    editMode,
    isochrone,
    mode,
    panelProps,
    points: currentPoints,
    setEditMode: setStoredEditMode,
    setMode,
    setPoints,
  };
}
