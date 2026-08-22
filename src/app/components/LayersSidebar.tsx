import { Eye, EyeOff, GripVertical, Layers3, Lock, MapPin, PanelLeftClose, Route, Search, Shapes, Unlock } from 'lucide-react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { ContentLayer, LayerType } from '../../domain/project';
import type { ProjectState } from '../store';
import type { MobilePanel } from '../hooks/useMobilePanels';

const layerIcons: Record<LayerType, typeof Route> = { route: Route, poi: MapPin, shape: Shapes, basemap: Layers3 };

type LayerRowProps = {
  layer: ContentLayer;
  index: number;
  layers: ContentLayer[];
  project: ProjectState;
  activePanel: MobilePanel | null;
  draggedLayerIdRef: RefObject<string | null>;
  setPreviewedLayerId: Dispatch<SetStateAction<string | null>>;
  closePanel: (panel?: MobilePanel | null) => void;
};

function LayerRow({ layer, index, layers, project, activePanel, draggedLayerIdRef, setPreviewedLayerId, closePanel }: LayerRowProps) {
  const Icon = layerIcons[layer.type];
  const isSelected = project.selectedId === layer.id;
  const clearPreview = () => setPreviewedLayerId((current) => current === layer.id ? null : current);
  const select = () => {
    project.selectLayer(layer.id);
    if (activePanel === 'layers') closePanel('layers');
  };
  const reorderByKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!(event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown'))) return;
    event.preventDefault();
    project.moveLayer(layer.id, index + (event.key === 'ArrowUp' ? -1 : 1));
  };

  return (
    <li className={`layer-row${isSelected ? ' is-selected' : ''}`} onMouseEnter={() => setPreviewedLayerId(layer.visible && layer.geometry ? layer.id : null)} onMouseLeave={clearPreview}>
      <button className="layer-visibility" type="button" aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`} onClick={() => { clearPreview(); project.toggleLayerVisibility(layer.id); }}>
        {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
      <button className="layer-select" type="button" data-layer-select={layer.id} aria-current={isSelected ? 'true' : undefined} onClick={select} aria-label={`Select ${layer.name}`}>
        <Icon size={14} /><span>{layer.name}</span>
      </button>
      <button className="layer-lock" type="button" aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`} onClick={() => project.toggleLayerLock(layer.id)}>
        {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
      </button>
      <button
        className="layer-drag"
        type="button"
        draggable
        aria-label={`Reorder ${layer.name}`}
        title="Drag to reorder · Alt+Arrow keys"
        onKeyDown={reorderByKeyboard}
        onDragStart={() => { draggedLayerIdRef.current = layer.id; }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => {
          if (draggedLayerIdRef.current) project.moveLayer(draggedLayerIdRef.current, layers.findIndex((candidate) => candidate.id === layer.id));
          draggedLayerIdRef.current = null;
        }}
        onDragEnd={() => { draggedLayerIdRef.current = null; }}
      ><GripVertical size={13} /></button>
    </li>
  );
}

type LayersSidebarProps = Omit<LayerRowProps, 'layer' | 'index'> & {
  panelRef: RefObject<HTMLElement | null>;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>, panel: MobilePanel) => void;
};

export function LayersSidebar(props: LayersSidebarProps) {
  const { activePanel, closePanel, layers, panelRef, onKeyDown } = props;
  return (
    <aside ref={panelRef} id="layers-panel" className={`left-sidebar${activePanel === 'layers' ? ' is-mobile-open' : ''}`} aria-label="Layers sidebar" role={activePanel === 'layers' ? 'dialog' : undefined} aria-modal={activePanel === 'layers' ? true : undefined} inert={activePanel === 'properties'} onKeyDown={(event) => onKeyDown(event, 'layers')}>
      <div className="panel-header"><span>Layers</span><button className="icon-button" type="button" aria-label="Collapse layers" onClick={() => closePanel('layers')}><PanelLeftClose size={15} /></button></div>
      <label className="panel-search"><Search size={14} aria-hidden="true" /><input aria-label="Filter layers" placeholder="Filter layers" /></label>
      <ul className="layer-tree" aria-label="Map layers">
        {layers.map((layer, index) => <LayerRow {...props} key={layer.id} layer={layer} index={index} />)}
      </ul>
      <div className="sidebar-footer"><span>{layers.length} layers</span><span>Local draft</span></div>
    </aside>
  );
}
