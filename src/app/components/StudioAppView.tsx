import { memo, useCallback, useState } from "react";
import { createMapboxSearchProvider } from "../../services/mapbox/search";
import {
  ProjectAutosaveDialogs,
  ProjectAutosaveErrorNotice,
  ProjectAutosaveOfflineNotice,
} from "../../storage/ProjectAutosaveUi";
import { AutosaveConflictDialog } from "../../storage/AutosaveConflictDialog";
import {
  useAutosaveCorruptionState,
  useAutosaveErrorState,
} from "../../storage/projectAutosaveContext";
import type { PreviewPngExporter } from "../../export/previewPng";
import { useProject, useProjectStoreApi } from "../projectStoreContext";
import type { StudioAppModel } from "../App";
import { CanvasWorkspace } from "./CanvasWorkspace";
import type { CanvasWorkspaceProps } from "./CanvasWorkspace.types";
import { ExportDialog } from "./ExportDialog";
import { LayersSidebar } from "./LayersSidebar";
import { PropertiesSidebar } from "./PropertiesSidebar";
import { StudioHeader } from "./StudioHeader";
import { ProjectRenameDialog } from "./ProjectRenameDialog";
import { ProjectReplacementDialog } from "./ProjectReplacementDialog";

const defaultSearchProvider = createMapboxSearchProvider({
  token: import.meta.env.VITE_MAPBOX_PUBLIC_ACCESS,
});
const autosaveNotice = <ProjectAutosaveOfflineNotice />;

const CanvasWorkspaceWithCamera = memo(function CanvasWorkspaceWithCamera(
  props: Omit<CanvasWorkspaceProps, "camera">,
) {
  const camera = useProject((state) => state.document.camera);
  const store = useProjectStoreApi();
  const getCanonicalCamera = useCallback(() => store.getState().document.camera, [store]);
  return <CanvasWorkspace {...props} camera={camera} getCanonicalCamera={getCanonicalCamera} />;
});

function StudioCanvas({ m }: { m: StudioAppModel }) {
  return (
    <CanvasWorkspaceWithCamera
      statusNotice={autosaveNotice}
      layers={m.mapLayers}
      assets={m.assets}
      selectedId={m.selectedId}
      page={m.page}
      pageBoundaryVisible={m.pageBoundaryVisible}
      stylePreset={m.style.preset}
      styleCustomization={m.style.customization}
      language={m.style.language}
      textScalePercent={m.style.textScalePercent}
      featureVisibility={m.style.visibility}
      documentEpoch={m.documentEpoch}
      importFitRequest={m.mapDataImport.importFitRequest}
      locationRequest={m.mapLocation.request}
      activePanel={m.modal.mobilePanel}
      isModalOpen={m.modal.surface !== null || m.isAutosaveCorrupted}
      isMobileViewport={m.mobile.isMobileViewport}
      layersTriggerRef={m.mobile.layersTriggerRef}
      propertiesTriggerRef={m.mobile.propertiesTriggerRef}
      onLayerSelect={m.project.selectLayer}
      onCameraViewportChange={m.project.setCameraViewport}
      onPoiCoordinatesChange={m.project.setPoiCoordinates}
      onRouteGeometryChange={m.project.replaceRouteGeometry}
      onRouteVertexChange={m.changeRouteVertex}
      onRouteVertexInsert={m.project.insertRouteVertex}
      onLocate={m.mapLocation.locate}
      onShapeGeometryChange={m.project.setShapeGeometry}
      {...(m.directionsProvider ? { directionsProvider: m.directionsProvider } : {})}
      searchProvider={m.searchProvider ?? defaultSearchProvider}
      onCreateDirectionsRoute={m.project.createDirectionsRoute}
      onReplaceDirectionsRoute={m.project.replaceDirectionsRoute}
      onCreateAdministrativeArea={m.project.createAdministrativeArea}
      onCreateIsochroneArea={m.project.createIsochroneArea}
      onCreatePoi={m.project.createPoi}
      onCreatePoiBatch={m.project.createPoiBatch}
      onCreateSearchPoi={m.project.createSearchPoi}
      onCreateRoute={m.project.createRoute}
      onReplaceAuthoredRoute={m.project.replaceAuthoredRoute}
      onReplaceRouteDraft={m.project.replaceRouteDraft}
      routeExtensionRequest={m.routeExtensionRequest}
      onCreateShape={m.project.createShape}
      onAuthoringChange={m.handleAuthoringChange}
      onUnfinishedDrawingChange={m.project.setHasUnfinishedDrawing}
      onBackgroundClick={m.clearSelection}
      onExporterChange={m.mapExporter.onExporterChange}
      openPanel={m.mobile.openPanel}
    />
  );
}

