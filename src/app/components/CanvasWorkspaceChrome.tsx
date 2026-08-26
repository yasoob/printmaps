import { Ellipsis, Frame, Hand, Layers3, MapPin, MousePointer2, Route, Shapes, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentProps, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { ShapeEditMode } from '../../map/ShapeVertexEditing';
import type { MobilePanel } from '../hooks/useMobilePanels';
import { MapScale } from './MapScale';
import { PoiAuthoringControls } from './PoiAuthoringControls';
import { RouteDrawingPanel } from './RouteDrawingPanel';
import { ShapeDrawingPanel } from './ShapeDrawingPanel';
import { ShapeEditingToolbar } from './ShapeEditingToolbar';
import { focusFirstMenuItem, navigateMenu } from './menuKeyboard';

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
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isMoreOpen) return;
    focusFirstMenuItem(moreMenuRef.current);
    const handlePointerDown = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setIsMoreOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMoreOpen(false);
        moreButtonRef.current?.focus();
        return;
      }
      navigateMenu(event, moreMenuRef.current);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMoreOpen]);
  return (
    <>
      <div className="mobile-panel-actions" aria-label="Editor panels">
        <button ref={layersTriggerRef} type="button" aria-label="Open layers" aria-controls="layers-panel" aria-expanded={activePanel === 'layers'} onClick={() => onOpenPanel('layers')}><Layers3 size={15} /><span>Layers</span></button>
        <button ref={propertiesTriggerRef} type="button" aria-label="Open properties" aria-controls="properties-panel" aria-expanded={activePanel === 'properties'} onClick={() => onOpenPanel('properties')}><SlidersHorizontal size={15} /><span>Properties</span></button>
      </div>
      <nav className="tool-palette" aria-label="Map tools">
        {tools.map(({ id, label, mobileLabel, shortcut, icon: Icon }) => (
          <div className="tool-slot" key={id}>
            <button ref={id === 'select' ? selectToolRef : undefined} className={`tool-button${activeTool === id ? ' is-active' : ''}`} type="button" aria-label={`${label} (${shortcut})`} aria-pressed={activeTool === id} title={`${label} · ${shortcut}`} onClick={() => onActivateTool(id)}>
              <Icon size={17} strokeWidth={1.8} />
              <span className="tool-label" aria-hidden="true">{mobileLabel}</span>
            </button>
          </div>
        ))}
        <div ref={moreRef} className="tool-slot tool-more">
          <span className="tool-separator" aria-hidden="true" />
          <button ref={moreButtonRef} className={`tool-button${activeTool === 'pan' ? ' is-active' : ''}`} type="button" aria-label="More map tools" aria-expanded={isMoreOpen} aria-haspopup="menu" title="More map tools" onClick={() => setIsMoreOpen((current) => !current)}>
            <Ellipsis size={18} strokeWidth={1.8} />
            <span className="tool-label" aria-hidden="true">More</span>
          </button>
          {isMoreOpen && <div ref={moreMenuRef} className="tool-more-menu" role="menu" aria-label="More map tools">
            <button type="button" role="menuitemradio" aria-checked={activeTool === 'pan'} aria-disabled={camera.locked} onClick={() => { if (camera.locked) return; onActivateTool('pan'); setIsMoreOpen(false); moreButtonRef.current?.focus(); }}><Hand size={16} />Pan <kbd>H</kbd></button>
            <button type="button" role="menuitem" aria-disabled={camera.locked} onClick={() => { if (camera.locked) return; onFitPage(); setIsMoreOpen(false); moreButtonRef.current?.focus(); }}><Frame size={16} />Fit page <kbd>⇧1</kbd></button>
          </div>}
        </div>
      </nav>
      <SelectedShapeEditControls {...selectedShape} isActive={activeTool === 'select'} />
      {activeTool === 'route' && <RouteDrawingPanel {...routePanelProps} />}
      <PoiAuthoringControls {...poiPanelProps} />
      {activeTool === 'shape' && <ShapeDrawingPanel {...shapePanelProps} />}
      <MapScale latitude={camera.center[1]} zoom={camera.zoom} />
    </>
  );
}
