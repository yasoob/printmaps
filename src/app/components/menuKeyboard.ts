export function focusFirstMenuItem(container: HTMLElement | null) {
  menuItems(container)[0]?.focus();
}

export function navigateMenu(event: KeyboardEvent, container: HTMLElement | null) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const items = menuItems(container);
  if (items.length === 0) return;
  event.preventDefault();
  const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
  if (event.key === 'Home') items[0]?.focus();
  else if (event.key === 'End') items.at(-1)?.focus();
  else {
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const start = currentIndex === -1 ? (direction > 0 ? -1 : 0) : currentIndex;
    items[(start + direction + items.length) % items.length]?.focus();
  }
}

function menuItems(container: HTMLElement | null): HTMLButtonElement[] {
  if (!container) return [];
  return [...container.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)')];
}
