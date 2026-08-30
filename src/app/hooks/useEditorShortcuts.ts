import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { ContentLayer } from '../../domain/project';
import { useProjectActions, useProjectStoreApi } from '../projectStoreContext';

function isTextEditingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]') !== null;
}

function layerSelectionButton(layerId: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('[data-layer-select]')]
    .find((element) => element.dataset.layerSelect === layerId);
}

type EditorShortcutOptions = {
  deleteFocusTarget?: () => HTMLElement | null;
  isAuthoring: boolean;
  isModalOpen: boolean;
  layers: readonly ContentLayer[];
  selectedLayer: ContentLayer | null;
  setPreviewedLayerId: Dispatch<SetStateAction<string | null>>;
};

function canHandleHistory(event: KeyboardEvent, guards: { isAuthoring: boolean; isModalOpen: boolean }): boolean {
  return !event.defaultPrevented
    && !event.repeat
    && !event.isComposing
    && !event.altKey
    && (event.ctrlKey || event.metaKey)
    && !isTextEditingTarget(event.target)
    && !guards.isModalOpen
    && !guards.isAuthoring;
}

function hasDeleteInputBlocker(event: React.KeyboardEvent<HTMLElement>): boolean {
  return event.defaultPrevented
    || event.repeat
    || event.nativeEvent.isComposing
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || event.shiftKey;
}

function shouldDeleteSelection(event: React.KeyboardEvent<HTMLElement>, options: EditorShortcutOptions): boolean {
  if (!options.selectedLayer || options.selectedLayer.type === 'basemap' || options.selectedLayer.locked) return false;
  const isDeleteKey = event.key === 'Backspace' || event.key === 'Delete';
  const isTransformHandle = event.target instanceof HTMLElement
    && event.target.closest('[data-route-vertex-index], [data-shape-transform-handle]') !== null;
  return isDeleteKey
    && !hasDeleteInputBlocker(event)
    && !isTextEditingTarget(event.target)
    && !isTransformHandle
    && !options.isModalOpen
    && !options.isAuthoring;
}

export function useEditorShortcuts(options: EditorShortcutOptions) {
  const store = useProjectStoreApi();
  const { deleteLayer, redo, undo } = useProjectActions();
  const latestDeleteState = useRef({
    deleteFocusTarget: options.deleteFocusTarget,
    deleteLayer,
    layers: options.layers,
    selectedLayer: options.selectedLayer,
    setPreviewedLayerId: options.setPreviewedLayerId,
  });
  useLayoutEffect(() => {
    latestDeleteState.current = {
      deleteFocusTarget: options.deleteFocusTarget,
      deleteLayer,
      layers: options.layers,
      selectedLayer: options.selectedLayer,
      setPreviewedLayerId: options.setPreviewedLayerId,
    };
  }, [deleteLayer, options.deleteFocusTarget, options.layers, options.selectedLayer, options.setPreviewedLayerId]);
  const deleteSelectedLayer = useCallback(() => {
    const { deleteFocusTarget, deleteLayer: removeLayer, layers, selectedLayer, setPreviewedLayerId } = latestDeleteState.current;
    if (!selectedLayer) return;
    const selectedIndex = layers.findIndex((layer) => layer.id === selectedLayer.id);
    const focusLayer = layers[selectedIndex + 1] ?? layers[selectedIndex - 1];
    setPreviewedLayerId((current) => current === selectedLayer.id ? null : current);
    removeLayer(selectedLayer.id);
    window.setTimeout(() => {
      const focusTarget = deleteFocusTarget?.() ?? (focusLayer
        ? layerSelectionButton(focusLayer.id)
        : document.querySelector<HTMLElement>('[data-project-heading]'));
      focusTarget?.focus();
    }, 0);
  }, []);

  // Guard state is read through a ref so the global listener binds once instead
  // of being torn down and re-added on every render of the editor shell.
  const historyGuards = useRef({ isAuthoring: options.isAuthoring, isModalOpen: options.isModalOpen });
  useLayoutEffect(() => {
    historyGuards.current = { isAuthoring: options.isAuthoring, isModalOpen: options.isModalOpen };
  }, [options.isAuthoring, options.isModalOpen]);

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      const { isAuthoring, isModalOpen } = historyGuards.current;
      if (!canHandleHistory(event, { isAuthoring, isModalOpen })) return;
      const key = event.key.toLowerCase();
      const shouldUndo = key === 'z' && !event.shiftKey;
      const shouldRedo = key === 'y' || (key === 'z' && event.shiftKey);
      if (shouldUndo && store.getState().canUndo) {
        event.preventDefault();
        undo();
      } else if (shouldRedo && store.getState().canRedo) {
        event.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', handleHistoryShortcut);
    return () => document.removeEventListener('keydown', handleHistoryShortcut);
  }, [redo, store, undo]);

  const handleDeleteKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (!shouldDeleteSelection(event, options)) return;
    event.preventDefault();
    deleteSelectedLayer();
  }, [deleteSelectedLayer, options]);

  return { deleteSelectedLayer, handleDeleteKeyDown };
}
