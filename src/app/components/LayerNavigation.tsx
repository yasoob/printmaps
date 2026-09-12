import { DragOverlay } from '@dnd-kit/react';
import { Search, X } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState, type Dispatch, type KeyboardEvent, type ReactNode, type SetStateAction } from 'react';
import type { ContentLayer } from '../../domain/project';
import type { MobilePanel } from '../hooks/useMobilePanels';
import { useLayerNavigation } from '../hooks/useLayerNavigation';
import { LayerNavigationHeader } from './LayerNavigationHeader';
import { LayerDragOverlay, LayerNavigationRow } from './LayerNavigationRow';
import './layerNavigation.css';

type Props = {
  layers: readonly ContentLayer[];
  activePanel: MobilePanel | null;
  desktopCollapsed: boolean;
  collapseButton: ReactNode;
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
  const filterId = useId();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const isFiltering = query.trim().length > 0;

  useLayoutEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen, inputRef]);

  const closeSearch = () => {
    changeQuery('');
    setSearchOpen(false);
    searchButtonRef.current?.focus();
  };
  const handleSearchEscape = (event: KeyboardEvent<HTMLElement>) => {
    if (!searchOpen || event.key !== 'Escape' || event.defaultPrevented || event.nativeEvent.isComposing || reorder.isDragging()) return;
    event.preventDefault();
    event.stopPropagation();
    closeSearch();
  };

  return (
    <>
      <LayerNavigationHeader collapseButton={props.collapseButton} filterId={filterId}
        helpKey={`${activePanel}-${props.desktopCollapsed}`} searchOpen={searchOpen} searchButtonRef={searchButtonRef}
        onToggleSearch={() => searchOpen ? closeSearch() : setSearchOpen(true)} onKeyDown={handleSearchEscape} />
      <div className="layer-navigation" onKeyDown={handleSearchEscape}>
        <div id={filterId} className="layer-filter" hidden={!searchOpen}>
          <Search size={14} aria-hidden="true" />
          {searchOpen && <input
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
          />}
          {query && <button className="layer-filter-clear" type="button" aria-label="Clear layer filter" onClick={() => {
            changeQuery('');
            inputRef.current?.focus();
          }}><X size={14} aria-hidden="true" /></button>}
        </div>
        <p id={countId} className={`layer-navigation-status${!isFiltering && !announcement ? ' sr-only' : ''}`} role="status" aria-label="Layer navigation" aria-atomic="true">
          {isFiltering && <span>{visible.length} of {layers.length} layers</span>}
          {announcement && <span>{announcement}</span>}
        </p>
        <p id={helpId} className="sr-only">↓ enters layers from search. ↑/↓ and Home/End focus a name; Enter selects it. Tab: actions. Alt+↑/↓ on Reorder: move.</p>
        {isFiltering && visible.length === 0 && <p className="layer-navigation-empty">No matching layers. Change or clear the filter.</p>}
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
        onKeyDown={(event) => {
          handleRowKeys(event);
          handleSearchEscape(event);
        }}
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
