import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { ContentLayer } from '../../domain/project';
import type { ProjectState } from '../store';

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
  project: ProjectState;
  selectedLayer: ContentLayer | null;
  setPreviewedLayerId: Dispatch<SetStateAction<string | null>>;
};

function canHandleHistory(event: KeyboardEvent, options: EditorShortcutOptions): boolean {
  return !event.defaultPrevented
    && !event.repeat
    && !event.isComposing
    && !event.altKey
    && (event.ctrlKey || event.metaKey)
    && !isTextEditingTarget(event.target)
    && !options.isModalOpen
    && !options.isAuthoring;
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
  const latestDeleteState = useRef({
    deleteFocusTarget: options.deleteFocusTarget,
    deleteLayer: options.project.deleteLayer,
    layers: options.layers,
    selectedLayer: options.selectedLayer,
    setPreviewedLayerId: options.setPreviewedLayerId,
  });
  useLayoutEffect(() => {
    latestDeleteState.current = {
      deleteFocusTarget: options.deleteFocusTarget,
      deleteLayer: options.project.deleteLayer,
      layers: options.layers,
      selectedLayer: options.selectedLayer,
      setPreviewedLayerId: options.setPreviewedLayerId,
    };
  }, [options.deleteFocusTarget, options.layers, options.project.deleteLayer, options.selectedLayer, options.setPreviewedLayerId]);
  const deleteSelectedLayer = useCallback(() => {
    const { deleteFocusTarget, deleteLayer, layers, selectedLayer, setPreviewedLayerId } = latestDeleteState.current;
    if (!selectedLayer) return;
    const selectedIndex = layers.findIndex((layer) => layer.id === selectedLayer.id);
    const focusLayer = layers[selectedIndex + 1] ?? layers[selectedIndex - 1];
    setPreviewedLayerId((current) => current === selectedLayer.id ? null : current);
    deleteLayer(selectedLayer.id);
    window.setTimeout(() => {
      const focusTarget = deleteFocusTarget?.() ?? (focusLayer
        ? layerSelectionButton(focusLayer.id)
        : document.querySelector<HTMLElement>('[data-project-heading]'));
      focusTarget?.focus();
    }, 0);
  }, []);
  const { project } = options;

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!canHandleHistory(event, options)) return;
      const key = event.key.toLowerCase();
      const shouldUndo = key === 'z' && !event.shiftKey;
      const shouldRedo = key === 'y' || (key === 'z' && event.shiftKey);
      if (shouldUndo && project.canUndo) {
        event.preventDefault();
        project.undo();
      } else if (shouldRedo && project.canRedo) {
        event.preventDefault();
        project.redo();
      }
    };
    document.addEventListener('keydown', handleHistoryShortcut);
    return () => document.removeEventListener('keydown', handleHistoryShortcut);
  }, [options, project]);

  const handleDeleteKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (!shouldDeleteSelection(event, options)) return;
    event.preventDefault();
    deleteSelectedLayer();
  }, [deleteSelectedLayer, options]);

  return { deleteSelectedLayer, handleDeleteKeyDown };
}
