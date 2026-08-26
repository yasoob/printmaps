import { Frame, Hand, Layers3, MapPin, MousePointer2, Route, Shapes, SlidersHorizontal } from 'lucide-react';
import type { ComponentProps, Dispatch, RefObject, SetStateAction } from 'react';
import type { ShapeEditMode } from '../../map/ShapeVertexEditing';
import type { MobilePanel } from '../hooks/useMobilePanels';
import { MapScale } from './MapScale';
import { PoiAuthoringControls } from './PoiAuthoringControls';
import { RouteDrawingPanel } from './RouteDrawingPanel';
import { ShapeDrawingPanel } from './ShapeDrawingPanel';
import { ShapeEditingToolbar } from './ShapeEditingToolbar';

const tools = [
  { id: 'select', label: 'Select', mobileLabel: 'Select', shortcut: 'V', icon: MousePointer2 },
  { id: 'pan', label: 'Pan', mobileLabel: 'Pan', shortcut: 'H', icon: Hand },
  { id: 'route', label: 'Route', mobileLabel: 'Route', shortcut: 'R', icon: Route, groupStart: true },
  { id: 'pin', label: 'Pin', mobileLabel: 'Pin', shortcut: 'P', icon: MapPin },
  { id: 'shape', label: 'Area', mobileLabel: 'Area', shortcut: 'S', icon: Shapes },
  { id: 'frame', label: 'Fit page', mobileLabel: 'Fit', shortcut: 'Shift+1', icon: Frame, command: true, groupStart: true, mobileGroupStart: true },
];

type SelectedShapeControls = {
  canEditPoints: boolean;
  mode: ShapeEditMode;
  onChange: Dispatch<SetStateAction<{ id: string; mode: ShapeEditMode } | null>>;
  selectedId: string | null;
};

type CanvasWorkspaceChromeProps = {
  activePanel: MobilePanel | null;
  activeTool: string;
  camera: { center: readonly [number, number]; locked: boolean; zoom: number };
  layersTriggerRef: RefObject<HTMLButtonElement | null>;
  onActivateTool: (id: string) => void;
  onFitPage: () => void;
  onOpenPanel: (panel: MobilePanel) => void;
  poiPanelProps: ComponentProps<typeof PoiAuthoringControls>;
  propertiesTriggerRef: RefObject<HTMLButtonElement | null>;
  routePanelProps: ComponentProps<typeof RouteDrawingPanel>;
  selectToolRef: RefObject<HTMLButtonElement | null>;
  selectedShape: SelectedShapeControls;
  shapePanelProps: ComponentProps<typeof ShapeDrawingPanel>;
};

function SelectedShapeEditControls(props: SelectedShapeControls & { isActive: boolean }) {
  if (!props.isActive || !props.canEditPoints || !props.selectedId) return null;
  return <ShapeEditingToolbar mode={props.mode} onChange={(mode) => props.onChange({ id: props.selectedId as string, mode })} />;
}

export function CanvasWorkspaceChrome({
  activePanel, activeTool, camera, layersTriggerRef, onActivateTool, onFitPage, onOpenPanel,
  poiPanelProps, propertiesTriggerRef, routePanelProps, selectToolRef, selectedShape, shapePanelProps,
}: CanvasWorkspaceChromeProps) {
  return (
    <>
      <div className="mobile-panel-actions" aria-label="Editor panels">
        <button ref={layersTriggerRef} type="button" aria-label="Open layers" aria-controls="layers-panel" aria-expanded={activePanel === 'layers'} onClick={() => onOpenPanel('layers')}><Layers3 size={15} /><span>Layers</span></button>
        <button ref={propertiesTriggerRef} type="button" aria-label="Open properties" aria-controls="properties-panel" aria-expanded={activePanel === 'properties'} onClick={() => onOpenPanel('properties')}><SlidersHorizontal size={15} /><span>Properties</span></button>
      </div>
      <nav className="tool-palette" aria-label="Map tools">
        {tools.map(({ id, label, mobileLabel, shortcut, icon: Icon, command, groupStart, mobileGroupStart }) => (
          <div className="tool-slot" key={id}>
            {groupStart && <span className={`tool-separator${mobileGroupStart ? ' is-mobile-only' : ''}`} aria-hidden="true" />}
            <button ref={id === 'select' ? selectToolRef : undefined} className={`tool-button${!command && activeTool === id ? ' is-active' : ''}`} type="button" aria-label={`${label} (${shortcut})`} aria-pressed={command ? undefined : activeTool === id} title={`${label} · ${shortcut}`} disabled={camera.locked && (id === 'pan' || id === 'frame')} onClick={() => command ? onFitPage() : onActivateTool(id)}>
              <Icon size={17} strokeWidth={1.8} />
              <span className="tool-label" aria-hidden="true">{mobileLabel}</span>
            </button>
          </div>
        ))}
      </nav>
      <SelectedShapeEditControls {...selectedShape} isActive={activeTool === 'select'} />
      {activeTool === 'route' && <RouteDrawingPanel {...routePanelProps} />}
      <PoiAuthoringControls {...poiPanelProps} />
      {activeTool === 'shape' && <ShapeDrawingPanel {...shapePanelProps} />}
      <MapScale latitude={camera.center[1]} zoom={camera.zoom} />
    </>
  );
}
