import { useSortable } from '@dnd-kit/react/sortable';
import clsx from 'clsx';
import { Eye, EyeOff, GripVertical, Layers3, Lock, MapPin, Route, Shapes, Unlock } from 'lucide-react';
import { memo, type Dispatch, type SetStateAction } from 'react';
import type { ContentLayer, LayerType } from '../../domain/project';
import { trackEditorAction } from '../../analytics/editorAnalytics';
import { useProjectActions } from '../projectStoreContext';
import type { MobilePanel } from '../hooks/useMobilePanels';
import { useMutationFeedback } from '../hooks/useMutationFeedback';
import { hasSameLayerRowView } from './layerNavigationModel';

const layerIcons: Record<LayerType, typeof Route> = { route: Route, poi: MapPin, shape: Shapes, basemap: Layers3 };

type LayerRowProps = {
  layer: ContentLayer;
  index: number;
  isSelected: boolean;
  isActive: boolean;
  activePanel: MobilePanel | null;
  setPreviewedLayerId: Dispatch<SetStateAction<string | null>>;
  openPanel: (panel: MobilePanel) => void;
};

function isSameLayerRowProps(previous: LayerRowProps, next: LayerRowProps) {
  return hasSameLayerRowView(previous.layer, next.layer)
    && previous.index === next.index
    && previous.isSelected === next.isSelected
    && previous.isActive === next.isActive
    && previous.activePanel === next.activePanel
    && previous.setPreviewedLayerId === next.setPreviewedLayerId
    && previous.openPanel === next.openPanel;
}

export const LayerNavigationRow = memo(function LayerNavigationRow({ layer, index, isSelected, isActive, activePanel, setPreviewedLayerId, openPanel }: LayerRowProps) {
  const { selectLayer, toggleLayerLock, toggleLayerVisibility } = useProjectActions();
  const feedback = useMutationFeedback(layer);
  const Icon = layerIcons[layer.type];
  const isBasemap = layer.type === 'basemap';
  const tabIndex = isActive ? 0 : -1;
  const { ref, handleRef, isDragging } = useSortable({
    id: layer.id,
    index,
    disabled: isBasemap,
    transition: { duration: 180, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
  });
  const clearPreview = () => setPreviewedLayerId((current) => current === layer.id ? null : current);
  const select = () => {
    selectLayer(layer.id);
    if (activePanel === 'layers') openPanel('properties');
  };

  return (
    <li
      ref={ref}
      className={clsx('layer-row', { 'is-selected': isSelected, 'is-dragging': isDragging })}
      data-layer-id={layer.id}
      onMouseEnter={() => {
        if (layer.visible && layer.geometry) trackEditorAction('layerPreviewed');
        setPreviewedLayerId(layer.visible && layer.geometry ? layer.id : null);
      }}
      onMouseLeave={clearPreview}
    >
      <button className="layer-visibility" tabIndex={tabIndex} type="button" aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`} onClick={() => {
        const result = feedback.report(toggleLayerVisibility(layer.id));
        if (result.ok) clearPreview();
      }}>
        {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
      <button className="layer-select" tabIndex={tabIndex} type="button" data-layer-select={layer.id} aria-current={isSelected ? 'true' : undefined} aria-haspopup={activePanel === 'layers' ? 'dialog' : undefined} onClick={select} aria-label={`Select ${layer.name}`}>
        <Icon size={14} /><span>{layer.name}</span>
      </button>
      <button className="layer-lock" tabIndex={tabIndex} type="button" aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`} onClick={() => feedback.report(toggleLayerLock(layer.id))}>
        {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
      </button>
      <button
        ref={handleRef}
        className="layer-drag"
        tabIndex={tabIndex}
        type="button"
        disabled={isBasemap}
        aria-label={`Reorder ${layer.name}`}
        aria-keyshortcuts={isBasemap ? undefined : 'Alt+ArrowUp Alt+ArrowDown'}
        title={isBasemap ? 'Basemap is fixed at the bottom' : 'Drag to reorder · Alt+Arrow keys'}
      ><GripVertical size={13} /></button>
      {feedback.error && <p className="layer-mutation-error coordinate-validation" role="alert">{feedback.error}</p>}
    </li>
  );
}, isSameLayerRowProps);

export function LayerDragOverlay({ layer }: { layer: ContentLayer }) {
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