function StudioProperties({ m }: { m: StudioAppModel }) {
  const isSelectedDirectionsEdit =
    m.directionsRouteEditing.statusLayerId === m.selectedLayer?.id;
  const pendingWaypoints = isSelectedDirectionsEdit
    ? m.directionsRouteEditing.pendingWaypoints
    : null;
  return (
    <PropertiesSidebar
      selectedLayerId={m.selectedLayer?.id ?? null}
      directionsRouteEditError={
        isSelectedDirectionsEdit ? m.directionsRouteEditing.error : null
      }
      directionsRouteEditIsRouting={
        isSelectedDirectionsEdit && m.directionsRouteEditing.isRouting
      }
      directionsRouteEditWaypoints={pendingWaypoints}
      directionsProvider={m.directionsProvider}
      mapMatchingProvider={m.mapMatchingProvider}
      activePanel={m.modal.mobilePanel}
      panelRef={m.mobile.propertiesPanelRef}
      setPreviewedLayerId={m.setPreviewedLayerId}
      closePanel={m.mobile.closePanel}
      onDeleteSelected={m.deleteSelectedLayer}
      onKeyDown={m.mobile.handlePanelKeyDown}
      onLocate={m.mapLocation.locate}
      onReplaceLayerData={m.mapDataImport.requestLayerReplacement}
      onBeginRouteExtend={m.beginRouteExtend}
      onRouteVertexChange={m.changeRouteVertex}
      onRouteVertexRemove={m.removeRouteVertex}
      onRetryDirectionsRouteEdit={
        isSelectedDirectionsEdit ? m.directionsRouteEditing.retry : undefined
      }
      onCancelDirectionsRouteEdit={
        isSelectedDirectionsEdit ? m.directionsRouteEditing.cancel : undefined
      }
    />
  );
}

function StudioLayers({ m, desktopCollapsed, onToggleCollapsed }: {
  m: StudioAppModel;
  desktopCollapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return <LayersSidebar layers={m.layers} activePanel={m.modal.mobilePanel} desktopCollapsed={desktopCollapsed} onToggleCollapsed={onToggleCollapsed} setPreviewedLayerId={m.setPreviewedLayerId} closePanel={m.mobile.closePanel} openPanel={m.mobile.openPanel} panelRef={m.mobile.layersPanelRef} onKeyDown={m.mobile.handlePanelKeyDown} />;
}

const ProjectAutosaveSurfaces = memo(function ProjectAutosaveSurfaces({ fallbackFocusRef }: {
  fallbackFocusRef: StudioAppModel["openButtonRef"];
}) {
  const errorState = useAutosaveErrorState();
  const corruptionState = useAutosaveCorruptionState();
  return (
    <>
      {errorState && <ProjectAutosaveErrorNotice autosave={errorState} />}
      {corruptionState && (
        <ProjectAutosaveDialogs
          autosave={corruptionState}
          fallbackFocusRef={fallbackFocusRef}
        />
      )}
    </>
  );
});

export function StudioAppView({ model: m }: { model: StudioAppModel }) {
  const [layersCollapsed, setLayersCollapsed] = useState(false);
  const toggleLayersCollapsed = useCallback(() => {
    setLayersCollapsed((collapsed) => !collapsed);
  }, []);
  return (
    <>
      <main className={`studio-shell${layersCollapsed ? " is-layers-collapsed" : ""}`} onKeyDown={m.handleDeleteKeyDown}>
        <StudioHeader
          projectTitleRef={m.mobile.projectTitleRef}
          exportButtonRef={m.exportButtonRef}
          importButtonRef={m.importButtonRef}
          importInputRef={m.mapDataImport.inputRef}
          openButtonRef={m.openButtonRef}
          finishImportWork={m.mapDataImport.finishImportWork}
          isImportWorkActive={m.mapDataImport.isImportWorkActive}
          startImportWork={m.mapDataImport.startImportWork}
          exportDisabled={m.isAuthoring}
          importDisabled={m.isAutosaveCorrupted || (m.modal.surface !== null && m.modal.surface !== "import")}
          importOpen={m.modal.surface === "import"}
          replacementRequest={m.mapDataImport.replacementRequest}
          inert={m.modal.mobilePanel !== null}
          isMobileViewport={m.mobile.isMobileViewport}
          onOpen={m.handleOpenedDocument}
          onImport={m.mapDataImport.handleImportedLayers}
          onImportOpenChange={m.mapDataImport.setIsImportOpen}
          onExport={m.openExport}
          onRenameProject={m.modal.openRename}
        />
        <StudioLayers m={m} desktopCollapsed={layersCollapsed} onToggleCollapsed={toggleLayersCollapsed} />
        <StudioCanvas m={m} />
        {m.modal.mobilePanel && <button className="mobile-panel-backdrop" data-panel={m.modal.mobilePanel} type="button" aria-label="Close open panel" onClick={() => m.mobile.closePanel()} />}
        <StudioProperties m={m} />
      </main>
      {m.modal.surface === "export" && <ExportDialogSurface exporter={m.mapExporter.run} onClose={m.modal.closeExport} />}
      {m.modal.surface === "rename" && <ProjectRenameDialog onClose={m.modal.closeRename} returnFocusRef={m.openButtonRef} />}
      {m.modal.surface === "project-open" && m.projectOpening.pendingDocument && (
        <ProjectReplacementDialog
          key={m.projectOpening.pendingRequestId}
          title={m.projectOpening.pendingDocument.title}
          intent={m.projectOpening.pendingIntent}
          onKeepEditing={m.projectOpening.keepEditing}
          onDiscardAndOpen={m.projectOpening.discardAndOpen}
          returnFocusRef={m.openButtonRef}
        />
      )}
      {m.modal.surface === "autosave-conflict" && <AutosaveConflictDialog returnFocusRef={m.openButtonRef} />}
      <ProjectAutosaveSurfaces fallbackFocusRef={m.openButtonRef} />
    </>
  );
}

function ExportDialogSurface({ exporter, onClose }: { exporter: PreviewPngExporter | null; onClose: () => void }) {
  const document = useProject((state) => state.document);
  return <ExportDialog exporter={exporter} filename={document.id} document={document} onClose={onClose} />;
}
