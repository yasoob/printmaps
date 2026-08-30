import { memo, useCallback, useRef, useState } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import {
  createInitialProjectDocument,
  type ContentLayer,
  type ProjectDocument,
} from '../domain/project';
import type { PreviewPngExporter } from '../export/previewPng';
import type { DirectionsProvider, MapMatchingProvider, SearchProvider } from '../services/mapbox/contracts';
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
import { useModalSurfaces } from './hooks/useModalSurfaces';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { useMapLocationCommand } from './hooks/useMapLocationCommand';
import { useMobilePanels } from './hooks/useMobilePanels';
import { ProjectStoreContext, useProject, useProjectActions } from './projectStoreContext';
import { createProjectStore, type ProjectState } from './store';

type AppProps = {
  autosaveRepository?: AutosaveRepository | null;
  autosaveLoadError?: unknown | null;
  directionsProvider?: DirectionsProvider;
  initialDocument?: ProjectDocument;
  mapMatchingProvider?: MapMatchingProvider;
  searchProvider?: SearchProvider;
};

const defaultSearchProvider = createMapboxSearchProvider({
  token: import.meta.env.VITE_MAPBOX_PUBLIC_ACCESS,
});

function resolveInitialDocument(initialDocument: ProjectDocument | undefined) {
  if (initialDocument) return initialDocument;
  if (import.meta.env.MODE === 'test') return createInitialProjectDocument();
  throw new Error('App requires an initial project document.');
}

function optionalMapMatchingProvider(provider: MapMatchingProvider | undefined) {
  return provider ? { mapMatchingProvider: provider } : {};
}

function visiblePreviewLayerId(layers: readonly ContentLayer[], previewedLayerId: string | null) {
  if (previewedLayerId === null) return null;
  const layer = layers.find(({ id }) => id === previewedLayerId);
  return layer?.visible && layer.geometry ? previewedLayerId : null;
}

type CanvasWorkspaceProps = React.ComponentProps<typeof CanvasWorkspace>;

/**
 * Subscribes to the camera on the workspace's behalf. Panning writes centre and
 * zoom at pointer rate, so keeping that subscription below the editor shell
 * confines those renders to the map instead of the whole studio.
 */
const CanvasWorkspaceWithCamera = memo(function CanvasWorkspaceWithCamera(
  props: Omit<CanvasWorkspaceProps, 'camera'>,
) {
  const camera = useProject((state) => state.document.camera);
  return <CanvasWorkspace {...props} camera={camera} />;
});

export function App({
  autosaveLoadError = null,
  autosaveRepository,
  directionsProvider,
  initialDocument,
  mapMatchingProvider,
  searchProvider,
}: AppProps = {}) {
  const [projectStore] = useState(() => createProjectStore(resolveInitialDocument(initialDocument)));
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
  const [resolved] = useState(() => (
    autosaveRepository === undefined
      ? (typeof indexedDB === 'undefined' ? null : createIndexedDbAutosaveRepository())
      : autosaveRepository
  ));
  return useProjectAutosave(projectStore, resolved, autosaveLoadError);
}

function useMapExporter() {
  const [exporter, setExporter] = useState<{ run: PreviewPngExporter } | null>(null);
  const onExporterChange = useCallback((next: PreviewPngExporter | null) => {
    setExporter(next ? { run: next } : null);
  }, []);
  return { run: exporter?.run ?? null, onExporterChange };
}

type StudioAppProps = AppProps & { projectStore: StoreApi<ProjectState> };

