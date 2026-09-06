import { KeyboardSensor, PointerSensor, useDragDropManager, useDragDropMonitor, type DragDropManager, type DragEndEvent } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import { useEffect, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import { captureLayerReorder, isLayerReorderCurrent, layerReorderDestination, type LayerReorderOwner } from '../components/layerNavigationModel';
import { useProjectStoreApi } from '../projectStoreContext';
import type { ProjectState } from '../store';
import { useStableEvent } from './useStableEvent';
import { createLayerDropCompletion, type LayerDropCompletion } from './layerDropCompletion';

type Gesture = { owner: LayerReorderOwner; activator: Event | null; isRetired?: boolean };
type CompletionScope = { completion: LayerDropCompletion; unsubscribe: () => void };
export const layerReorderSensors = [PointerSensor, KeyboardSensor];

function stopLayerReorder(manager: DragDropManager | null) {
  manager?.actions.stop({ canceled: true });
  if (manager) {
    // Stopping the operation alone leaves the keyboard sensor's document listeners active.
    manager.sensors = [];
    manager.sensors = layerReorderSensors;
  }
}

function useReorderCleanup({ intent, cancel, retireIntent, release, disposeCompletion }: {
  intent: RefObject<Gesture | null>; cancel: (reason: string) => void; retireIntent: () => void;
  release: () => void; disposeCompletion: () => void;
}) {
  useEffect(() => {
    const clearIntent = (event: Event) => {
      const activator = intent.current?.activator;
      if (!activator) return;
      const isKeyboardEnd = activator.type === 'keydown' && event.type === 'keyup'
        && (activator as globalThis.KeyboardEvent).code === (event as globalThis.KeyboardEvent).code;
      const isPointerEnd = activator.type === 'pointerdown' && event.type !== 'keyup'
        && (activator as PointerEvent).pointerId === (event as PointerEvent).pointerId;
      if (isKeyboardEnd || isPointerEnd) retireIntent();
    };
    const blur = () => cancel('focus left the editor');
    document.addEventListener('pointerup', clearIntent, { capture: true });
    document.addEventListener('pointercancel', clearIntent, { capture: true });
    document.addEventListener('keyup', clearIntent, { capture: true });
    window.addEventListener('blur', blur);
    return () => {
      document.removeEventListener('pointerup', clearIntent, true);
      document.removeEventListener('pointercancel', clearIntent, true);
      document.removeEventListener('keyup', clearIntent, true);
      window.removeEventListener('blur', blur);
      retireIntent();
      release();
      disposeCompletion();
    };
  }, [cancel, intent, release, disposeCompletion, retireIntent]);
}

function moveLayer(store: StoreApi<ProjectState>, owner: LayerReorderOwner, visibleIndex: number, announce: (text: string) => void) {
  const index = layerReorderDestination(owner.layers, owner.visibleIds, owner.sourceId, visibleIndex);
  if (index === null) return;
  const previousIndex = owner.layers.findIndex((layer) => layer.id === owner.sourceId);
  if (index === previousIndex) {
    announce('Layer is already at that end of the filtered list. The basemap stays at the bottom.');
    return;
  }
  store.getState().moveLayer(owner.sourceId, index);
  const layers = store.getState().document.layers;
  const finalIndex = layers.findIndex((layer) => layer.id === owner.sourceId);
  announce(finalIndex === index
    ? `Layer moved to position ${index + 1} of ${layers.length}.`
    : 'Layer could not be reordered. Try again.');
}

function useDropCompletion(
  manager: DragDropManager | null, store: StoreApi<ProjectState>,
  capture: (id: string, activator: Event | null) => Gesture, isCurrent: (gesture: Gesture) => boolean,
) {
  const dropping = useRef<CompletionScope | null>(null);
  const disposeCompletion = useStableEvent(() => {
    const scope = dropping.current;
    dropping.current = null;
    scope?.unsubscribe();
    scope?.completion.dispose();
  });
  const completeDrop = useStableEvent((gesture: Gesture, event: DragEndEvent) => {
    if (!manager) return;
    disposeCompletion();
    const owner = capture(gesture.owner.sourceId, gesture.activator);
    const scope: CompletionScope = {
      completion: createLayerDropCompletion({
        manager, event,
        canRestoreFocus: () => !gesture.isRetired && gesture.owner.epoch === owner.owner.epoch && isCurrent(owner),
        onComplete: () => {
          if (dropping.current === scope) dropping.current = null;
          scope.unsubscribe();
        },
      }),
      unsubscribe: () => {},
    };
    dropping.current = scope;
    scope.unsubscribe = store.subscribe(() => { if (!isCurrent(owner)) scope.completion.invalidate(); });
    if (gesture.isRetired) scope.completion.invalidate();
  });
  return {
    completeDrop, disposeCompletion,
    invalidateCompletion: useStableEvent(() => dropping.current?.completion.invalidate()),
  };
}

export function useLayerReordering(query: string, announce: (text: string) => void) {
  const store = useProjectStoreApi();
  const manager = useDragDropManager();
  const intent = useRef<Gesture | null>(null);
  const active = useRef<Gesture | null>(null);
  const retiredActivators = useRef(new WeakSet<Event>());
  const unsubscribe = useRef<(() => void) | null>(null);
  const capture = useStableEvent((sourceId: string, activator: Event | null): Gesture => {
    const state = store.getState();
    return { owner: captureLayerReorder(state.document.layers, state.documentEpoch, query, sourceId), activator };
  });
  const isCurrent = useStableEvent((gesture: Gesture) => {
    const state = store.getState();
    return isLayerReorderCurrent(gesture.owner, state.document.layers, state.documentEpoch, query);
  });
  const { completeDrop, disposeCompletion, invalidateCompletion } = useDropCompletion(manager, store, capture, isCurrent);

  const release = useStableEvent(() => {
    active.current = null;
    unsubscribe.current?.();
    unsubscribe.current = null;
  });
  const retireIntent = useStableEvent(() => {
    if (intent.current?.activator) retiredActivators.current.add(intent.current.activator);
    intent.current = null;
  });
  const cancel = useStableEvent((reason: string) => {
    const gesture = active.current;
    const hasIntent = intent.current !== null;
    retireIntent();
    if (gesture) gesture.isRetired = true;
    if (gesture || hasIntent) {
      announce(`Layer reorder canceled: ${reason}.`);
      stopLayerReorder(manager);
      if (active.current === gesture) release();
    }
    invalidateCompletion();
  });
  const move = useStableEvent((owner: LayerReorderOwner, visibleIndex: number) => moveLayer(store, owner, visibleIndex, announce));

  useDragDropMonitor({
    onBeforeDragStart(event) {
      disposeCompletion();
      const { source, activatorEvent } = event.operation;
      if (!isSortable(source)) return;
      const gesture = intent.current ?? capture(String(source.id), activatorEvent);
      if ((activatorEvent && retiredActivators.current.has(activatorEvent))
        || !isCurrent(gesture)
        || gesture.owner.sourceId !== String(source.id)
        || gesture.owner.visibleIds[source.index] !== String(source.id)) {
        event.preventDefault();
        retireIntent();
        announce('Layer reorder canceled: the layers, filter, or project changed. Try again.');
        return;
      }
      intent.current = gesture;
    },
    onDragStart(event) {
      const gesture = intent.current;
      intent.current = null;
      if (!gesture) {
        stopLayerReorder(manager);
        return;
      }
      active.current = { ...gesture, activator: event.operation.activatorEvent };
      unsubscribe.current = store.subscribe((state) => {
        if (state.documentEpoch !== gesture.owner.epoch) cancel('the project changed');
        else if (state.document.layers !== gesture.owner.layers) cancel('the layers changed');
      });
    },
    onDragEnd(event) {
      const gesture = active.current;
      if (!gesture || gesture.activator !== event.operation.activatorEvent) return;
      release();
      if (event.canceled) {
        if (!gesture.isRetired) announce('Layer reorder canceled. Layer order was not changed.');
      } else if (!isCurrent(gesture) || gesture.isRetired) {
        gesture.isRetired = true;
        announce('Layer reorder canceled: the layers, filter, or project changed. Try again.');
      } else {
        const { source } = event.operation;
        if (isSortable(source) && String(source.id) === gesture.owner.sourceId && source.index !== source.initialIndex) {
          move(gesture.owner, source.index);
        }
      }
      completeDrop(gesture, event);
    },
  });

  useReorderCleanup({ intent, cancel, retireIntent, release, disposeCompletion });

  const rememberIntent = (event: ReactPointerEvent<HTMLUListElement> | KeyboardEvent<HTMLUListElement>) => {
    if (!(event.target instanceof Element) || !manager?.dragOperation.status.idle) return;
    const handle = event.target.closest<HTMLButtonElement>('button.layer-drag');
    const sourceId = handle?.closest<HTMLElement>('[data-layer-id]')?.dataset.layerId;
    if (handle && sourceId && !handle.disabled) intent.current = capture(sourceId, event.nativeEvent);
  };
  return {
    cancel,
    isDragging: () => active.current !== null || (intent.current !== null && manager !== null && !manager.dragOperation.status.idle),
    onPointerDownCapture: (event: ReactPointerEvent<HTMLUListElement>) => {
      if (event.isPrimary && event.button === 0) rememberIntent(event);
    },
    onKeyDownCapture: (event: KeyboardEvent<HTMLUListElement>) => {
      if (!event.altKey && !event.ctrlKey && !event.metaKey && (event.key === ' ' || event.key === 'Enter')) rememberIntent(event);
    },
    moveByKeyboard: (sourceId: string, offset: number) => {
      const { owner } = capture(sourceId, null);
      const index = owner.visibleIds.indexOf(sourceId);
      if (index !== -1) move(owner, index + offset);
    },
  };
}
