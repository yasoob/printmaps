export function shouldBlockEditorShortcuts(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
  ) !== null;
}

export function isNativeActivationTarget(target: HTMLElement): boolean {
  return target.closest('button, a, summary, [role="button"], [role="radio"], [role="tab"]') !== null;
}
