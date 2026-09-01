import { DragDropProvider, DragOverlay, type DragEndEvent } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import { Eye, EyeOff, GripVertical, Layers3, Lock, MapPin, PanelLeftClose, Route, Shapes, Unlock, X } from 'lucide-react';
import { memo, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { ContentLayer, LayerType } from '../../domain/project';
import { ProjectAutosaveStatus } from '../../storage/ProjectAutosaveUi';
import type { ProjectAutosaveState } from '../../storage/useProjectAutosave';
import { useProject, useProjectActions } from '../projectStoreContext';
import type { MobilePanel } from '../hooks/useMobilePanels';

const layerIcons: Record<LayerType, typeof Route> = { route: Route, poi: MapPin, shape: Shapes, basemap: Layers3 };

type LayerRowProps = {
  layer: ContentLayer;
  index: number;
  isSelected: boolean;
  activePanel: MobilePanel | null;
  setPreviewedLayerId: Dispatch<SetStateAction<string | null>>;
  closePanel: (panel?: MobilePanel | null, shouldRestoreFocus?: boolean) => void;
};

function hasSameLayerRowView(previous: ContentLayer, next: ContentLayer) {
  return previous.id === next.id
    && previous.type === next.type
    && previous.name === next.name
    && previous.visible === next.visible
    && previous.locked === next.locked;
}

function isSameLayerRowProps(previous: LayerRowProps, next: LayerRowProps) {
  return hasSameLayerRowView(previous.layer, next.layer)
    && previous.index === next.index
    && previous.isSelected === next.isSelected
    && previous.activePanel === next.activePanel
    && previous.setPreviewedLayerId === next.setPreviewedLayerId
    && previous.closePanel === next.closePanel;
}

const LayerRow = memo(function LayerRow({ layer, index, isSelected, activePanel, setPreviewedLayerId, closePanel }: LayerRowProps) {
  const { moveLayer, selectLayer, toggleLayerLock, toggleLayerVisibility } = useProjectActions();
  const Icon = layerIcons[layer.type];
  const isBasemap = layer.type === 'basemap';
  const { ref, handleRef, isDragging } = useSortable({
    id: layer.id,
    index,
    disabled: isBasemap,
    transition: { duration: 180, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
  });
  const clearPreview = () => setPreviewedLayerId((current) => current === layer.id ? null : current);
  const select = () => {
    selectLayer(layer.id);
    if (activePanel === 'layers') closePanel('layers');
  };
  const reorderByKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!(event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown'))) return;
    event.preventDefault();
    moveLayer(layer.id, index + (event.key === 'ArrowUp' ? -1 : 1));
  };

  return (
    <li
      ref={ref}
      className={`layer-row${isSelected ? ' is-selected' : ''}${isDragging ? ' is-dragging' : ''}`}
      data-layer-id={layer.id}
      onMouseEnter={() => setPreviewedLayerId(layer.visible && layer.geometry ? layer.id : null)}
      onMouseLeave={clearPreview}
    >
      <button className="layer-visibility" type="button" aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`} onClick={() => { clearPreview(); toggleLayerVisibility(layer.id); }}>
        {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
      <button className="layer-select" type="button" data-layer-select={layer.id} aria-current={isSelected ? 'true' : undefined} onClick={select} aria-label={`Select ${layer.name}`}>
        <Icon size={14} /><span>{layer.name}</span>
      </button>
      <button className="layer-lock" type="button" aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`} onClick={() => toggleLayerLock(layer.id)}>
        {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
      </button>
      <button
        ref={handleRef}
        className="layer-drag"
        type="button"
        disabled={isBasemap}
        aria-label={`Reorder ${layer.name}`}
        title={isBasemap ? 'Basemap is fixed at the bottom' : 'Drag to reorder · Alt+Arrow keys'}
        onKeyDown={reorderByKeyboard}
      ><GripVertical size={13} /></button>
    </li>
  );
}, isSameLayerRowProps);

function LayerDragOverlay({ layer }: { layer: ContentLayer }) {
  const Icon = layerIcons[layer.type];
  return (
    <div className="layer-row layer-drag-overlay" aria-hidden="true">
      <span className="layer-visibility">{layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}</span>
      <span className="layer-select"><Icon size={14} /><span>{layer.name}</span></span>
      <span className="layer-lock">{layer.locked ? <Lock size={12} /> : <Unlock size={12} />}</span>
      <span className="layer-drag"><GripVertical size={13} /></span>
    </div>
  );
}

type LayersSidebarProps = {
  layers: ContentLayer[];
  activePanel: MobilePanel | null;
  setPreviewedLayerId: Dispatch<SetStateAction<string | null>>;
  closePanel: (panel?: MobilePanel | null, shouldRestoreFocus?: boolean) => void;
  autosave: ProjectAutosaveState;
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

function isSameLayersSidebarProps(previous: LayersSidebarProps, next: LayersSidebarProps) {
  return previous.activePanel === next.activePanel
    && haveSameLayerRows(previous.layers, next.layers)
    && previous.panelRef === next.panelRef
    && previous.setPreviewedLayerId === next.setPreviewedLayerId
    && previous.closePanel === next.closePanel
    && previous.onKeyDown === next.onKeyDown
    && previous.autosave.status === next.autosave.status
    && previous.autosave.statusKind === next.autosave.statusKind;
}

export const LayersSidebar = memo(function LayersSidebar(props: LayersSidebarProps) {
  const { activePanel, autosave, closePanel, layers, panelRef, onKeyDown } = props;
  const { moveLayer } = useProjectActions();
  const selectedId = useProject((state) => state.selectedId);
  const handleDragEnd = (event: DragEndEvent) => {
    if (event.canceled) return;
    const { source } = event.operation;
    if (isSortable(source) && source.initialIndex !== source.index) {
      moveLayer(String(source.id), source.index);
    }
  };
  return (
    <aside ref={panelRef} id="layers-panel" className={`left-sidebar${activePanel === 'layers' ? ' is-mobile-open' : ''}`} aria-label="Layers sidebar" role={activePanel === 'layers' ? 'dialog' : undefined} aria-modal={activePanel === 'layers' ? true : undefined} inert={activePanel === 'properties'} onKeyDown={(event) => onKeyDown(event, 'layers')}>
      <div className="panel-header">
        <span>Layers</span>
        <button
          className={`icon-button${activePanel === 'layers' ? ' close-button' : ''}`}
          type="button"
          aria-label={activePanel === 'layers' ? 'Close layers' : 'Collapse layers'}
          onClick={() => closePanel('layers')}
        >
          {activePanel === 'layers' ? <X size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>
      <DragDropProvider onDragEnd={handleDragEnd}>
        <ul className="layer-tree" aria-label="Map layers">
          {layers.map((layer, index) => (
            <LayerRow
              key={layer.id}
              activePanel={props.activePanel}
              closePanel={props.closePanel}
              index={index}
              isSelected={selectedId === layer.id}
              layer={layer}
              setPreviewedLayerId={props.setPreviewedLayerId}
            />
          ))}
        </ul>
        <DragOverlay className="layer-drag-overlay-wrapper">
          {(source) => {
            const layer = layers.find((candidate) => candidate.id === source.id);
            return layer ? <LayerDragOverlay layer={layer} /> : null;
          }}
        </DragOverlay>
      </DragDropProvider>
      <div className="sidebar-footer"><ProjectAutosaveStatus autosave={autosave} /></div>
    </aside>
  );
}, isSameLayersSidebarProps);
