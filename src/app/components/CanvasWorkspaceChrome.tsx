import { Layers3, MapPin, MousePointer2, Route, Shapes, SlidersHorizontal } from 'lucide-react';
import { memo, type ComponentProps, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import type { ShapeEditMode } from '../../map/ShapeVertexEditing';
import { preloadRouteEditor } from '../../map/useTerraDrawRoutes';
import type { MobilePanel } from '../hooks/useMobilePanels';
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

const CanvasToolPalette = memo(function CanvasToolPalette({
  activeTool,
  onActivateTool,
  selectToolRef,
}: Pick<CanvasWorkspaceChromeProps, "activeTool" | "onActivateTool" | "selectToolRef">) {
  return (
    <nav className="tool-palette" aria-label="Map tools">
      {tools.map(({ id, label, mobileLabel, shortcut, icon: Icon }) => (
        <div className="tool-slot" key={id}>
          <Button
            ref={id === 'select' ? selectToolRef : undefined}
            variant="ghost"
            size="icon"
            className={`tool-button${activeTool === id ? ' is-active' : ''}`}
            aria-label={`${label} (${shortcut})`}
            aria-pressed={activeTool === id}
            title={`${label} · ${shortcut}`}
            onPointerEnter={id === 'route' ? preloadRouteEditor : undefined}
            onFocus={id === 'route' ? preloadRouteEditor : undefined}
            onClick={() => onActivateTool(id)}
          >
            <Icon size={17} strokeWidth={1.8} />
            <span className="tool-label" aria-hidden="true">{mobileLabel}</span>
          </Button>
        </div>
      ))}
    </nav>
  );
});

type SelectedShapeControls = {
  canEditPoints: boolean;
  mode: ShapeEditMode;
  onChange: Dispatch<SetStateAction<{ id: string; mode: ShapeEditMode } | null>>;
  selectedId: string | null;
};

type CanvasWorkspaceChromeProps = {
  activeTool: string;
  onActivateTool: (id: string) => void;
  poiPanelProps: ComponentProps<typeof PoiAuthoringControls>;
  routePanelProps: ComponentProps<typeof RouteDrawingPanel>;
  selectToolRef: RefObject<HTMLButtonElement | null>;
  selectedShape: SelectedShapeControls;
  shapePanelProps: ComponentProps<typeof ShapeDrawingPanel>;
  topDock: ReactNode;
};

function haveSameObjectProps(previous: object, next: object) {
  const keys = Object.keys(previous);
  return keys.length === Object.keys(next).length
    && keys.every((key) =>
      Object.hasOwn(next, key)
      && Object.is(Reflect.get(previous, key), Reflect.get(next, key)));
}

function isSameCanvasWorkspaceChromeProps(
  previous: CanvasWorkspaceChromeProps,
  next: CanvasWorkspaceChromeProps,
) {
  if (
    previous.activeTool !== next.activeTool
    || previous.onActivateTool !== next.onActivateTool
    || previous.selectToolRef !== next.selectToolRef
    || previous.topDock !== next.topDock
  ) {
    return false;
  }
  if (next.activeTool === 'pin') {
    return haveSameObjectProps(previous.poiPanelProps, next.poiPanelProps);
  }
  if (next.activeTool === 'route') {
    return haveSameObjectProps(previous.routePanelProps, next.routePanelProps);
  }
  if (next.activeTool === 'shape') {
    return haveSameObjectProps(previous.shapePanelProps, next.shapePanelProps);
  }
  return previous.selectedShape.canEditPoints === next.selectedShape.canEditPoints
    && previous.selectedShape.mode === next.selectedShape.mode
    && previous.selectedShape.onChange === next.selectedShape.onChange
    && previous.selectedShape.selectedId === next.selectedShape.selectedId;
}

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

export const CanvasWorkspaceChrome = memo(function CanvasWorkspaceChrome({
  activeTool, onActivateTool, poiPanelProps, routePanelProps, selectToolRef, selectedShape, shapePanelProps, topDock,
}: CanvasWorkspaceChromeProps) {
  return (
    <>
      <div className="canvas-top-dock">{topDock}</div>
      <div className="canvas-authoring-dock">
        {activeTool === 'select' && selectedShape.canEditPoints && selectedShape.selectedId && (
          <SelectedShapeEditControls {...selectedShape} isActive />
        )}
        {activeTool === 'route' && <RouteDrawingPanel {...routePanelProps} />}
        {activeTool === 'pin' && <PoiAuthoringControls {...poiPanelProps} />}
        {activeTool === 'shape' && <ShapeDrawingPanel {...shapePanelProps} />}
      </div>
      <div className="canvas-tool-dock">
        <CanvasToolPalette
          activeTool={activeTool}
          onActivateTool={onActivateTool}
          selectToolRef={selectToolRef}
        />
      </div>
    </>
  );
}, isSameCanvasWorkspaceChromeProps);
