import { useSyncExternalStore } from 'react';

const SHORT_VIEWPORT = '(max-height: 480px)';
const isShortViewport = () => typeof window.matchMedia === 'function' && window.matchMedia(SHORT_VIEWPORT).matches;
function subscribe(changed: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(SHORT_VIEWPORT);
  query.addEventListener('change', changed);
  return () => query.removeEventListener('change', changed);
}

export function usePoiSpreadsheetSurface() {
  return useSyncExternalStore(subscribe, isShortViewport, () => false);
}
