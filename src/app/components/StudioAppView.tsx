import { memo } from "react";
import { createMapboxSearchProvider } from "../../services/mapbox/search";
import {
  ProjectAutosaveDialogs,
  ProjectAutosaveErrorNotice,
} from "../../storage/ProjectAutosaveUi";
import type { PreviewPngExporter } from "../../export/previewPng";
import { useProject } from "../projectStoreContext";
import type { StudioAppModel } from "../App";
import { CanvasWorkspace } from "./CanvasWorkspace";
import type { CanvasWorkspaceProps } from "./CanvasWorkspace.types";
import { ExportDialog } from "./ExportDialog";
import { LayersSidebar } from "./LayersSidebar";
import { PropertiesSidebar } from "./PropertiesSidebar";
import { StudioHeader } from "./StudioHeader";

const defaultSearchProvider = createMapboxSearchProvider({
  token: import.meta.env.VITE_MAPBOX_PUBLIC_ACCESS,
});

const CanvasWorkspaceWithCamera = memo(function CanvasWorkspaceWithCamera(
  props: Omit<CanvasWorkspaceProps, "camera">,
) {
  const camera = useProject((state) => state.document.camera);
  return <CanvasWorkspace {...props} camera={camera} />;
});

function StudioCanvas({ m }: { m: StudioAppModel }) {
  return (
    <CanvasWorkspaceWithCamera
      layers={m.mapLayers}
      assets={m.assets}
      selectedId={m.selectedId}
      previewedId={m.mapPreviewedLayerId}
      page={m.page}
      stylePreset={m.style.preset}
      language={m.style.language}
      textScalePercent={m.style.textScalePercent}
      featureVisibility={m.style.visibility}
      documentEpoch={m.documentEpoch}
      importFitRequest={m.mapDataImport.importFitRequest}
      locationRequest={m.mapLocation.request}
      activePanel={m.modal.mobilePanel}
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
      selectedLayer={m.selectedLayer}
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
      onBeginRouteExtend={(layer, endpoint, trigger) =>
        m.setRouteExtensionRequest((current) => ({
          endpoint,
          layer,
          request: (current?.request ?? 0) + 1,
          trigger,
        }))
      }
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

export function StudioAppView({ model: m }: { model: StudioAppModel }) {
  const isImportOrExport = ["export", "import"].includes(m.modal.surface ?? "");
  return (
    <>
      <main className="studio-shell" inert={m.autosave.corrupted || isImportOrExport} onKeyDown={m.handleDeleteKeyDown}>
        <StudioHeader
          projectTitleRef={m.mobile.projectTitleRef}
          exportButtonRef={m.exportButtonRef}
          importButtonRef={m.importButtonRef}
          openButtonRef={m.openButtonRef}
          finishImportWork={m.mapDataImport.finishImportWork}
          isImportWorkActive={m.mapDataImport.isImportWorkActive}
          startImportWork={m.mapDataImport.startImportWork}
          exportDisabled={m.isAuthoring}
          importDisabled={m.autosave.corrupted || (m.modal.surface !== null && m.modal.surface !== "import")}
          importOpen={m.modal.surface === "import"}
          replacementRequest={m.mapDataImport.replacementRequest}
          inert={m.modal.mobilePanel !== null}
          onOpen={m.handleOpenedDocument}
          onImport={m.mapDataImport.handleImportedLayers}
          onImportOpenChange={m.mapDataImport.setIsImportOpen}
          onExport={m.openExport}
        />
        <LayersSidebar layers={m.layers} activePanel={m.modal.mobilePanel} draggedLayerIdRef={m.draggedLayerIdRef} setPreviewedLayerId={m.setPreviewedLayerId} closePanel={m.mobile.closePanel} panelRef={m.mobile.layersPanelRef} onKeyDown={m.mobile.handlePanelKeyDown} autosave={m.autosave} />
        <StudioCanvas m={m} />
        {m.modal.mobilePanel && <button className="mobile-panel-backdrop" type="button" aria-label="Close open panel" onClick={() => m.mobile.closePanel()} />}
        <StudioProperties m={m} />
      </main>
      <ProjectAutosaveErrorNotice autosave={m.autosave} />
      {m.modal.surface === "export" && <ExportDialogSurface exporter={m.mapExporter.run} onClose={m.modal.closeExport} />}
      <ProjectAutosaveDialogs autosave={m.autosave} fallbackFocusRef={m.openButtonRef} />
    </>
  );
}

function ExportDialogSurface({ exporter, onClose }: { exporter: PreviewPngExporter | null; onClose: () => void }) {
  const document = useProject((state) => state.document);
  return <ExportDialog exporter={exporter} filename={document.id} document={document} onClose={onClose} />;
}
