import { X } from 'lucide-react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { ContentLayer } from '../../domain/project';
import type { MobilePanel } from '../hooks/useMobilePanels';
import type { ProjectState } from '../store';
import { LayerProperties } from './LayerProperties';
import { ProjectProperties } from './ProjectProperties';

type PropertiesSidebarProps = {
  project: ProjectState;
  selectedLayer: ContentLayer | null;
  selectedIndex: number;
  activePanel: MobilePanel | null;
  panelRef: RefObject<HTMLElement | null>;
  setPreviewedLayerId: Dispatch<SetStateAction<string | null>>;
  closePanel: (panel?: MobilePanel | null) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>, panel: MobilePanel) => void;
  onLocate: (coordinate: [number, number], onApplied: () => void) => void;
};

function selectedLayerButton(layerId?: string) {
  const layerButtons = [...document.querySelectorAll<HTMLElement>('[data-layer-select]')];
  return layerButtons.find((element) => layerId
    ? element.dataset.layerSelect === layerId
    : element.getAttribute('aria-current') === 'true');
}

export function PropertiesSidebar(props: PropertiesSidebarProps) {
  const { activePanel, closePanel, onKeyDown, onLocate, panelRef, project, selectedIndex, selectedLayer, setPreviewedLayerId } = props;
  const layers = project.document.layers;
  const clearSelectedPreview = () => {
    if (selectedLayer) setPreviewedLayerId((current) => current === selectedLayer.id ? null : current);
  };
  const duplicateSelected = () => {
    if (!selectedLayer) return;
    project.duplicateLayer(selectedLayer.id);
    window.setTimeout(() => {
      const focusTarget = activePanel === 'properties'
        ? panelRef.current?.querySelector<HTMLElement>('[aria-label="Layer menu"]')
        : selectedLayerButton();
      focusTarget?.focus();
    }, 0);
  };
  const deleteSelected = () => {
    if (!selectedLayer) return;
    const focusLayer = layers[selectedIndex + 1] ?? layers[selectedIndex - 1];
    clearSelectedPreview();
    project.deleteLayer(selectedLayer.id);
    window.setTimeout(() => {
      const focusTarget = activePanel === 'properties'
        ? panelRef.current?.querySelector<HTMLElement>('[aria-label="Layer menu"], [data-project-heading]')
        : (focusLayer ? selectedLayerButton(focusLayer.id) : document.querySelector<HTMLElement>('[data-project-heading]'));
      focusTarget?.focus();
    }, 0);
  };

  return (
    <aside ref={panelRef} id="properties-panel" className={`right-sidebar${activePanel === 'properties' ? ' is-mobile-open' : ''}`} aria-label="Properties sidebar" role={activePanel === 'properties' ? 'dialog' : undefined} aria-modal={activePanel === 'properties' ? true : undefined} inert={activePanel === 'layers'} onKeyDown={(event) => onKeyDown(event, 'properties')}>
      <button className="mobile-drawer-close" type="button" aria-label="Close properties" onClick={() => closePanel('properties')}><X size={16} /></button>
      {selectedLayer ? (
        <LayerProperties
          layer={selectedLayer}
          assets={project.document.assets}
          onRename={(name) => project.renameLayer(selectedLayer.id, name)}
          onOpacityChange={(opacity) => project.setLayerOpacity(selectedLayer.id, opacity)}
          onAppearanceChange={(appearance) => project.setLayerAppearance(selectedLayer.id, appearance)}
          onPoiCoordinatesChange={(coordinates) => project.setPoiCoordinates(selectedLayer.id, coordinates)}
          onPoiCustomMarkerChange={(asset) => project.setPoiCustomMarker(selectedLayer.id, asset)}
          onRouteVertexInsert={(vertexIndex) => project.insertRouteVertex(selectedLayer.id, vertexIndex)}
          onRouteVertexRemove={(vertexIndex) => project.removeRouteVertex(selectedLayer.id, vertexIndex)}
          onRouteVertexChange={(vertexIndex, coordinates) => project.setRouteVertex(selectedLayer.id, vertexIndex, coordinates)}
          onShapeVertexChange={(ringIndex, vertexIndex, coordinates) => project.setShapeVertex(selectedLayer.id, ringIndex, vertexIndex, coordinates)}
          onToggleVisibility={() => { clearSelectedPreview(); project.toggleLayerVisibility(selectedLayer.id); }}
          onToggleLock={() => project.toggleLayerLock(selectedLayer.id)}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
        />
      ) : (
        <ProjectProperties camera={project.document.camera} documentEpoch={project.documentEpoch} style={project.document.style} page={project.document.page} onBearingChange={project.setCameraBearing} onDimensionChange={project.setPageDimension} onFeatureVisibilityChange={project.setMapFeatureVisibility} onLanguageChange={project.setMapLanguage} onLocate={onLocate} onMapAreaLockChange={project.setMapAreaLocked} onOrientationChange={project.setPageOrientation} onPitchChange={project.setCameraPitch} onPresetChange={project.setPagePreset} onStyleChange={project.setMapStyle} onTextScaleChange={project.setMapTextScale} />
      )}
    </aside>
  );
}
