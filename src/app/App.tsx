import { useCallback, useMemo, useRef, useState } from "react";
import type { StoreApi } from "zustand/vanilla";
import {
  createInitialProjectDocument,
  type ContentLayer,
  type ProjectDocument,
} from "../domain/project";
import type { PreviewPngExporter } from "../export/previewPng";
import type {
  DirectionsProvider,
  MapMatchingProvider,
  SearchProvider,
} from "../services/mapbox/contracts";
import {
  createIndexedDbAutosaveRepository,
  type AutosaveRepository,
} from "../storage/autosave";
import { useProjectAutosave } from "../storage/useProjectAutosave";
import { StudioAppView } from "./components/StudioAppView";
import { useAppMapDataImport } from "./hooks/useAppMapDataImport";
import { useModalSurfaces } from "./hooks/useModalSurfaces";
import { useEditorShortcuts } from "./hooks/useEditorShortcuts";
import { useMapLocationCommand } from "./hooks/useMapLocationCommand";
import { useMobilePanels } from "./hooks/useMobilePanels";
import { useDirectionsRouteEditing } from "./hooks/useDirectionsRouteEditing";
import {
  ProjectStoreContext,
  useProject,
  useProjectActions,
} from "./projectStoreContext";
import { createProjectStore, type ProjectState } from "./store";
import type { RouteExtensionEndpoint } from "./components/routeAuthoringActions";

type AppProps = {
  autosaveRepository?: AutosaveRepository | null;
  autosaveLoadError?: unknown | null;
  directionsProvider?: DirectionsProvider;
  initialDocument?: ProjectDocument;
  mapMatchingProvider?: MapMatchingProvider;
  searchProvider?: SearchProvider;
};

function resolveInitialDocument(initialDocument: ProjectDocument | undefined) {
  if (initialDocument) return initialDocument;
  if (import.meta.env.MODE === "test") return createInitialProjectDocument();
  throw new Error("App requires an initial project document.");
}

function visiblePreviewLayerId(
  layers: readonly ContentLayer[],
  previewedLayerId: string | null,
) {
  if (previewedLayerId === null) return null;
  const layer = layers.find(({ id }) => id === previewedLayerId);
  return layer?.visible && layer.geometry ? previewedLayerId : null;
}

export function App({
  autosaveLoadError = null,
  autosaveRepository,
  directionsProvider,
  initialDocument,
  mapMatchingProvider,
  searchProvider,
}: AppProps = {}) {
  const [projectStore] = useState(() =>
    createProjectStore(resolveInitialDocument(initialDocument)),
  );
  return (
    <ProjectStoreContext value={projectStore}>
      <StudioApp
        autosaveRepository={autosaveRepository}
        autosaveLoadError={autosaveLoadError}
        directionsProvider={directionsProvider}
        mapMatchingProvider={mapMatchingProvider}
        projectStore={projectStore}
        searchProvider={searchProvider}
      />
    </ProjectStoreContext>
  );
}

function useResolvedAutosave(
  projectStore: StoreApi<ProjectState>,
  autosaveRepository: AutosaveRepository | null | undefined,
  autosaveLoadError: unknown | null,
) {
  const [resolved] = useState(() =>
    autosaveRepository === undefined
      ? (typeof indexedDB === "undefined"
        ? null
        : createIndexedDbAutosaveRepository())
      : autosaveRepository,
  );
  return useProjectAutosave(projectStore, resolved, autosaveLoadError);
}

function useMapExporter() {
  const [exporter, setExporter] = useState<{ run: PreviewPngExporter } | null>(
    null,
  );
  const onExporterChange = useCallback((next: PreviewPngExporter | null) => {
    setExporter(next ? { run: next } : null);
  }, []);
  return { run: exporter?.run ?? null, onExporterChange };
}

type StudioAppProps = AppProps & { projectStore: StoreApi<ProjectState> };

function copyPosition([longitude, latitude]: readonly [number, number]): [number, number] {
  return [longitude, latitude];
}

function useStudioDirectionsEditing(
  documentEpoch: number,
  layers: ContentLayer[],
  directionsProvider: DirectionsProvider | undefined,
  project: ReturnType<typeof useProjectActions>,
) {
  const editing = useDirectionsRouteEditing({
    documentEpoch,
    layers,
    ...(directionsProvider && { provider: directionsProvider }),
    replaceDirectionsRoute: project.replaceDirectionsRoute,
  });
  const mapLayers = useMemo(() => {
    const pendingWaypoints = editing.pendingWaypoints;
    if (!pendingWaypoints || !editing.pendingLayerId) return layers;
    return layers.map((layer) =>
      layer.provenance?.service === "directions-v5" &&
      layer.id === editing.pendingLayerId
        ? {
            ...layer,
            provenance: {
              ...layer.provenance,
              waypoints: pendingWaypoints.map((position) => copyPosition(position)),
            },
          }
        : layer,
    );
  }, [editing.pendingLayerId, editing.pendingWaypoints, layers]);
  const changeRouteVertex = useCallback(
    (
      id: string,
      vertexIndex: number,
      coordinate: readonly [number, number],
    ) => {
      if (!editing.changeWaypoint(id, vertexIndex, coordinate)) {
        project.setRouteVertex(id, vertexIndex, coordinate);
      }
    },
    [editing, project],
  );
  const removeRouteVertex = useCallback(
    (id: string, vertexIndex: number) => {
      if (!editing.removeWaypoint(id, vertexIndex))
        project.removeRouteVertex(id, vertexIndex);
    },
    [editing, project],
  );
  return { changeRouteVertex, editing, mapLayers, removeRouteVertex };
}

