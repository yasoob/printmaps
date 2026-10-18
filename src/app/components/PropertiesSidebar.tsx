import { ArrowLeft, Map as MapIcon, X } from 'lucide-react';
import { Activity, memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { ContentLayer } from '../../domain/project';
import type { DirectionsProvider, MapMatchingProvider } from '../../services/mapbox/contracts';
import type { MobilePanel } from '../hooks/useMobilePanels';
import { useProject, useProjectActions } from '../projectStoreContext';
import { MAP_STYLE_PRESET_LABELS } from '../../domain/mapStylePresets';
import { isMapStyleCustomized } from '../../domain/mapStyleCustomization';
import { PropertyRow, PropertySection } from './PropertyControls';
import { Button } from '../../components/ui/button';
import { LayerProperties } from './LayerProperties';
import { ProjectProperties, type CameraInspectorView } from './ProjectProperties';
import type { RouteExtensionEndpoint } from './routeAuthoringActions';
import { useLatestValue } from '../hooks/useLatestValue';
import type { PreviewPngExporter } from '../../export/previewPng';
import { StudioTerrainControls } from '../studio/StudioTerrainControls';
import { StudioCompositionControls } from '../studio/StudioCompositionControls';
import { StudioBlockedReasonContext } from '../studio/studioBlockedReasonContext';

type PropertiesSidebarProps = {
  exporter?: PreviewPngExporter | null;
  studioBlockedReason?: string;
  layoutRequest?: number;
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
  onRouteVertexChange?: (id: string, vertexIndex: number, coordinates: readonly [number, number]) => import('../../domain/projectMutation').GeometryEditResult;
  onRouteVertexRemove?: (id: string, vertexIndex: number) => import('../../domain/projectMutation').GeometryEditResult;
  onRetryDirectionsRouteEdit?: () => void;
  onCancelDirectionsRouteEdit?: () => void;
};

function selectedLayerButton() {
  return document.querySelector<HTMLElement>('[data-layer-select][aria-current="true"]');
}

// Basemap style lives in Project > Map; this only summarizes it and links there.
const BasemapDesignSection = memo(function BasemapDesignSection({ onOpen }: { onOpen: () => void }) {
  const preset = useProject((state) => state.document.style.preset);
  const isCustomized = useProject((state) => isMapStyleCustomized(state.document.style.customization));
  return <PropertySection title="Map design">
    <PropertyRow label="Style"><span className="property-value">{MAP_STYLE_PRESET_LABELS[preset]}{isCustomized ? ' · Custom colors' : ''}</span></PropertyRow>
    <Button variant="secondary" className="inspector-full-width" onClick={onOpen}>
      <MapIcon aria-hidden="true" /> Map design settings
    </Button>
  </PropertySection>;
});

const SelectedLayerProperties = memo(function SelectedLayerProperties({
  props,
  selectedLayerId,
  onOpenMapDesign,
}: {
  props: PropertiesSidebarProps;
  selectedLayerId: string;
  onOpenMapDesign: () => void;
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
  const selectLayer = project.selectLayer;
  const setLayerAppearance = project.setLayerAppearance;
  const openProjectSettings = useCallback(() => {
    selectLayer(null);
    window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>('[data-project-heading]')?.focus(), 0);
  }, [panelRef, selectLayer]);
  const changeAppearance = useCallback(
    (appearance: Parameters<typeof setLayerAppearance>[1]) => {
      return setLayerAppearance(selectedLayerId, appearance);
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
    const result = duplicateLayer(selectedLayerId);
    if (!result.ok) return result;
    window.setTimeout(() => {
      const focusTarget = activePanelRef.current === 'properties'
        ? panelRef.current?.querySelector<HTMLElement>('[aria-label="Layer menu"]')
        : selectedLayerButton();
      focusTarget?.focus();
    }, 0);
    return result;
  }, [duplicateLayer, panelRef, selectedLayerId]);

  if (!selectedLayer) return null;
  return (
    <>
    <button className="inspector-back" type="button" onClick={openProjectSettings}>
      <ArrowLeft aria-hidden="true" size={16} /> Project settings
    </button>
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
        return onRouteVertexRemove ? onRouteVertexRemove(selectedLayer.id, vertexIndex)
          : project.removeRouteVertex(selectedLayer.id, vertexIndex);
      }}
      onRouteVertexChange={(vertexIndex, coordinates) => {
        return onRouteVertexChange ? onRouteVertexChange(selectedLayer.id, vertexIndex, coordinates)
          : project.setRouteVertex(selectedLayer.id, vertexIndex, coordinates);
      }}
      directionsRouteEditError={directionsRouteEditError}
      directionsRouteEditIsRouting={directionsRouteEditIsRouting}
      directionsRouteEditWaypoints={directionsRouteEditWaypoints}
      onRetryDirectionsRouteEdit={onRetryDirectionsRouteEdit}
      onCancelDirectionsRouteEdit={onCancelDirectionsRouteEdit}
      onTransformRoute={project.transformRoute}
      onShapeVertexChange={(ringIndex, vertexIndex, coordinates) => project.setShapeVertex(selectedLayer.id, ringIndex, vertexIndex, coordinates)}
      onToggleVisibility={() => {
        const result = project.toggleLayerVisibility(selectedLayer.id);
        if (result.ok) clearSelectedPreview();
        return result;
      }}
      onToggleLock={() => project.toggleLayerLock(selectedLayer.id)}
      onReplace={(trigger) => onReplaceLayerData(selectedLayer, trigger)}
      onDuplicate={duplicateSelected}
      onDelete={onDeleteSelected}
      extraSections={selectedLayer.type === 'basemap' ? <BasemapDesignSection onOpen={onOpenMapDesign} /> : undefined}
    />
    </>
  );
});

