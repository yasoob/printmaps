import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react';
import type { ContentLayer } from '../../domain/project';
import { filterLayers, layerFocusIndex } from '../components/layerNavigationModel';
import { useProject, useProjectStoreApi } from '../projectStoreContext';
import type { MobilePanel } from './useMobilePanels';
import { useLayerReordering } from './useLayerReordering';
import { useStableEvent } from './useStableEvent';

function useLayerRowFocus(activeId: string | null, visible: readonly ContentLayer[]) {
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedElementRef = useRef<HTMLElement | null>(null);
  const focusRow = useStableEvent((id: string | null) => {
    const button = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[data-layer-select]') ?? [])]
      .find((element) => element.dataset.layerSelect === id);
    if (!button) return false;
    button.focus({ preventScroll: true });
    button.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    return true;
  });
  useEffect(() => {
    const trackFocus = (event: FocusEvent) => {
      if (!(event.target instanceof Node) || !listRef.current?.contains(event.target)) focusedElementRef.current = null;
    };
    document.addEventListener('focusin', trackFocus);
    return () => document.removeEventListener('focusin', trackFocus);
  }, []);
  useLayoutEffect(() => {
    // Only repair a removed row's focus; never redirect a Properties edit.
    if (focusedElementRef.current && !focusedElementRef.current.isConnected
      && document.activeElement === document.body && !focusRow(activeId)) inputRef.current?.focus();
  }, [activeId, focusRow, visible]);
  return { listRef, inputRef, focusedElementRef, focusRow };
}

function canHandleRowKey(event: KeyboardEvent<HTMLUListElement>) {
  return !event.defaultPrevented && !event.nativeEvent.isComposing
    && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.target instanceof HTMLElement;
}

function isDifferentLayerDeletion(event: KeyboardEvent<HTMLUListElement>, rowId: string, selectedId: string | null) {
  return rowId !== selectedId && !event.altKey && (event.key === 'Delete' || event.key === 'Backspace');
}

function handleKeyboardReorder(event: KeyboardEvent<HTMLUListElement>, rowId: string, move: (id: string, offset: number) => void) {
  const offset = event.key === 'ArrowUp' ? -1 : (event.key === 'ArrowDown' ? 1 : null);
  if (offset === null || !(event.target instanceof HTMLElement) || !event.target.closest('.layer-drag')) return;
  event.preventDefault();
  move(rowId, offset);
  event.target.scrollIntoView?.({ block: 'nearest' });
}

type Options = {
  layers: readonly ContentLayer[];
  activePanel: MobilePanel | null;
  desktopCollapsed: boolean;
  setPreviewedLayerId: Dispatch<SetStateAction<string | null>>;
};

export function useLayerNavigation({ layers, activePanel, desktopCollapsed, setPreviewedLayerId }: Options) {
  const store = useProjectStoreApi();
  const epoch = useProject((state) => state.documentEpoch);
  const selectedId = useProject((state) => state.selectedId);
  const [navigation, setNavigation] = useState({ epoch, query: '', activeId: selectedId, index: 0 });
  const [announcement, setAnnouncement] = useState({ epoch, text: '' });
  const query = navigation.epoch === epoch ? navigation.query : '';
  const visible = useMemo(() => filterLayers(layers, query), [layers, query]);
  const preferredId = navigation.epoch === epoch ? navigation.activeId : selectedId;
  const preferredIndex = visible.findIndex((layer) => layer.id === preferredId);
  const index = preferredIndex === -1
    ? Math.max(0, Math.min(navigation.epoch === epoch ? navigation.index : 0, visible.length - 1))
    : preferredIndex;
  const activeId = visible[index]?.id ?? null;
  if (navigation.epoch !== epoch || navigation.activeId !== activeId || navigation.index !== index) {
    setNavigation({ epoch, query, activeId, index });
  }

  const focus = useLayerRowFocus(activeId, visible);
  const announce = useStableEvent((text: string) => setAnnouncement({ epoch: store.getState().documentEpoch, text }));
  const { cancel, ...reorder } = useLayerReordering(query, announce);
  const previousPanel = useRef({ activePanel, desktopCollapsed });
  useLayoutEffect(() => {
    if (previousPanel.current.activePanel !== activePanel || previousPanel.current.desktopCollapsed !== desktopCollapsed) {
      cancel('the layers panel changed');
    }
    previousPanel.current = { activePanel, desktopCollapsed };
  }, [activePanel, desktopCollapsed, cancel]);

  const activate = (id: string) => {
    const nextIndex = visible.findIndex((layer) => layer.id === id);
    if (nextIndex === -1) return;
    setNavigation((current) => current.epoch === epoch && current.activeId === id && current.index === nextIndex
      ? current : { epoch, query, activeId: id, index: nextIndex });
  };
  const changeQuery = (nextQuery: string) => {
    cancel('the filter changed');
    const nextVisible = filterLayers(layers, nextQuery);
    const nextIndex = Math.max(0, nextVisible.findIndex((layer) => layer.id === activeId));
    setNavigation({ epoch, query: nextQuery, activeId: nextVisible[nextIndex]?.id ?? null, index: nextIndex });
    setPreviewedLayerId(null);
  };
  const handleRowKeys = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!canHandleRowKey(event) || !(event.target instanceof HTMLElement)) return;
    const rowId = event.target.closest<HTMLElement>('[data-layer-id]')?.dataset.layerId;
    if (!rowId) return;
    if (isDifferentLayerDeletion(event, rowId, selectedId)) {
      event.preventDefault();
      announce('Select this layer before deleting. Focus alone does not select a layer.');
      return;
    }
    if (reorder.isDragging()) return;
    if (event.altKey) {
      handleKeyboardReorder(event, rowId, reorder.moveByKeyboard);
      return;
    }
    const nextIndex = layerFocusIndex(event.key, visible.findIndex((layer) => layer.id === rowId), visible.length);
    if (nextIndex === null) return;
    event.preventDefault();
    focus.focusRow(visible[nextIndex]?.id ?? null);
  };
  return {
    query, visible, activeId, selectedId, changeQuery, activate, focus, reorder, handleRowKeys,
    announcement: announcement.epoch === epoch ? announcement.text : '',
  };
}
