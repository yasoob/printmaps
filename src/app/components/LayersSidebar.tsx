import { DragDropProvider } from '@dnd-kit/react';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { memo, useContext, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { ContentLayer } from '../../domain/project';
import { ProjectAutosaveStatus } from '../../storage/ProjectAutosaveUi';
import type { ProjectAutosaveState } from '../../storage/useProjectAutosave';
import { ProjectAutosaveContext } from '../../storage/projectAutosaveContext';
import type { MobilePanel } from '../hooks/useMobilePanels';
import { layerReorderSensors } from '../hooks/useLayerReordering';
import { LayerNavigation } from './LayerNavigation';
import { hasSameLayerRowView } from './layerNavigationModel';

type LayersSidebarProps = {
  layers: ContentLayer[];
  activePanel: MobilePanel | null;
  desktopCollapsed: boolean;
  onToggleCollapsed: () => void;
  setPreviewedLayerId: Dispatch<SetStateAction<string | null>>;
  closePanel: (panel?: MobilePanel | null, shouldRestoreFocus?: boolean) => void;
  openPanel: (panel: MobilePanel) => void;
  autosave?: ProjectAutosaveState;
  panelRef: RefObject<HTMLElement | null>;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>, panel: MobilePanel) => void;
};

function haveSameLayerRows(previous: readonly ContentLayer[], next: readonly ContentLayer[]) {
  return previous.length === next.length
    && previous.every((layer, index) => {
      const nextLayer = next[index];
      return nextLayer ? hasSameLayerRowView(layer, nextLayer) : false;
    });
}

const SidebarAutosaveStatus = memo(function SidebarAutosaveStatus({
  autosave: providedAutosave,
}: {
  autosave?: ProjectAutosaveState;
}) {
  const contextAutosave = useContext(ProjectAutosaveContext);
  const autosave = providedAutosave ?? contextAutosave;
  if (!autosave) {
    throw new Error(
      'LayersSidebar requires autosave state or ProjectAutosaveProvider.',
    );
  }
  return <ProjectAutosaveStatus autosave={autosave} />;
});

function haveSameLayersSidebarActions(previous: LayersSidebarProps, next: LayersSidebarProps) {
  return previous.setPreviewedLayerId === next.setPreviewedLayerId
    && previous.closePanel === next.closePanel
    && previous.openPanel === next.openPanel
    && previous.onKeyDown === next.onKeyDown
    && previous.onToggleCollapsed === next.onToggleCollapsed;
}

function isSameLayersSidebarProps(previous: LayersSidebarProps, next: LayersSidebarProps) {
  return previous.activePanel === next.activePanel
    && previous.desktopCollapsed === next.desktopCollapsed
    && haveSameLayerRows(previous.layers, next.layers)
    && previous.panelRef === next.panelRef
    && haveSameLayersSidebarActions(previous, next)
    && previous.autosave?.status === next.autosave?.status
    && previous.autosave?.statusKind === next.autosave?.statusKind;
}

export const LayersSidebar = memo(function LayersSidebar(props: LayersSidebarProps) {
  const { activePanel, autosave, closePanel, desktopCollapsed, layers, onToggleCollapsed, panelRef, onKeyDown } = props;
  const isMobileOpen = activePanel === 'layers';
  const toggleLabel = isMobileOpen ? 'Close layers' : (desktopCollapsed ? 'Expand layers' : 'Collapse layers');
  const ToggleIcon = isMobileOpen ? X : (desktopCollapsed ? PanelLeftOpen : PanelLeftClose);
  return (
    <aside ref={panelRef} id="layers-panel" className={`left-sidebar${activePanel === 'layers' ? ' is-mobile-open' : ''}`} aria-label="Layers sidebar" role={activePanel === 'layers' ? 'dialog' : undefined} aria-modal={activePanel === 'layers' ? true : undefined} inert={activePanel === 'properties'} onKeyDown={(event) => onKeyDown(event, 'layers')}>
      <div className="panel-header">
        <span>Layers</span>
        <button
          className={`icon-button${activePanel === 'layers' ? ' close-button' : ''}`}
          type="button"
          aria-label={toggleLabel}
          aria-controls={isMobileOpen ? undefined : 'layers-list'}
          aria-expanded={isMobileOpen ? undefined : !desktopCollapsed}
          title={toggleLabel}
          onClick={() => isMobileOpen ? closePanel('layers') : onToggleCollapsed()}
        >
          <ToggleIcon size={15} />
        </button>
      </div>
      <DragDropProvider sensors={layerReorderSensors}>
        <LayerNavigation layers={layers} activePanel={activePanel} desktopCollapsed={desktopCollapsed}
          openPanel={props.openPanel} setPreviewedLayerId={props.setPreviewedLayerId} />
      </DragDropProvider>
      <div className="sidebar-footer"><SidebarAutosaveStatus autosave={autosave} /></div>
    </aside>
  );
}, isSameLayersSidebarProps);
