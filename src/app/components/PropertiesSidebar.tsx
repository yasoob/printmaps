import { X } from 'lucide-react';
import { memo, useCallback, useLayoutEffect, useMemo, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { ContentLayer } from '../../domain/project';
import type { DirectionsProvider, MapMatchingProvider } from '../../services/mapbox/contracts';
import type { MobilePanel } from '../hooks/useMobilePanels';
import { useProject, useProjectActions } from '../projectStoreContext';
import { LayerProperties } from './LayerProperties';
import { ProjectProperties, type CameraInspectorView } from './ProjectProperties';
import type { RouteExtensionEndpoint } from './routeAuthoringActions';
import { useLatestValue } from '../hooks/useLatestValue';

type PropertiesSidebarProps = {
  selectedLayerId: string | null;
  mapMatchingProvider?: MapMatchingProvider;
  directionsProvider?: DirectionsProvider;
  activePanel: MobilePanel | null;
  panelRef: RefObject<HTMLElement | null>;
  setPreviewedLayerId: Dispatch<SetStateAction<string | null>>;
  closePanel: (panel?: MobilePanel | null) => void;
  onDeleteSelected: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>, panel: MobilePanel) => void;
  onLocate: (coordinate: [number, number], onApplied: () => void) => void;
  onReplaceLayerData: (layer: ContentLayer, trigger: HTMLElement | null) => void;
  onBeginRouteExtend?: (layer: ContentLayer, endpoint: RouteExtensionEndpoint, trigger: HTMLButtonElement) => void;
  directionsRouteEditError?: string | null;
  directionsRouteEditIsRouting?: boolean;
  directionsRouteEditWaypoints?: readonly (readonly [number, number])[] | null;
  onRouteVertexChange?: (id: string, vertexIndex: number, coordinates: readonly [number, number]) => void;
  onRouteVertexRemove?: (id: string, vertexIndex: number) => void;
  onRetryDirectionsRouteEdit?: () => void;
  onCancelDirectionsRouteEdit?: () => void;
};

function selectedLayerButton() {
  return document.querySelector<HTMLElement>('[data-layer-select][aria-current="true"]');
}

const SelectedLayerProperties = memo(function SelectedLayerProperties({
  props,
  selectedLayerId,
}: {
  props: PropertiesSidebarProps;
  selectedLayerId: string;
}) {
  const { activePanel, closePanel, directionsProvider, directionsRouteEditError, directionsRouteEditIsRouting, directionsRouteEditWaypoints, mapMatchingProvider, onBeginRouteExtend, onCancelDirectionsRouteEdit, onDeleteSelected, onReplaceLayerData, onRetryDirectionsRouteEdit, onRouteVertexChange, onRouteVertexRemove, panelRef, setPreviewedLayerId } = props;
  const selectedLayer = useProject((state) =>
    state.document.layers.find(({ id }) => id === selectedLayerId) ?? null);
  const project = useProjectActions();
  const documentEpoch = useProject((state) => state.documentEpoch);
  const assets = useProject((state) => state.document.assets);
  const getSelectedLayer = useLatestValue(selectedLayer);
  const activePanelRef = useRef(activePanel);
  useLayoutEffect(() => {
    activePanelRef.current = activePanel;
  }, [activePanel]);
  const duplicateLayer = project.duplicateLayer;
  const setLayerAppearance = project.setLayerAppearance;
  const changeAppearance = useCallback(
    (appearance: Parameters<typeof setLayerAppearance>[1]) => {
      setLayerAppearance(selectedLayerId, appearance);
    },
    [selectedLayerId, setLayerAppearance],
  );
  const beginRouteExtend = useCallback(
    (endpoint: RouteExtensionEndpoint, trigger: HTMLButtonElement) => {
      const currentLayer = getSelectedLayer();
      if (!currentLayer || !onBeginRouteExtend) return;
      onBeginRouteExtend(currentLayer, endpoint, trigger);
      closePanel('properties');
    },
    [closePanel, getSelectedLayer, onBeginRouteExtend],
  );
  const clearSelectedPreview = () => {
    setPreviewedLayerId((current) =>
      current === selectedLayerId ? null : current);
  };
  const duplicateSelected = useCallback(() => {
    duplicateLayer(selectedLayerId);
    window.setTimeout(() => {
      const focusTarget = activePanelRef.current === 'properties'
        ? panelRef.current?.querySelector<HTMLElement>('[aria-label="Layer menu"]')
        : selectedLayerButton();
      focusTarget?.focus();
    }, 0);
  }, [duplicateLayer, panelRef, selectedLayerId]);

  if (!selectedLayer) return null;
  return (
    <LayerProperties
      layer={selectedLayer}
      assets={assets}
      documentEpoch={documentEpoch}
      {...(directionsProvider ? { directionsProvider } : {})}
      {...(mapMatchingProvider ? { mapMatchingProvider } : {})}
      onApplyMapMatching={(input, expectedDocumentEpoch) => project.applyMapMatching(selectedLayer.id, input, expectedDocumentEpoch)}
      onRename={(name) => project.renameLayer(selectedLayer.id, name)}
      onOpacityChange={(opacity) => project.setLayerOpacity(selectedLayer.id, opacity)}
      onAppearanceChange={changeAppearance}
      onBeginRouteExtend={onBeginRouteExtend ? beginRouteExtend : undefined}
      onArcCurvatureChange={(segmentIndex, curvature) => project.setArcSegmentCurvature(selectedLayer.id, segmentIndex, curvature)}
      onPoiCoordinatesChange={(coordinates) => project.setPoiCoordinates(selectedLayer.id, coordinates)}
      onPoiCustomMarkerChange={(asset) => project.setPoiCustomMarker(selectedLayer.id, asset)}
      onRouteVertexInsert={(vertexIndex) => project.insertRouteVertex(selectedLayer.id, vertexIndex)}
      onRouteVertexRemove={(vertexIndex) => {
        if (onRouteVertexRemove) onRouteVertexRemove(selectedLayer.id, vertexIndex);
        else project.removeRouteVertex(selectedLayer.id, vertexIndex);
      }}
      onRouteVertexChange={(vertexIndex, coordinates) => {
        if (onRouteVertexChange) onRouteVertexChange(selectedLayer.id, vertexIndex, coordinates);
        else project.setRouteVertex(selectedLayer.id, vertexIndex, coordinates);
      }}
      directionsRouteEditError={directionsRouteEditError}
      directionsRouteEditIsRouting={directionsRouteEditIsRouting}
      directionsRouteEditWaypoints={directionsRouteEditWaypoints}
      onRetryDirectionsRouteEdit={onRetryDirectionsRouteEdit}
      onCancelDirectionsRouteEdit={onCancelDirectionsRouteEdit}
      onTransformRoute={project.transformRoute}
      onShapeVertexChange={(ringIndex, vertexIndex, coordinates) => project.setShapeVertex(selectedLayer.id, ringIndex, vertexIndex, coordinates)}
      onToggleVisibility={() => { clearSelectedPreview(); project.toggleLayerVisibility(selectedLayer.id); }}
      onToggleLock={() => project.toggleLayerLock(selectedLayer.id)}
      onReplace={(trigger) => onReplaceLayerData(selectedLayer, trigger)}
      onDuplicate={duplicateSelected}
      onDelete={onDeleteSelected}
    />
  );
});