function useStudioAppModel(props: StudioAppProps) {
  const {
    autosaveLoadError = null,
    autosaveRepository,
    directionsProvider,
    mapMatchingProvider,
    projectStore,
    searchProvider,
  } = props;
  const project = useProjectActions();
  const layers = useProject((state) => state.document.layers);
  const assets = useProject((state) => state.document.assets);
  const page = useProject((state) => state.document.page);
  const pageBoundaryVisible = useProject((state) => state.pageBoundaryVisible);
  const style = useProject((state) => state.document.style);
  const selectedId = useProject((state) => state.selectedId);
  const documentEpoch = useProject((state) => state.documentEpoch);
  const autosave = useResolvedAutosave(
    projectStore,
    autosaveRepository,
    autosaveLoadError,
  );
  const [previewedLayerId, setPreviewedLayerId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const openExport = useCallback(() => setExportOpen(true), []);
  const [authoringState, setAuthoringState] = useState({
    documentEpoch: 0,
    active: false,
  });
  const [routeExtensionRequest, setRouteExtensionRequest] = useState<{
    endpoint: RouteExtensionEndpoint;
    layer: ContentLayer;
    request: number;
    trigger: HTMLButtonElement;
  } | null>(null);
  const mapExporter = useMapExporter();
  const mapLocation = useMapLocationCommand(documentEpoch);
  const draggedLayerIdRef = useRef<string | null>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const mobile = useMobilePanels();
  const handleMapDataImported = useCallback(
    () => setPreviewedLayerId(null),
    [],
  );
  const mapDataImport = useAppMapDataImport(
    project.importLayers,
    project.replaceLayerFromImport,
    autosave.corrupted,
    handleMapDataImported,
  );
  const modal = useModalSurfaces({
    exportButtonRef,
    exportOpen,
    importOpen: mapDataImport.isImportOpen,
    mobile,
    setExportOpen,
  });
  const mapPreviewedLayerId = visiblePreviewLayerId(layers, previewedLayerId);
  const selectedLayer = layers.find((layer) => layer.id === selectedId) ?? null;
  const isAuthoring =
    authoringState.documentEpoch === documentEpoch && authoringState.active;
  const directions = useStudioDirectionsEditing(
    documentEpoch,
    layers,
    directionsProvider,
    project,
  );
  const selectLayer = project.selectLayer;
  const openDocument = project.openDocument;
  const clearSelection = useCallback(() => selectLayer(null), [selectLayer]);
  const handleOpenedDocument = useCallback(
    (document: ProjectDocument) => {
      openDocument(document);
      setPreviewedLayerId(null);
    },
    [openDocument],
  );
  const handleAuthoringChange = useCallback(
    (nextDocumentEpoch: number, isActive: boolean) => {
      setAuthoringState({ documentEpoch: nextDocumentEpoch, active: isActive });
    },
    [],
  );
  const { deleteSelectedLayer, handleDeleteKeyDown } = useEditorShortcuts({
    deleteFocusTarget: () =>
      modal.mobilePanel === "properties"
        ? (mobile.propertiesPanelRef.current?.querySelector<HTMLElement>(
            "[data-project-heading]",
          ) ?? null)
        : null,
    isAuthoring,
    isModalOpen: modal.surface !== null || autosave.corrupted,
    layers,
    selectedLayer,
    setPreviewedLayerId,
  });
  return {
    assets, autosave, clearSelection, deleteSelectedLayer, directionsProvider,
    directionsRouteEditing: directions.editing, documentEpoch, draggedLayerIdRef,
    exportButtonRef, handleAuthoringChange, handleDeleteKeyDown, handleOpenedDocument,
    importButtonRef, isAuthoring, layers, mapDataImport, mapExporter,
    mapLayers: directions.mapLayers, mapLocation, mapMatchingProvider,
    mapPreviewedLayerId, mobile, modal, openButtonRef, openExport, page, pageBoundaryVisible, project,
    routeExtensionRequest, searchProvider, selectedId, selectedLayer,
    setPreviewedLayerId, setRouteExtensionRequest, style,
    changeRouteVertex: directions.changeRouteVertex,
    removeRouteVertex: directions.removeRouteVertex,
  };
}

export type StudioAppModel = ReturnType<typeof useStudioAppModel>;

function StudioApp(props: StudioAppProps) {
  return <StudioAppView model={useStudioAppModel(props)} />;
}
