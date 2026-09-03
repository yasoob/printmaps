import { useCallback, useMemo, useRef, useState } from "react";
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
  type AutosaveRepository,
} from "../storage/autosave";
import { ProjectAutosaveProvider } from "../storage/ProjectAutosaveProvider";
import { useIsAutosaveCorrupted } from "../storage/projectAutosaveContext";
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
import { createProjectStore } from "./store";
import type { RouteExtensionEndpoint } from "./components/routeAuthoringActions";
import { LayerPreviewProvider } from "./LayerPreviewProvider";
import { useSetLayerPreviewId } from "./layerPreviewContext";

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
      <ProjectAutosaveProvider
        loadError={autosaveLoadError}
        projectStore={projectStore}
        repository={autosaveRepository}
      >
        <LayerPreviewProvider>
          <StudioApp
            directionsProvider={directionsProvider}
            mapMatchingProvider={mapMatchingProvider}
            searchProvider={searchProvider}
          />
        </LayerPreviewProvider>
      </ProjectAutosaveProvider>
    </ProjectStoreContext>
  );
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

type StudioAppProps = Omit<
  AppProps,
  "autosaveLoadError" | "autosaveRepository" | "initialDocument"
>;

function useRouteExtensionRequest() {
  const [request, setRequest] = useState<{
    endpoint: RouteExtensionEndpoint;
    layer: ContentLayer;
    request: number;
    trigger: HTMLButtonElement;
  } | null>(null);
  const begin = useCallback(
    (
      layer: ContentLayer,
      endpoint: RouteExtensionEndpoint,
      trigger: HTMLButtonElement,
    ) => {
      setRequest((current) => ({
        endpoint,
        layer,
        request: (current?.request ?? 0) + 1,
        trigger,
      }));
    },
    [],
  );
  return { begin, request };
}

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
  const changeWaypoint = editing.changeWaypoint;
  const removeWaypoint = editing.removeWaypoint;
  const setRouteVertex = project.setRouteVertex;
  const removeRouteVertexAction = project.removeRouteVertex;
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
      if (!changeWaypoint(id, vertexIndex, coordinate)) {
        setRouteVertex(id, vertexIndex, coordinate);
      }
    },
    [changeWaypoint, setRouteVertex],
  );
  const removeRouteVertex = useCallback(
    (id: string, vertexIndex: number) => {
      if (!removeWaypoint(id, vertexIndex))
        removeRouteVertexAction(id, vertexIndex);
    },
    [removeRouteVertexAction, removeWaypoint],
  );
  return { changeRouteVertex, editing, mapLayers, removeRouteVertex };
}

function useStudioAppModel(props: StudioAppProps) {
  const {
    directionsProvider,
    mapMatchingProvider,
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
  const isAutosaveCorrupted = useIsAutosaveCorrupted();
  const setPreviewedLayerId = useSetLayerPreviewId();
  const [exportOpen, setExportOpen] = useState(false);
  const openExport = useCallback(() => setExportOpen(true), []);
  const [authoringState, setAuthoringState] = useState({
    documentEpoch: 0,
    active: false,
  });
  const routeExtension = useRouteExtensionRequest();
  const mapExporter = useMapExporter();
  const mapLocation = useMapLocationCommand(documentEpoch);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const mobile = useMobilePanels();
  const handleMapDataImported = useCallback(
    () => setPreviewedLayerId(null),
    [setPreviewedLayerId],
  );
  const mapDataImport = useAppMapDataImport(
    project.importLayers,
    project.replaceLayerFromImport,
    isAutosaveCorrupted,
    handleMapDataImported,
  );
  const modal = useModalSurfaces({
    exportButtonRef,
    exportOpen,
    importOpen: mapDataImport.isImportOpen,
    mobile,
    setExportOpen,
  });
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
    [openDocument, setPreviewedLayerId],
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
    isModalOpen: modal.surface !== null || isAutosaveCorrupted,
    layers,
    selectedLayer,
    setPreviewedLayerId,
  });
  return {
    assets, isAutosaveCorrupted, beginRouteExtend: routeExtension.begin, clearSelection, deleteSelectedLayer, directionsProvider,
    directionsRouteEditing: directions.editing, documentEpoch,
    exportButtonRef, handleAuthoringChange, handleDeleteKeyDown, handleOpenedDocument,
    importButtonRef, isAuthoring, layers, mapDataImport, mapExporter,
    mapLayers: directions.mapLayers, mapLocation, mapMatchingProvider,
    mobile, modal, openButtonRef, openExport, page, pageBoundaryVisible, project,
    routeExtensionRequest: routeExtension.request, searchProvider, selectedId, selectedLayer,
    setPreviewedLayerId, style,
    changeRouteVertex: directions.changeRouteVertex,
    removeRouteVertex: directions.removeRouteVertex,
  };
}

export type StudioAppModel = ReturnType<typeof useStudioAppModel>;

function StudioApp(props: StudioAppProps) {
  return <StudioAppView model={useStudioAppModel(props)} />;
}
