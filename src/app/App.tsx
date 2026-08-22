import { useCallback, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { ProjectDocument } from '../domain/project';
import type { PreviewPngExporter } from '../export/previewPng';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { ExportDialog } from './components/ExportDialog';
import { LayersSidebar } from './components/LayersSidebar';
import { PropertiesSidebar } from './components/PropertiesSidebar';
import { StudioHeader } from './components/StudioHeader';
import { useMobilePanels } from './hooks/useMobilePanels';
import { createProjectStore } from './store';

export function App() {
  const [projectStore] = useState(() => createProjectStore());
  const project = useStore(projectStore);
  const [previewedLayerId, setPreviewedLayerId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [mapExporter, setMapExporter] = useState<{ run: PreviewPngExporter } | null>(null);
  const draggedLayerIdRef = useRef<string | null>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const mobile = useMobilePanels();
  const layers = project.document.layers;
  const mapPreviewedLayerId = previewedLayerId !== null && layers.some((layer) => (
    layer.id === previewedLayerId && layer.visible && layer.geometry
  )) ? previewedLayerId : null;
  const selectedLayer = layers.find((layer) => layer.id === project.selectedId) ?? null;
  const selectedIndex = selectedLayer ? layers.findIndex((layer) => layer.id === selectedLayer.id) : -1;
  const clearSelection = useCallback(() => project.selectLayer(null), [project]);
  const handleExporterChange = useCallback((exporter: PreviewPngExporter | null) => {
    setMapExporter(exporter ? { run: exporter } : null);
  }, []);
  const handleOpenedDocument = useCallback((document: ProjectDocument) => {
    project.openDocument(document);
    setPreviewedLayerId(null);
  }, [project]);
  const closeExport = () => {
    setExportOpen(false);
    window.setTimeout(() => exportButtonRef.current?.focus(), 0);
  };

  return (
    <>
      <main className="studio-shell" inert={exportOpen}>
        <StudioHeader
          project={project}
          projectTitleRef={mobile.projectTitleRef}
          exportButtonRef={exportButtonRef}
          inert={mobile.activePanel !== null}
          onOpen={handleOpenedDocument}
          onExport={() => setExportOpen(true)}
        />
        <LayersSidebar
          layers={layers}
          project={project}
          activePanel={mobile.activePanel}
          draggedLayerIdRef={draggedLayerIdRef}
          setPreviewedLayerId={setPreviewedLayerId}
          closePanel={mobile.closePanel}
          panelRef={mobile.layersPanelRef}
          onKeyDown={mobile.handlePanelKeyDown}
        />
        <CanvasWorkspace
          layers={layers}
          selectedId={project.selectedId}
          previewedId={mapPreviewedLayerId}
          page={project.document.page}
          activePanel={mobile.activePanel}
          layersTriggerRef={mobile.layersTriggerRef}
          propertiesTriggerRef={mobile.propertiesTriggerRef}
          onLayerSelect={project.selectLayer}
          onBackgroundClick={clearSelection}
          onExporterChange={handleExporterChange}
          openPanel={mobile.openPanel}
        />
        {mobile.activePanel && <button className="mobile-panel-backdrop" type="button" aria-label="Close open panel" onClick={() => mobile.closePanel()} />}
        <PropertiesSidebar
          project={project}
          selectedLayer={selectedLayer}
          selectedIndex={selectedIndex}
          activePanel={mobile.activePanel}
          panelRef={mobile.propertiesPanelRef}
          setPreviewedLayerId={setPreviewedLayerId}
          closePanel={mobile.closePanel}
          onKeyDown={mobile.handlePanelKeyDown}
        />
      </main>
      {exportOpen && <ExportDialog exporter={mapExporter?.run ?? null} filename={`${project.document.id}.png`} onClose={closeExport} />}
    </>
  );
}
