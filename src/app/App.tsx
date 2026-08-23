import { useCallback, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { ContentLayer, ProjectDocument } from '../domain/project';
import type { PreviewPngExporter } from '../export/previewPng';
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
import { useAutosaveModalArbitration } from './hooks/useAutosaveModalArbitration';
import { useMobilePanels } from './hooks/useMobilePanels';
import { createProjectStore } from './store';

type AppProps = {
  autosaveRepository?: AutosaveRepository | null;
};

export function App({ autosaveRepository }: AppProps = {}) {
  const [projectStore] = useState(() => createProjectStore());
  const [resolvedAutosaveRepository] = useState(() => (
    autosaveRepository === undefined
      ? (typeof indexedDB === 'undefined' ? null : createIndexedDbAutosaveRepository())
      : autosaveRepository
  ));
  const project = useStore(projectStore);
  const autosave = useProjectAutosave(projectStore, resolvedAutosaveRepository);
  const [previewedLayerId, setPreviewedLayerId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [authoringState, setAuthoringState] = useState({ documentEpoch: 0, active: false });
  const [mapExporter, setMapExporter] = useState<{ run: PreviewPngExporter } | null>(null);
  const draggedLayerIdRef = useRef<string | null>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const mobile = useMobilePanels();
  const modal = useAutosaveModalArbitration({ autosave, exportButtonRef, exportOpen, mobile, setExportOpen });
  const layers = project.document.layers;
  const mapPreviewedLayerId = previewedLayerId !== null && layers.some((layer) => (
    layer.id === previewedLayerId && layer.visible && layer.geometry
  )) ? previewedLayerId : null;
  const selectedLayer = layers.find((layer) => layer.id === project.selectedId) ?? null;
  const selectedIndex = selectedLayer ? layers.findIndex((layer) => layer.id === selectedLayer.id) : -1;
  const isAuthoring = authoringState.documentEpoch === project.documentEpoch && authoringState.active;
  const selectLayer = project.selectLayer;
  const openDocument = project.openDocument;
  const importLayers = project.importLayers;
  const clearSelection = useCallback(() => selectLayer(null), [selectLayer]);
  const handleExporterChange = useCallback((exporter: PreviewPngExporter | null) => {
    setMapExporter(exporter ? { run: exporter } : null);
  }, []);
  const handleOpenedDocument = useCallback((document: ProjectDocument) => {
    openDocument(document);
    setPreviewedLayerId(null);
  }, [openDocument]);
  const handleImportedLayers = useCallback((layers: readonly ContentLayer[], documentEpoch: number) => {
    const imported = importLayers(layers, documentEpoch);
    if (!imported) return false;
    setPreviewedLayerId(null);
    return true;
  }, [importLayers]);
  const handleAuthoringChange = useCallback((documentEpoch: number, isActive: boolean) => {
    setAuthoringState({ documentEpoch, active: isActive });
  }, []);

  return (
    <>
      <main className="studio-shell" inert={modal.surface === 'export' || modal.surface === 'autosave'}>
        <StudioHeader
          project={project}
          projectTitleRef={mobile.projectTitleRef}
          exportButtonRef={exportButtonRef}
          exportDisabled={isAuthoring}
          inert={modal.mobilePanel !== null}
          onOpen={handleOpenedDocument}
          onImport={handleImportedLayers}
          onExport={() => setExportOpen(true)}
        />
        <LayersSidebar
          layers={layers}
          project={project}
          activePanel={modal.mobilePanel}
          draggedLayerIdRef={draggedLayerIdRef}
          setPreviewedLayerId={setPreviewedLayerId}
          closePanel={mobile.closePanel}
          panelRef={mobile.layersPanelRef}
          onKeyDown={mobile.handlePanelKeyDown}
          autosave={autosave}
        />
        <CanvasWorkspace
          layers={layers}
          selectedId={project.selectedId}
          previewedId={mapPreviewedLayerId}
          page={project.document.page}
          camera={project.document.camera}
          stylePreset={project.document.style.preset}
          textScalePercent={project.document.style.textScalePercent}
          featureVisibility={project.document.style.visibility}
          documentEpoch={project.documentEpoch}
          activePanel={modal.mobilePanel}
          layersTriggerRef={mobile.layersTriggerRef}
          propertiesTriggerRef={mobile.propertiesTriggerRef}
          onLayerSelect={project.selectLayer}
          onCreatePoi={project.createPoi}
          onCreatePoiBatch={project.createPoiBatch}
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
          selectedIndex={selectedIndex}
          activePanel={modal.mobilePanel}
          panelRef={mobile.propertiesPanelRef}
          setPreviewedLayerId={setPreviewedLayerId}
          closePanel={mobile.closePanel}
          onKeyDown={mobile.handlePanelKeyDown}
        />
      </main>
      <ProjectAutosaveErrorNotice autosave={autosave} />
      {modal.surface === 'export' && <ExportDialog exporter={mapExporter?.run ?? null} filename={project.document.id} document={project.document} onClose={modal.closeExport} />}
      <ProjectAutosaveDialogs
        autosave={autosave}
        onBeforeDecision={modal.preemptSurface}
        returnFocusRef={modal.returnFocusRef}
        fallbackFocusRef={mobile.projectTitleRef}
      />
    </>
  );
}
