import { DragOverlay } from '@dnd-kit/react';
import { Search, X } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState, type Dispatch, type KeyboardEvent, type ReactNode, type SetStateAction } from 'react';
import type { ContentLayer } from '../../domain/project';
import { trackEditorAction } from '../../analytics/editorAnalytics';
import type { MobilePanel } from '../hooks/useMobilePanels';
import { useStableEvent } from '../hooks/useStableEvent';
import { useLayerNavigation } from '../hooks/useLayerNavigation';
import { LayerNavigationHeader } from './LayerNavigationHeader';
import { LayerDragOverlay, LayerNavigationRow } from './LayerNavigationRow';
import './layerNavigation.css';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '../../components/ui/input-group';

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
    trackEditorAction('layerFilterClosed');
    changeQuery('');
    setSearchOpen(false);
    searchButtonRef.current?.focus();
  };
  // Stable so the memoized header only re-renders for its own inputs, not layer edits.
  const handleSearchEscape = useStableEvent((event: KeyboardEvent<HTMLElement>) => {
    if (!searchOpen || event.key !== 'Escape' || event.defaultPrevented || event.nativeEvent.isComposing || reorder.isDragging()) return;
    event.preventDefault();
    event.stopPropagation();
    closeSearch();
  });
  const toggleSearch = useStableEvent(() => {
    if (searchOpen) closeSearch();
    else {
      trackEditorAction('layerFilterOpened');
      setSearchOpen(true);
    }
  });

  return (
    <>
      <LayerNavigationHeader collapseButton={props.collapseButton} filterId={filterId}
        helpKey={`${activePanel}-${props.desktopCollapsed}`} searchOpen={searchOpen} searchButtonRef={searchButtonRef}
        onToggleSearch={toggleSearch} onKeyDown={handleSearchEscape} />
      <div className="layer-navigation" onKeyDown={handleSearchEscape}>
        <div id={filterId} className="layer-filter" hidden={!searchOpen}>
          {searchOpen && <InputGroup>
            <InputGroupAddon><Search size={16} strokeWidth={1.75} aria-hidden="true" /></InputGroupAddon>
            <InputGroupInput
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
            {query && <InputGroupAddon align="inline-end">
              <InputGroupButton className="layer-filter-clear" size="icon-xs" aria-label="Clear layer filter" onClick={() => {
                trackEditorAction('layerFilterCleared');
                changeQuery('');
                inputRef.current?.focus();
              }}><X size={16} strokeWidth={1.75} aria-hidden="true" /></InputGroupButton>
            </InputGroupAddon>}
          </InputGroup>}
        </div>
        <p id={countId} className={`layer-navigation-status${!isFiltering && !announcement ? ' sr-only' : ''}`} role="status" aria-label="Layer navigation" aria-atomic="true">
          {isFiltering && <span>{visible.length} of {layers.length} layers</span>}
          {announcement && <span>{announcement}</span>}
        </p>
        <p id={helpId} className="sr-only">Down Arrow enters layers from search. Up and Down Arrow, Home and End focus a name; Enter selects it. Tab reaches its actions. Alt with Up or Down Arrow on Reorder moves it.</p>
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
