import { useEffect } from "react";
import { isNativeActivationTarget, shouldBlockEditorShortcuts } from "../keyboardScope";

type ShapeDrawingKeyboardOptions = {
  active: boolean;
  isDrawing: boolean;
  isModalOpen: boolean;
  canFinish: boolean;
  canUndo: boolean;
  onClose: () => void;
  onFinish: () => void;
  onUndo: () => void;
};

function shouldIgnoreKey(event: KeyboardEvent, options: ShapeDrawingKeyboardOptions) {
  return !options.active || options.isModalOpen || event.defaultPrevented
    || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey;
}

function handleShapeKey(event: KeyboardEvent, options: ShapeDrawingKeyboardOptions) {
  if (shouldIgnoreKey(event, options)) return;
  const target = event.target;
  if (!(target instanceof HTMLElement) || shouldBlockEditorShortcuts(target)) return;
  if (event.key === "Escape") {
    event.preventDefault();
    options.onClose();
    return;
  }
  if (!options.isDrawing || isNativeActivationTarget(target)) return;
  if (event.key === "Enter" && options.canFinish) {
    event.preventDefault();
    options.onFinish();
  } else if (["Backspace", "Delete"].includes(event.key) && options.canUndo) {
    event.preventDefault();
    options.onUndo();
  }
}

export function useShapeDrawingKeyboard(options: ShapeDrawingKeyboardOptions) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleShapeKey(event, options);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [options]);
}
