import type { KeyboardEvent } from 'react';

const previousKeys = new Set(['ArrowLeft', 'ArrowUp']);
const nextKeys = new Set(['ArrowRight', 'ArrowDown']);

export function didHandleRovingSelection(event: KeyboardEvent<HTMLElement>, selector: string): boolean {
  if (!previousKeys.has(event.key) && !nextKeys.has(event.key) && event.key !== 'Home' && event.key !== 'End') return false;
  const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(selector)];
  if (items.length === 0) return false;
  const currentIndex = Math.max(0, items.indexOf(event.target as HTMLButtonElement));
  let nextIndex = currentIndex;
  if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = items.length - 1;
  else if (previousKeys.has(event.key)) nextIndex = (currentIndex - 1 + items.length) % items.length;
  else if (nextKeys.has(event.key)) nextIndex = (currentIndex + 1) % items.length;
  event.preventDefault();
  items[nextIndex]?.focus();
  items[nextIndex]?.click();
  return true;
}

// Home/End selection for radio groups whose arrow-key roving is owned by the primitive.
export function didHandleEdgeSelection(event: KeyboardEvent<HTMLElement>, selector = '[role="radio"]'): boolean {
  if (event.key !== 'Home' && event.key !== 'End') return false;
  const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(selector)].filter((item) => !item.disabled);
  const target = event.key === 'Home' ? items[0] : items.at(-1);
  if (!target) return false;
  event.preventDefault();
  target.focus();
  target.click();
  return true;
}
