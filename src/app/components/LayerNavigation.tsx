import { DragOverlay } from '@dnd-kit/react';
import { Search, X } from 'lucide-react';
import { useId, type Dispatch, type SetStateAction } from 'react';
import type { ContentLayer } from '../../domain/project';
import type { MobilePanel } from '../hooks/useMobilePanels';
import { useLayerNavigation } from '../hooks/useLayerNavigation';
import { LayerDragOverlay, LayerNavigationRow } from './LayerNavigationRow';
import './layerNavigation.css';

type Props = {
  layers: readonly ContentLayer[];
  activePanel: MobilePanel | null;
  desktopCollapsed: boolean;
  openPanel: (panel: MobilePanel) => void;
  setPreviewedLayerId: Dispatch<SetStateAction<string | null>>;
};

export function LayerNavigation(props: Props) {
  const { layers, activePanel, openPanel, setPreviewedLayerId } = props;
  const nav = useLayerNavigation(props);
  const { query, visible, activeId, selectedId, announcement, changeQuery, activate, focus, reorder, handleRowKeys } = nav;
  const { listRef, inputRef, focusedElementRef, focusRow } = focus;
  const helpId = useId();
  const countId = useId();

  return (
    <>
      <div className="layer-navigation">
        <div className="layer-filter">
          <Search size={14} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            aria-label="Filter layers by name"
            aria-controls="layers-list"
            aria-describedby={`${countId} ${helpId}`}
            placeholder="Filter layers…"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowDown' || event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              focusRow(activeId);
            }}
          />
          {query && <button className="layer-filter-clear" type="button" aria-label="Clear layer filter" onClick={() => {
            changeQuery('');
            inputRef.current?.focus();
          }}><X size={14} aria-hidden="true" /></button>}
        </div>
        <p id={countId} className="layer-navigation-status" role="status" aria-label="Layer navigation" aria-atomic="true">
          <span>{query.trim() ? `${visible.length} of ${layers.length} layers` : `${layers.length} ${layers.length === 1 ? 'layer' : 'layers'}`}</span>
          {announcement && <span>{announcement}</span>}
        </p>
        <p id={helpId} className="layer-navigation-help">↓ enters layers. ↑/↓ and Home/End focus a name; Enter selects it. Tab: actions. Alt+↑/↓ on Reorder: move.</p>
        {visible.length === 0 && <p className="layer-navigation-empty">No matching layers. Change or clear the filter.</p>}
      </div>
      <ul
        ref={listRef}
        id="layers-list"
        className="layer-tree"
        aria-label="Map layers"
        aria-describedby={helpId}
        onFocusCapture={(event) => {
          const id = event.target.closest<HTMLElement>('[data-layer-id]')?.dataset.layerId;
          if (id) {
            focusedElementRef.current = event.target;
            activate(id);
          }
        }}
        onPointerDownCapture={reorder.onPointerDownCapture}
        onKeyDownCapture={reorder.onKeyDownCapture}
        onKeyDown={handleRowKeys}
      >
        {visible.map((layer, visibleIndex) => (
          <LayerNavigationRow key={layer.id} layer={layer} index={visibleIndex} isSelected={selectedId === layer.id}
            isActive={activeId === layer.id} activePanel={activePanel} openPanel={openPanel} setPreviewedLayerId={setPreviewedLayerId} />
        ))}
      </ul>
      <DragOverlay className="layer-drag-overlay-wrapper" dropAnimation={null}>
        {(source) => {
          const layer = visible.find((candidate) => candidate.id === source.id);
          return layer ? <LayerDragOverlay layer={layer} /> : null;
        }}
      </DragOverlay>
    </>
  );
}