function StudioApp(props: StudioAppProps) {
  const { autosaveLoadError = null, autosaveRepository, directionsProvider, mapMatchingProvider, projectStore, searchProvider } = props;
  const project = useProjectActions();
  const layers = useProject((state) => state.document.layers);
  const assets = useProject((state) => state.document.assets);
  const page = useProject((state) => state.document.page);
  const style = useProject((state) => state.document.style);
  const selectedId = useProject((state) => state.selectedId);
  const documentEpoch = useProject((state) => state.documentEpoch);
  const autosave = useResolvedAutosave(projectStore, autosaveRepository, autosaveLoadError);
  const [previewedLayerId, setPreviewedLayerId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false); const openExport = useCallback(() => setExportOpen(true), []);
  const [authoringState, setAuthoringState] = useState({ documentEpoch: 0, active: false });
  const mapExporter = useMapExporter();
  const mapLocation = useMapLocationCommand(documentEpoch);
  const draggedLayerIdRef = useRef<string | null>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null); const openButtonRef = useRef<HTMLButtonElement>(null);
  const mobile = useMobilePanels();
  const handleMapDataImported = useCallback(() => setPreviewedLayerId(null), []);
  const mapDataImport = useAppMapDataImport(project.importLayers, project.replaceLayerFromImport, autosave.corrupted, handleMapDataImported);
  const modal = useModalSurfaces({
    exportButtonRef,
    exportOpen,
    importOpen: mapDataImport.isImportOpen,
    mobile,
    setExportOpen,
  });
  const mapPreviewedLayerId = visiblePreviewLayerId(layers, previewedLayerId);
  const selectedLayer = layers.find((layer) => layer.id === selectedId) ?? null;
  const isAuthoring = authoringState.documentEpoch === documentEpoch && authoringState.active;
  const selectLayer = project.selectLayer; const openDocument = project.openDocument;
  const clearSelection = useCallback(() => selectLayer(null), [selectLayer]);
  const handleOpenedDocument = useCallback((document: ProjectDocument) => {
    openDocument(document);
    setPreviewedLayerId(null);
  }, [openDocument]);
  const handleAuthoringChange = useCallback((nextDocumentEpoch: number, isActive: boolean) => {
    setAuthoringState({ documentEpoch: nextDocumentEpoch, active: isActive });
  }, []);
  const { deleteSelectedLayer, handleDeleteKeyDown } = useEditorShortcuts({
    deleteFocusTarget: () => modal.mobilePanel === 'properties' ? mobile.propertiesPanelRef.current?.querySelector<HTMLElement>('[data-project-heading]') ?? null : null,
    isAuthoring,
    isModalOpen: modal.surface !== null || autosave.corrupted,
    layers,
    selectedLayer,
    setPreviewedLayerId,
  });
  return (
    <>
      <main className="studio-shell" inert={autosave.corrupted || ['export', 'import'].includes(modal.surface ?? '')} onKeyDown={handleDeleteKeyDown}>
        <StudioHeader
          projectTitleRef={mobile.projectTitleRef}
          exportButtonRef={exportButtonRef} importButtonRef={importButtonRef} openButtonRef={openButtonRef}
          finishImportWork={mapDataImport.finishImportWork} isImportWorkActive={mapDataImport.isImportWorkActive}
          startImportWork={mapDataImport.startImportWork} exportDisabled={isAuthoring}
          importDisabled={autosave.corrupted || (modal.surface !== null && modal.surface !== 'import')}
          importOpen={modal.surface === 'import'} replacementRequest={mapDataImport.replacementRequest}
          inert={modal.mobilePanel !== null} onOpen={handleOpenedDocument}
          onImport={mapDataImport.handleImportedLayers} onImportOpenChange={mapDataImport.setIsImportOpen}
          onExport={openExport}
        />
        <LayersSidebar
          layers={layers} activePanel={modal.mobilePanel}
          draggedLayerIdRef={draggedLayerIdRef} setPreviewedLayerId={setPreviewedLayerId}
          closePanel={mobile.closePanel} panelRef={mobile.layersPanelRef}
          onKeyDown={mobile.handlePanelKeyDown} autosave={autosave}
        />
        <CanvasWorkspaceWithCamera
          layers={layers} assets={assets}
          selectedId={selectedId} previewedId={mapPreviewedLayerId}
          page={page}
          stylePreset={style.preset}
          language={style.language}
          textScalePercent={style.textScalePercent}
          featureVisibility={style.visibility}
          documentEpoch={documentEpoch}
          importFitRequest={mapDataImport.importFitRequest}
          locationRequest={mapLocation.request}
          activePanel={modal.mobilePanel}
          layersTriggerRef={mobile.layersTriggerRef}
          propertiesTriggerRef={mobile.propertiesTriggerRef}
          onLayerSelect={project.selectLayer} onCameraViewportChange={project.setCameraViewport} onPoiCoordinatesChange={project.setPoiCoordinates} onRouteGeometryChange={project.replaceRouteGeometry}
          onLocate={mapLocation.locate}
          onShapeGeometryChange={project.setShapeGeometry}
          directionsProvider={directionsProvider} searchProvider={searchProvider ?? defaultSearchProvider}
          onCreateDirectionsRoute={project.createDirectionsRoute}
          onCreateAdministrativeArea={project.createAdministrativeArea}
          onCreateIsochroneArea={project.createIsochroneArea}
          onCreatePoi={project.createPoi} onCreatePoiBatch={project.createPoiBatch} onCreateSearchPoi={project.createSearchPoi}
          onCreateRoute={project.createRoute}
          onCreateShape={project.createShape}
          onAuthoringChange={handleAuthoringChange}
          onBackgroundClick={clearSelection}
          onExporterChange={mapExporter.onExporterChange}
          openPanel={mobile.openPanel}
        />
        {modal.mobilePanel && <button className="mobile-panel-backdrop" type="button" aria-label="Close open panel" onClick={() => mobile.closePanel()} />}
        <PropertiesSidebar
          selectedLayer={selectedLayer}
          {...optionalMapMatchingProvider(mapMatchingProvider)}

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
      {modal.surface === 'export' && <ExportDialogSurface exporter={mapExporter.run} onClose={modal.closeExport} />}
      <ProjectAutosaveDialogs
        autosave={autosave}
        fallbackFocusRef={openButtonRef}
      />
    </>
  );
}

function ExportDialogSurface({ exporter, onClose }: { exporter: PreviewPngExporter | null; onClose: () => void }) {
  const document = useProject((state) => state.document);
  return <ExportDialog exporter={exporter} filename={document.id} document={document} onClose={onClose} />;
}
