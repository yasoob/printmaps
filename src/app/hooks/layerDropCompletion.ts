import type { DragDropManager, DragEndEvent } from '@dnd-kit/react';
import { Feedback } from '@dnd-kit/dom';
import { DOMRectangle, getFinalKeyframe, parseTranslate, prefersReducedMotion } from '@dnd-kit/dom/utilities';
import { effect } from '@dnd-kit/state';

export type LayerDropCompletion = { invalidate: () => void; dispose: () => void };

type Options = {
  manager: DragDropManager;
  event: DragEndEvent;
  canRestoreFocus: () => boolean;
  onComplete: () => void;
};
const noop = () => {};

function animateDrop(manager: DragDropManager, source: DragEndEvent['operation']['source']): Animation | null {
  const overlay = manager.plugins.find((plugin) => plugin instanceof Feedback)?.overlay;
  const element = source?.element;
  if (!overlay || !element?.isConnected || typeof overlay.animate !== 'function') return null;
  const current = overlay.getBoundingClientRect();
  const destination = new DOMRectangle(element, { ignoreTransforms: true }).boundingRectangle;
  const translate = parseTranslate(getComputedStyle(overlay).translate) ?? { x: 0, y: 0 };
  getFinalKeyframe(overlay, (keyframe) => 'translate' in keyframe)?.[1].cancel();
  return overlay.animate({
    translate: [
      `${translate.x}px ${translate.y}px`,
      `${translate.x + destination.left - current.left}px ${translate.y + destination.top - current.top}px`,
    ],
  }, { duration: prefersReducedMotion(window) ? 0 : 250, easing: 'ease', fill: 'both' });
}

/**
 * Native dragend precedes animation/DOM cleanup. Own that interval via suspend/resume,
 * then restore focus only at native idle. The overlay opts out of the library's
 * duplicate animation, whose unconditional late focus callback has no owner guard.
 */
export function createLayerDropCompletion({ manager, event, canRestoreFocus, onComplete }: Options): LayerDropCompletion {
  const suspension = event.suspend();
  const source = event.operation.source;
  const handle = source?.handle;
  const ownerDocument = source?.element?.ownerDocument ?? document;
  const isKeyboard = event.operation.activatorEvent?.type === 'keydown';
  let isInvalid = isKeyboard && ownerDocument.activeElement !== ownerDocument.body && ownerDocument.activeElement !== handle;
  let isResuming = false;
  let isFinished = false;
  let animation: Animation | null = null;
  let stopObserving = noop;

  const finish = () => {
    if (isFinished) return;
    isFinished = true;
    stopObserving();
    ownerDocument.removeEventListener('focusin', focusChanged);
    animation?.cancel();
    const mayFocus = isKeyboard && !isInvalid && canRestoreFocus()
      && handle instanceof HTMLElement && handle.isConnected
      && (ownerDocument.activeElement === ownerDocument.body || ownerDocument.activeElement === handle);
    onComplete();
    if (mayFocus && ownerDocument.activeElement !== handle) handle.focus({ preventScroll: true });
  };
  const resume = () => {
    if (isFinished || isResuming) return;
    isResuming = true;
    suspension.resume();
  };
  const invalidate = () => {
    isInvalid = true;
    animation?.cancel();
    resume();
  };
  const focusChanged = (event: FocusEvent) => {
    if (event.target !== handle && event.target !== ownerDocument.body) invalidate();
  };
  ownerDocument.addEventListener('focusin', focusChanged);
  stopObserving = effect(() => {
    const isNativeIdle = manager.dragOperation.status.idle;
    if (isResuming && isNativeIdle) finish();
  });

  void manager.renderer.rendering.then(async () => {
    if (isInvalid || isFinished) {
      resume();
      return;
    }
    try {
      animation = animateDrop(manager, source);
      if (animation) await animation.finished;
    } catch {
      // A detached target or an ownership change can cancel the visual transition.
    } finally {
      resume();
    }
  });
  return {
    invalidate,
    dispose: () => {
      if (isFinished) return;
      isInvalid = true;
      animation?.cancel();
      suspension.abort();
      finish();
    },
  };
}
