export function isInteractiveElement(element: HTMLElement | null): element is HTMLElement {
  if (!element?.isConnected
    || element.closest('[hidden], [inert], [aria-hidden="true"]')
    || element.matches(':disabled, [aria-disabled="true"], input[type="hidden"]')) return false;
  if (typeof element.checkVisibility === 'function') {
    return element.checkVisibility({ visibilityProperty: true });
  }
  for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
  }
  return true;
}

export function panelTabStops(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return [];
  return [...panel.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]')]
    .filter((element) => element.tabIndex >= 0 && isInteractiveElement(element));
}
