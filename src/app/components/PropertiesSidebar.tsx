import { X } from 'lucide-react';
import { memo, useCallback, useLayoutEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { ContentLayer } from '../../domain/project';
import type { MapMatchingProvider } from '../../services/mapbox/contracts';
import type { MobilePanel } from '../hooks/useMobilePanels';
import type { ProjectState } from '../store';
import { LayerProperties } from './LayerProperties';
import { ProjectProperties } from './ProjectProperties';

type PropertiesSidebarProps = {
  project: ProjectState;
  selectedLayer: ContentLayer | null;
  mapMatchingProvider?: MapMatchingProvider;
  activePanel: MobilePanel | null;
  panelRef: RefObject<HTMLElement | null>;
  setPreviewedLayerId: Dispatch<SetStateAction<string | null>>;
  closePanel: (panel?: MobilePanel | null) => void;
  onDeleteSelected: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>, panel: MobilePanel) => void;
  onLocate: (coordinate: [number, number], onApplied: () => void) => void;
  onReplaceLayerData: (layer: ContentLayer, trigger: HTMLElement | null) => void;
};

function selectedLayerButton() {
  return document.querySelector<HTMLElement>('[data-layer-select][aria-current="true"]');
}

function hasSameProjectData(previous: PropertiesSidebarProps, next: PropertiesSidebarProps) {
  const previousDocument = previous.project.document;
  const nextDocument = next.project.document;
  return previous.project.documentEpoch === next.project.documentEpoch
    && previousDocument.assets === nextDocument.assets
    && previousDocument.page === nextDocument.page
    && previousDocument.style === nextDocument.style
    && previousDocument.camera.bearing === nextDocument.camera.bearing
    && previousDocument.camera.pitch === nextDocument.camera.pitch
    && previousDocument.camera.locked === nextDocument.camera.locked;
}

function hasSameLayerActions(previous: ProjectState, next: ProjectState) {
  return previous.duplicateLayer === next.duplicateLayer
    && previous.renameLayer === next.renameLayer
    && previous.setLayerOpacity === next.setLayerOpacity
    && previous.setLayerAppearance === next.setLayerAppearance
    && previous.toggleLayerVisibility === next.toggleLayerVisibility
    && previous.toggleLayerLock === next.toggleLayerLock;
}

function hasSameGeometryActions(previous: ProjectState, next: ProjectState) {
  return previous.applyMapMatching === next.applyMapMatching
    && previous.setPoiCoordinates === next.setPoiCoordinates
    && previous.setPoiCustomMarker === next.setPoiCustomMarker
    && previous.insertRouteVertex === next.insertRouteVertex
    && previous.removeRouteVertex === next.removeRouteVertex
    && previous.setRouteVertex === next.setRouteVertex
    && previous.setShapeVertex === next.setShapeVertex;
}

function hasSameSurface(previous: PropertiesSidebarProps, next: PropertiesSidebarProps) {
  return previous.activePanel === next.activePanel
    && previous.closePanel === next.closePanel
    && previous.mapMatchingProvider === next.mapMatchingProvider
    && previous.onDeleteSelected === next.onDeleteSelected
    && previous.onKeyDown === next.onKeyDown
    && previous.panelRef === next.panelRef
    && previous.selectedLayer === next.selectedLayer
    && previous.setPreviewedLayerId === next.setPreviewedLayerId
    && previous.onLocate === next.onLocate
    && previous.onReplaceLayerData === next.onReplaceLayerData;
}

function isSamePropertiesSidebarProps(previous: PropertiesSidebarProps, next: PropertiesSidebarProps) {
  return hasSameSurface(previous, next)
    && hasSameProjectData(previous, next)
    && hasSameLayerActions(previous.project, next.project)
    && hasSameGeometryActions(previous.project, next.project);
}

export const PropertiesSidebar = memo(function PropertiesSidebar(props: PropertiesSidebarProps) {
  const { activePanel, closePanel, mapMatchingProvider, onDeleteSelected, onKeyDown, onLocate, onReplaceLayerData, panelRef, project, selectedLayer, setPreviewedLayerId } = props;
  const activePanelRef = useRef(activePanel);
  useLayoutEffect(() => {
    activePanelRef.current = activePanel;
  }, [activePanel]);
  const selectedLayerId = selectedLayer?.id;
  const duplicateLayer = project.duplicateLayer;
  const clearSelectedPreview = () => {
    if (selectedLayer) setPreviewedLayerId((current) => current === selectedLayer.id ? null : current);
  };
  const duplicateSelected = useCallback(() => {
    if (!selectedLayerId) return;
    duplicateLayer(selectedLayerId);
    window.setTimeout(() => {
      const focusTarget = activePanelRef.current === 'properties'
        ? panelRef.current?.querySelector<HTMLElement>('[aria-label="Layer menu"]')
        : selectedLayerButton();
      focusTarget?.focus();
    }, 0);
  }, [duplicateLayer, panelRef, selectedLayerId]);


  return (
    <aside ref={panelRef} id="properties-panel" className={`right-sidebar${activePanel === 'properties' ? ' is-mobile-open' : ''}`} aria-label="Properties sidebar" role={activePanel === 'properties' ? 'dialog' : undefined} aria-modal={activePanel === 'properties' ? true : undefined} inert={activePanel === 'layers'} onKeyDown={(event) => onKeyDown(event, 'properties')}>
      <button className="mobile-drawer-close" type="button" aria-label="Close properties" onClick={() => closePanel('properties')}><X size={16} /></button>
      {selectedLayer ? (
        <LayerProperties
          layer={selectedLayer}
          assets={project.document.assets}
          documentEpoch={project.documentEpoch}
          {...(mapMatchingProvider ? { mapMatchingProvider } : {})}
          onApplyMapMatching={(input, expectedDocumentEpoch) => project.applyMapMatching(selectedLayer.id, input, expectedDocumentEpoch)}
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
          onReplace={(trigger) => onReplaceLayerData(selectedLayer, trigger)}
          onDuplicate={duplicateSelected}
          onDelete={onDeleteSelected}
        />
      ) : (
        <ProjectProperties camera={project.document.camera} documentEpoch={project.documentEpoch} style={project.document.style} page={project.document.page} onBearingChange={project.setCameraBearing} onDimensionChange={project.setPageDimension} onFeatureVisibilityChange={project.setMapFeatureVisibility} onLanguageChange={project.setMapLanguage} onLocate={onLocate} onMapAreaLockChange={project.setMapAreaLocked} onOrientationChange={project.setPageOrientation} onPitchChange={project.setCameraPitch} onPresetChange={project.setPagePreset} onStyleChange={project.setMapStyle} onTextScaleChange={project.setMapTextScale} />
      )}
    </aside>
  );
}, isSamePropertiesSidebarProps);
