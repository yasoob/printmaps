import { Frame, Layers3, MapPin, MousePointer2, Route, Shapes, SlidersHorizontal } from 'lucide-react';
import type { ComponentProps, Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import type { ShapeEditMode } from '../../map/ShapeVertexEditing';
import { preloadRouteEditor } from '../../map/useTerraDrawRoutes';
import type { MobilePanel } from '../hooks/useMobilePanels';
import { MapScale } from './MapScale';
import { PoiAuthoringControls } from './PoiAuthoringControls';
import { RouteDrawingPanel } from './RouteDrawingPanel';
import { ShapeDrawingPanel } from './ShapeDrawingPanel';
import { ShapeEditingToolbar } from './ShapeEditingToolbar';

const tools = [
  { id: 'select', label: 'Select', mobileLabel: 'Select', shortcut: 'V', icon: MousePointer2 },
  { id: 'pin', label: 'Place', mobileLabel: 'Place', shortcut: 'P', icon: MapPin },
  { id: 'route', label: 'Route', mobileLabel: 'Route', shortcut: 'R', icon: Route },
  { id: 'shape', label: 'Area', mobileLabel: 'Area', shortcut: 'S', icon: Shapes },
];

type SelectedShapeControls = {
  canEditPoints: boolean;
  mode: ShapeEditMode;
  onChange: Dispatch<SetStateAction<{ id: string; mode: ShapeEditMode } | null>>;
  selectedId: string | null;
};

type CanvasWorkspaceChromeProps = {
  activeTool: string;
  camera: { center: readonly [number, number]; locked: boolean; zoom: number };
  onActivateTool: (id: string) => void;
  onFitPage: () => void;
  poiPanelProps: ComponentProps<typeof PoiAuthoringControls>;
  routePanelProps: ComponentProps<typeof RouteDrawingPanel>;
  selectToolRef: RefObject<HTMLButtonElement | null>;
  selectedShape: SelectedShapeControls;
  shapePanelProps: ComponentProps<typeof ShapeDrawingPanel>;
};

export function MobilePanelActions({
  activePanel,
  children,
  layersTriggerRef,
  onOpenPanel,
  propertiesTriggerRef,
}: {
  activePanel: MobilePanel | null;
  children: ReactNode;
  layersTriggerRef: RefObject<HTMLButtonElement | null>;
  onOpenPanel: (panel: MobilePanel) => void;
  propertiesTriggerRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="mobile-panel-actions" aria-label="Editor panels">
      <button ref={layersTriggerRef} type="button" aria-label="Open layers" aria-controls="layers-panel" aria-expanded={activePanel === 'layers'} onClick={() => onOpenPanel('layers')}><Layers3 size={15} /><span>Layers</span></button>
      {children}
      <button ref={propertiesTriggerRef} type="button" aria-label="Open properties" aria-controls="properties-panel" aria-expanded={activePanel === 'properties'} onClick={() => onOpenPanel('properties')}><SlidersHorizontal size={15} /><span>Properties</span></button>
    </div>
  );
}

function SelectedShapeEditControls(props: SelectedShapeControls & { isActive: boolean }) {
  if (!props.isActive || !props.canEditPoints || !props.selectedId) return null;
  return <ShapeEditingToolbar mode={props.mode} onChange={(mode) => props.onChange({ id: props.selectedId as string, mode })} />;
}

export function CanvasWorkspaceChrome({
  activeTool, camera, onActivateTool, onFitPage, poiPanelProps, routePanelProps, selectToolRef, selectedShape, shapePanelProps,
}: CanvasWorkspaceChromeProps) {
  return (
    <>
      <nav className="tool-palette" aria-label="Map tools">
        {tools.map(({ id, label, mobileLabel, shortcut, icon: Icon }) => (
          <div className="tool-slot" key={id}>
            <button ref={id === 'select' ? selectToolRef : undefined} className={`tool-button${activeTool === id ? ' is-active' : ''}`} type="button" aria-label={`${label} (${shortcut})`} aria-pressed={activeTool === id} title={`${label} · ${shortcut}`} onPointerEnter={id === 'route' ? preloadRouteEditor : undefined} onFocus={id === 'route' ? preloadRouteEditor : undefined} onClick={() => onActivateTool(id)}>
              <Icon size={17} strokeWidth={1.8} />
              <span className="tool-label" aria-hidden="true">{mobileLabel}</span>
            </button>
          </div>
        ))}
      </nav>
      <button className="map-fit-control" type="button" aria-label="Fit page" title="Fit page · Shift+1" disabled={camera.locked} onClick={onFitPage}><Frame size={17} strokeWidth={1.8} /></button>
      <SelectedShapeEditControls {...selectedShape} isActive={activeTool === 'select'} />
      {activeTool === 'route' && <RouteDrawingPanel {...routePanelProps} />}
      <PoiAuthoringControls {...poiPanelProps} />
      {activeTool === 'shape' && <ShapeDrawingPanel {...shapePanelProps} />}
      <MapScale latitude={camera.center[1]} zoom={camera.zoom} />
    </>
  );
}