export const PropertiesSidebar = memo(function PropertiesSidebar(props: PropertiesSidebarProps) {
  const { activePanel, closePanel, onKeyDown, onLocate, panelRef, selectedLayerId } = props;
  return (
    <aside ref={panelRef} id="properties-panel" className={`right-sidebar${activePanel === 'properties' ? ' is-mobile-open' : ''}`} aria-label="Properties sidebar" role={activePanel === 'properties' ? 'dialog' : undefined} aria-modal={activePanel === 'properties' ? true : undefined} inert={activePanel === 'layers'} onKeyDown={(event) => onKeyDown(event, 'properties')}>
      <button className="mobile-drawer-close close-button" type="button" aria-label="Close properties" onClick={() => closePanel('properties')}><X size={16} /></button>
      {selectedLayerId ? (
        <SelectedLayerProperties
          props={props}
          selectedLayerId={selectedLayerId}
        />
      ) : <ProjectPropertiesPanel onLocate={onLocate} />}
    </aside>
  );
});

/**
 * Isolates the project inspector's camera subscription. Bearing, pitch and lock
 * are rendered here, but panning writes centre and zoom at pointer rate; keeping
 * this subscription narrow stops those writes from re-rendering the inspector.
 */
const ProjectPropertiesPanel = memo(function ProjectPropertiesPanel({ onLocate }: {
  onLocate: (coordinate: [number, number], onApplied: () => void) => void;
}) {
  const project = useProjectActions();
  const documentEpoch = useProject((state) => state.documentEpoch);
  const style = useProject((state) => state.document.style);
  const page = useProject((state) => state.document.page);
  const pageBoundaryVisible = useProject((state) => state.pageBoundaryVisible);
  const bearing = useProject((state) => state.document.camera.bearing);
  const pitch = useProject((state) => state.document.camera.pitch);
  const locked = useProject((state) => state.document.camera.locked);
  const camera = useMemo<CameraInspectorView>(
    () => ({ bearing, locked, pitch }),
    [bearing, locked, pitch],
  );

  return (
    <ProjectProperties
      camera={camera}
      documentEpoch={documentEpoch}
      style={style}
      page={page}
      pageBoundaryVisible={pageBoundaryVisible}
      onBearingChange={project.setCameraBearing}
      onDimensionChange={project.setPageDimension}
      onFeatureVisibilityChange={project.setMapFeatureVisibility}
      onLanguageChange={project.setMapLanguage}
      onLocate={onLocate}
      onMapAreaLockChange={project.setMapAreaLocked}
      onPageBoundaryVisibilityChange={project.setPageBoundaryVisible}
      onOrientationChange={project.setPageOrientation}
      onPitchChange={project.setCameraPitch}
      onPresetChange={project.setPagePreset}
      onStyleChange={project.setMapStyle}
      onStyleAdjustmentChange={project.setMapStyleAdjustment}
      onStyleColorChange={project.setMapStyleColor}
      onStyleCustomizationReset={project.resetMapStyleCustomization}
      onStyleReset={project.resetMapStyle}
      onStyleToneChange={project.setMapStyleTone}
      onTextScaleChange={project.setMapTextScale}
    />
  );
});
