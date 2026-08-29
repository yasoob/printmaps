export const MAP_STYLE_TIMEOUT_MS = 12_000;
export const MAP_READY_TIMEOUT_MS = 30_000;

export type MapLifecycleDeadlineState = {
  isDisposed: boolean;
  isMapLoaded: boolean;
  isStyleLoaded: boolean;
  startupTimeout: number | null;
};

export function clearLifecycleDeadline(state: MapLifecycleDeadlineState): void {
  if (state.startupTimeout === null) return;
  window.clearTimeout(state.startupTimeout);
  state.startupTimeout = null;
}

export function armLifecycleDeadline(
  state: MapLifecycleDeadlineState,
  callback: () => void,
  delay: number,
): void {
  clearLifecycleDeadline(state);
  state.startupTimeout = window.setTimeout(callback, delay);
}
