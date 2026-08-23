import { setMapInteractionLock } from '../../src/map/MapInteractionLock';

function createMapHarness() {
  const calls: string[] = [];
  const container = document.createElement('div');
  container.innerHTML = '<button class="maplibregl-ctrl-zoom-in"></button><button class="maplibregl-ctrl-zoom-out"></button>';
  const handler = (name: string) => ({
    disable: () => { calls.push(`${name}:disable`); },
    enable: () => { calls.push(`${name}:enable`); },
  });
  return {
    calls,
    map: {
      boxZoom: handler('boxZoom'),
      doubleClickZoom: handler('doubleClickZoom'),
      dragPan: handler('dragPan'),
      dragRotate: handler('dragRotate'),
      keyboard: handler('keyboard'),
      scrollZoom: handler('scrollZoom'),
      touchPitch: handler('touchPitch'),
      touchZoomRotate: handler('touchZoomRotate'),
      getContainer: () => container,
    },
    zoomButtons: [...container.querySelectorAll('button')],
  };
}

describe('map-area interaction lock', () => {
  it('disables every camera movement handler while locked and restores them when unlocked', () => {
    const { calls, map, zoomButtons } = createMapHarness();

    setMapInteractionLock(map, true);
    expect(zoomButtons.every((button) => button.disabled)).toBe(true);
    setMapInteractionLock(map, false);
    expect(zoomButtons.every((button) => !button.disabled)).toBe(true);

    expect(calls).toEqual([
      'boxZoom:disable',
      'doubleClickZoom:disable',
      'dragPan:disable',
      'dragRotate:disable',
      'keyboard:disable',
      'scrollZoom:disable',
      'touchPitch:disable',
      'touchZoomRotate:disable',
      'boxZoom:enable',
      'doubleClickZoom:enable',
      'dragPan:enable',
      'dragRotate:enable',
      'keyboard:enable',
      'scrollZoom:enable',
      'touchPitch:enable',
      'touchZoomRotate:enable',
    ]);
  });
});
