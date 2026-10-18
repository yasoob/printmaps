import { useCallback, useMemo, useRef, useState } from "react";
import {
  createInitialProjectDocument,
  type ContentLayer,
  type ProjectDocument,
} from "../domain/project";
import { createMapExporterChannel, MapExporterContext, usePublishMapExporter } from "./mapExporterContext";
import type {
  DirectionsProvider,
  MapMatchingProvider,
  SearchProvider,
} from "../services/mapbox/contracts";
import {
  type AutosaveRepository,
} from "../storage/autosave";
import { ProjectAutosaveProvider } from "../storage/ProjectAutosaveProvider";
import { useIsAutosaveCorrupted, useIsAutosaveConflictOpen } from "../storage/projectAutosaveContext";
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
import { useProjectOpening } from "./hooks/useProjectOpening";
import { ElevationProfileProvider } from "./elevation/ElevationProfileProvider";
import { trackEditorAction } from "../analytics/editorAnalytics";
import { useRemixRequest } from "../sharing/useRemixRequest";
import { createTemplateProject } from "./studio/templateProjects";
import type { TemplateGalleryProps } from "./studio/TemplateGallery";
import { usePendingDraftState } from './hooks/usePendingDraftState';

type AppProps = {
  autosaveRepository?: AutosaveRepository | null;
  autosaveLoadError?: unknown | null;
  directionsProvider?: DirectionsProvider;
  initialDocument?: ProjectDocument;
  remixDocument?: ProjectDocument;
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
  remixDocument,
  mapMatchingProvider,
  searchProvider,
}: AppProps = {}) {
  const [projectStore] = useState(() =>
    createProjectStore(resolveInitialDocument(initialDocument)),
  );
  const [mapExporterChannel] = useState(createMapExporterChannel);
  return (
    <ProjectStoreContext value={projectStore}>
      <MapExporterContext value={mapExporterChannel}>
      <ProjectAutosaveProvider
        loadError={autosaveLoadError}
        projectStore={projectStore}
        repository={autosaveRepository}
      >
        <LayerPreviewProvider>
          <ElevationProfileProvider>
            <StudioApp
              remixDocument={remixDocument}
              directionsProvider={directionsProvider}
              mapMatchingProvider={mapMatchingProvider}
              searchProvider={searchProvider}
            />
          </ElevationProfileProvider>
        </LayerPreviewProvider>
      </ProjectAutosaveProvider>
      </MapExporterContext>
    </ProjectStoreContext>
  );
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
      trackEditorAction('routeExtensionStarted');
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
      return changeWaypoint(id, vertexIndex, coordinate)
        ?? setRouteVertex(id, vertexIndex, coordinate);
    },
    [changeWaypoint, setRouteVertex],
  );
  const removeRouteVertex = useCallback(
    (id: string, vertexIndex: number) => {
      return removeWaypoint(id, vertexIndex)
        ?? removeRouteVertexAction(id, vertexIndex);
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
  const autosaveConflictOpen = useIsAutosaveConflictOpen();
  const setPreviewedLayerId = useSetLayerPreviewId();
  const [exportOpen, setExportOpen] = useState(false);
  const openExport = useCallback(() => {
    trackEditorAction('exportDialogOpened');
    setExportOpen(true);
  }, []);
  const [authoringState, setAuthoringState] = useState({
    documentEpoch: 0,
    active: false,
  });
  const pendingDraft = usePendingDraftState(documentEpoch);
  const routeExtension = useRouteExtensionRequest();
  const onExporterChange = usePublishMapExporter();
  const mapLocation = useMapLocationCommand(documentEpoch);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const mobile = useMobilePanels();
  const handleMapDataImported = useCallback(
    () => setPreviewedLayerId(null),
    [setPreviewedLayerId],
  );
  const [templatesEpoch, setTemplatesEpoch] = useState<number | null>(null);
  const [layoutRequest, setLayoutRequest] = useState(0);
  const templateDocumentRef = useRef<ProjectDocument | null>(null);
  const handleProjectOpened = useCallback((document: ProjectDocument) => {
    handleMapDataImported();
    if (document === templateDocumentRef.current) setLayoutRequest((value) => value + 1);
    templateDocumentRef.current = null;
  }, [handleMapDataImported]);
  const projectOpening = useProjectOpening(documentEpoch, handleProjectOpened);
  const openTemplateGallery = useCallback(() => setTemplatesEpoch(documentEpoch), [documentEpoch]);
  const closeTemplateGallery = useCallback(() => setTemplatesEpoch(null), []);
  const openDocument = projectOpening.open;
  const createFromTemplate = useCallback<TemplateGalleryProps['onSelect']>((id, starter) => {
    const document = createTemplateProject(id, starter);
    templateDocumentRef.current = document;
    setTemplatesEpoch(null);
    openDocument(document, 'new');
  }, [openDocument]);
  useRemixRequest(props.remixDocument, isAutosaveCorrupted || autosaveConflictOpen, projectOpening.open);
  const mapDataImport = useAppMapDataImport({
    documentEpoch,
    importLayers: project.importLayers,
    replaceLayerFromImport: project.replaceLayerFromImport,
    isCommitBlocked: isAutosaveCorrupted || autosaveConflictOpen,
    onImported: handleMapDataImported,
  });
  const modal = useModalSurfaces({
    exportButtonRef,
    exportOpen,
    importOpen: mapDataImport.isImportOpen,
    projectOpen: projectOpening.pendingDocument !== null,
    templatesOpen: templatesEpoch === documentEpoch,
    autosaveConflictOpen,
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
  const clearSelection = useCallback(() => selectLayer(null), [selectLayer]);
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
    exportButtonRef, handleAuthoringChange, handleDeleteKeyDown,
    handlePendingDraftChange: pendingDraft.handlePendingDraftChange, hasPendingDraft: isAuthoring && pendingDraft.hasPendingDraft, handleOpenedDocument: projectOpening.open,
    importButtonRef, isAuthoring, layers, mapDataImport, onExporterChange,
    mapLayers: directions.mapLayers, mapLocation, mapMatchingProvider,
    mobile, modal, openButtonRef, openExport, page, pageBoundaryVisible, project, projectOpening,
    openTemplateGallery, closeTemplateGallery, createFromTemplate, layoutRequest,
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
