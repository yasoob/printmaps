type InteractionHandler = {
  disable: () => void;
  enable: () => void;
};

export type MapInteractionHandlers = {
  boxZoom: InteractionHandler;
  doubleClickZoom: InteractionHandler;
  dragPan: InteractionHandler;
  dragRotate: InteractionHandler;
  keyboard: InteractionHandler;
  scrollZoom: InteractionHandler;
  touchPitch: InteractionHandler;
  touchZoomRotate: InteractionHandler;
  getContainer: () => HTMLElement;
};

export function setMapInteractionLock(map: MapInteractionHandlers, isLocked: boolean): void {
  const action = isLocked ? 'disable' : 'enable';
  map.boxZoom[action]();
  map.doubleClickZoom[action]();
  map.dragPan[action]();
  map.dragRotate[action]();
  map.keyboard[action]();
  map.scrollZoom[action]();
  map.touchPitch[action]();
  map.touchZoomRotate[action]();
  const zoomButtons = map.getContainer().querySelectorAll<HTMLButtonElement>(
    '.maplibregl-ctrl-zoom-in, .maplibregl-ctrl-zoom-out',
  );
  for (const button of zoomButtons) button.disabled = isLocked;
}