export const PropertiesSidebar = memo(function PropertiesSidebar(props: PropertiesSidebarProps) {
  const { activePanel, closePanel, onKeyDown, onLocate, panelRef, selectedLayerId } = props;
  const [mapRequest, setMapRequest] = useState(0);
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  // A different inspector view starts at its top; reopening the same view keeps its scroll position.
  useLayoutEffect(() => {
    if (scrollRegionRef.current) scrollRegionRef.current.scrollTop = 0;
  }, [selectedLayerId]);
  const { selectLayer } = useProjectActions();
  const openMapDesign = useCallback(() => {
    setMapRequest((value) => value + 1);
    selectLayer(null);
    window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>('[data-project-heading]')?.focus(), 0);
  }, [panelRef, selectLayer]);
  return (
    <aside ref={panelRef} id="properties-panel" className={`right-sidebar${activePanel === 'properties' ? ' is-mobile-open' : ''}`} aria-label="Properties sidebar" role={activePanel === 'properties' ? 'dialog' : undefined} aria-modal={activePanel === 'properties' ? true : undefined} inert={activePanel === 'layers'} onKeyDown={(event) => onKeyDown(event, 'properties')}>
      <div className="mobile-sheet-bar">
        <span className="mobile-sheet-grip" aria-hidden="true" />
        <button className="mobile-drawer-close close-button" type="button" aria-label="Close properties" onClick={() => closePanel('properties')}><X size={16} /></button>
      </div>
      <div ref={scrollRegionRef} className="properties-scroll-region">
        {selectedLayerId ? (
          <SelectedLayerProperties
            props={props}
            selectedLayerId={selectedLayerId}
            onOpenMapDesign={openMapDesign}
          />
        ) : null}
        <Activity mode={selectedLayerId ? 'hidden' : 'visible'}>
          <ProjectPropertiesPanel onLocate={onLocate} exporter={props.exporter} blockedReason={props.studioBlockedReason} layoutRequest={props.layoutRequest} mapRequest={mapRequest} />
        </Activity>
      </div>
    </aside>
  );
});

const TERRAIN_CONTROLS = <StudioTerrainControls />;

/**
 * Isolates the project inspector's camera subscription. Bearing, pitch and lock
 * are rendered here, but panning writes centre and zoom at pointer rate; keeping
 * this subscription narrow stops those writes from re-rendering the inspector.
 */
const ProjectPropertiesPanel = memo(function ProjectPropertiesPanel({ onLocate, exporter, blockedReason, layoutRequest, mapRequest }: {
  onLocate: (coordinate: [number, number], onApplied: () => void) => void;
  exporter?: PreviewPngExporter | null;
  blockedReason?: string;
  layoutRequest?: number;
  mapRequest?: number;
}) {
  const project = useProjectActions();
  const documentEpoch = useProject((state) => state.documentEpoch);
  const style = useProject((state) => state.document.style);
  const pageBoundaryVisible = useProject((state) => state.pageBoundaryVisible);
  const bearing = useProject((state) => state.document.camera.bearing);
  const pitch = useProject((state) => state.document.camera.pitch);
  const locked = useProject((state) => state.document.camera.locked);
  const camera = useMemo<CameraInspectorView>(
    () => ({ bearing, locked, pitch }),
    [bearing, locked, pitch],
  );
  // Stable elements: tool activation (blockedReason) reaches only the composition
  // controls through context, so the inspector and the Map tab stay silent.
  const studioControls = useMemo(() => <StudioCompositionControls exporter={exporter} />, [exporter]);

  return (
    <StudioBlockedReasonContext value={blockedReason}>
    <ProjectProperties
      layoutRequest={layoutRequest}
      mapRequest={mapRequest}
      terrainControls={TERRAIN_CONTROLS}
      studioControls={studioControls}
      camera={camera}
      documentEpoch={documentEpoch}
      style={style}
      pageBoundaryVisible={pageBoundaryVisible}
      onBearingChange={project.setCameraBearing}
      onFeatureVisibilityChange={project.setMapFeatureVisibility}
      onLanguageChange={project.setMapLanguage}
      onLocate={onLocate}
      onMapAreaLockChange={project.setMapAreaLocked}
      onPageBoundaryVisibilityChange={project.setPageBoundaryVisible}
      onPitchChange={project.setCameraPitch}
      onStyleChange={project.setMapStyle}
      onStyleAdjustmentChange={project.setMapStyleAdjustment}
      onStyleColorChange={project.setMapStyleColor}
      onStyleCustomizationReset={project.resetMapStyleCustomization}
      onStyleReset={project.resetMapStyle}
      onStyleToneChange={project.setMapStyleTone}
      onTextScaleChange={project.setMapTextScale}
    />
    </StudioBlockedReasonContext>
  );
});
