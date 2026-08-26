import { useCallback, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { ContentLayer, ProjectDocument } from '../domain/project';
import type { PreviewPngExporter } from '../export/previewPng';
import type { DirectionsProvider, SearchProvider } from '../services/mapbox/contracts';
import { createMapboxSearchProvider } from '../services/mapbox/search';
import { createIndexedDbAutosaveRepository, type AutosaveRepository } from '../storage/autosave';
import {
  ProjectAutosaveDialogs,
  ProjectAutosaveErrorNotice,
} from '../storage/ProjectAutosaveUi';
import { useProjectAutosave } from '../storage/useProjectAutosave';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { ExportDialog } from './components/ExportDialog';
import { LayersSidebar } from './components/LayersSidebar';
import { PropertiesSidebar } from './components/PropertiesSidebar';
import { StudioHeader } from './components/StudioHeader';
import { useAppMapDataImport } from './hooks/useAppMapDataImport';
import { useAutosaveModalArbitration } from './hooks/useAutosaveModalArbitration';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { useMapLocationCommand } from './hooks/useMapLocationCommand';
import { useMobilePanels } from './hooks/useMobilePanels';
import { createProjectStore } from './store';

type AppProps = {
  autosaveRepository?: AutosaveRepository | null;
  directionsProvider?: DirectionsProvider;
  searchProvider?: SearchProvider;
};

const defaultSearchProvider = createMapboxSearchProvider({
  token: import.meta.env.VITE_MAPBOX_PUBLIC_ACCESS,
});

function visiblePreviewLayerId(layers: readonly ContentLayer[], previewedLayerId: string | null) {
  if (previewedLayerId === null) return null;
  const layer = layers.find(({ id }) => id === previewedLayerId);
  return layer?.visible && layer.geometry ? previewedLayerId : null;
}

export function App({ autosaveRepository, directionsProvider, searchProvider }: AppProps = {}) {
  const [projectStore] = useState(() => createProjectStore());
  const [resolvedAutosaveRepository] = useState(() => (
    autosaveRepository === undefined
      ? (typeof indexedDB === 'undefined' ? null : createIndexedDbAutosaveRepository())
      : autosaveRepository
  ));
  const project = useStore(projectStore);
  const autosave = useProjectAutosave(projectStore, resolvedAutosaveRepository);
  const [previewedLayerId, setPreviewedLayerId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false); const openExport = useCallback(() => setExportOpen(true), []);
  const [authoringState, setAuthoringState] = useState({ documentEpoch: 0, active: false });
  const [mapExporter, setMapExporter] = useState<{ run: PreviewPngExporter } | null>(null);
  const mapLocation = useMapLocationCommand(project.documentEpoch);
  const draggedLayerIdRef = useRef<string | null>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null); const openButtonRef = useRef<HTMLButtonElement>(null);
  const mobile = useMobilePanels();
  const handleMapDataImported = useCallback(() => setPreviewedLayerId(null), []);
  const mapDataImport = useAppMapDataImport(project.importLayers, project.replaceLayerFromImport, autosave.recoveryDraft !== null || autosave.corrupted, handleMapDataImported);
  const modal = useAutosaveModalArbitration({ autosave, exportButtonRef, exportOpen, importButtonRef, importOpen: mapDataImport.isImportOpen, mobile, setExportOpen, setImportOpen: mapDataImport.setIsImportOpen });
  const layers = project.document.layers; const mapPreviewedLayerId = visiblePreviewLayerId(layers, previewedLayerId);
  const selectedLayer = layers.find((layer) => layer.id === project.selectedId) ?? null;
  const isAuthoring = authoringState.documentEpoch === project.documentEpoch && authoringState.active;
  const selectLayer = project.selectLayer; const openDocument = project.openDocument;
  const clearSelection = useCallback(() => selectLayer(null), [selectLayer]);
  const handleExporterChange = useCallback((exporter: PreviewPngExporter | null) => {
    setMapExporter(exporter ? { run: exporter } : null);
  }, []);
  const handleOpenedDocument = useCallback((document: ProjectDocument) => {
    openDocument(document);
    setPreviewedLayerId(null);
  }, [openDocument]);
  const handleAuthoringChange = useCallback((documentEpoch: number, isActive: boolean) => {
    setAuthoringState({ documentEpoch, active: isActive });
  }, []);
  const { deleteSelectedLayer, handleDeleteKeyDown } = useEditorShortcuts({
    deleteFocusTarget: () => modal.mobilePanel === 'properties' ? mobile.propertiesPanelRef.current?.querySelector<HTMLElement>('[data-project-heading]') ?? null : null,
    isAuthoring,
    isModalOpen: modal.surface !== null,
    layers,
    project,
    selectedLayer,
    setPreviewedLayerId,
  });
  return (
    <>
      <main className="studio-shell" inert={['export', 'autosave', 'import'].includes(modal.surface ?? '')} onKeyDown={handleDeleteKeyDown}>
        <StudioHeader
          project={project} projectTitleRef={mobile.projectTitleRef}
          exportButtonRef={exportButtonRef} importButtonRef={importButtonRef} openButtonRef={openButtonRef}
          finishImportWork={mapDataImport.finishImportWork} isImportWorkActive={mapDataImport.isImportWorkActive}
          startImportWork={mapDataImport.startImportWork} exportDisabled={isAuthoring}
          importDisabled={modal.surface !== null && modal.surface !== 'import'}
          importOpen={modal.surface === 'import'} replacementRequest={mapDataImport.replacementRequest}
          inert={modal.mobilePanel !== null} onOpen={handleOpenedDocument}
          onImport={mapDataImport.handleImportedLayers} onImportOpenChange={mapDataImport.setIsImportOpen}
          onExport={openExport}
        />
        <LayersSidebar
          layers={layers} project={project} activePanel={modal.mobilePanel}
          draggedLayerIdRef={draggedLayerIdRef} setPreviewedLayerId={setPreviewedLayerId}
          closePanel={mobile.closePanel} panelRef={mobile.layersPanelRef}
          onKeyDown={mobile.handlePanelKeyDown} autosave={autosave}
        />
        <CanvasWorkspace
          layers={layers} assets={project.document.assets}
          selectedId={project.selectedId} previewedId={mapPreviewedLayerId}
          page={project.document.page}
          camera={project.document.camera}
          stylePreset={project.document.style.preset}
          language={project.document.style.language}
          textScalePercent={project.document.style.textScalePercent}
          featureVisibility={project.document.style.visibility}
          documentEpoch={project.documentEpoch}
          importFitRequest={mapDataImport.importFitRequest}
          locationRequest={mapLocation.request}
          activePanel={modal.mobilePanel}
          layersTriggerRef={mobile.layersTriggerRef}
          propertiesTriggerRef={mobile.propertiesTriggerRef}
          onLayerSelect={project.selectLayer} onCameraViewportChange={project.setCameraViewport} onRouteGeometryChange={project.replaceRouteGeometry}
          onLocate={mapLocation.locate}
          onShapeGeometryChange={project.setShapeGeometry}
          directionsProvider={directionsProvider} searchProvider={searchProvider ?? defaultSearchProvider}
          onCreateDirectionsRoute={project.createDirectionsRoute}
          onCreateAdministrativeArea={project.createAdministrativeArea}
          onCreateAdministrativeAreas={project.createAdministrativeAreas} onCreateIsochroneArea={project.createIsochroneArea}
          onCreatePoi={project.createPoi} onCreatePoiBatch={project.createPoiBatch} onCreateSearchPoi={project.createSearchPoi}
          onCreateRoute={project.createRoute}
          onCreateShape={project.createShape}
          onAuthoringChange={handleAuthoringChange}
          onBackgroundClick={clearSelection}
          onExporterChange={handleExporterChange}
          openPanel={mobile.openPanel}
        />
        {modal.mobilePanel && <button className="mobile-panel-backdrop" type="button" aria-label="Close open panel" onClick={() => mobile.closePanel()} />}
        <PropertiesSidebar
          project={project}
          selectedLayer={selectedLayer}

          activePanel={modal.mobilePanel}
          panelRef={mobile.propertiesPanelRef}
          setPreviewedLayerId={setPreviewedLayerId}
          closePanel={mobile.closePanel}
          onDeleteSelected={deleteSelectedLayer}
          onKeyDown={mobile.handlePanelKeyDown}
          onLocate={mapLocation.locate} onReplaceLayerData={mapDataImport.requestLayerReplacement}
        />
      </main>
      <ProjectAutosaveErrorNotice autosave={autosave} />
      {modal.surface === 'export' && <ExportDialog exporter={mapExporter?.run ?? null} filename={project.document.id} document={project.document} onClose={modal.closeExport} />}
      <ProjectAutosaveDialogs
        autosave={autosave}
        onBeforeDecision={modal.preemptSurface}
        returnFocusRef={modal.returnFocusRef}
        fallbackFocusRef={openButtonRef}
      />
    </>
  );
}
