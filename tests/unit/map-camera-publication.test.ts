import { act, renderHook } from '@testing-library/react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createProjectStore } from '../../src/app/store';
import { createNewProjectDocument, type CameraSettings } from '../../src/domain/project';
import { useMapRendererRecovery } from '../../src/map/useMapRendererRecovery';
import type { CameraViewportPublication, MapCameraViewport } from '../../src/map/MapCameraViewport';

const motion: MapCameraViewport = {
  center: [17.123456789, 48.234567891], zoom: 12.987654321, bearing: 12.3456789, pitch: 8.7654321,
};
const roundedMotion: MapCameraViewport = {
  center: [17.123457, 48.234568], zoom: 12.987654, bearing: 12.345679, pitch: 8.765432,
};

function nativeMap(viewport: MapCameraViewport) {
  return {
    getCenter: () => ({ lng: viewport.center[0], lat: viewport.center[1] }),
    getZoom: () => viewport.zoom, getBearing: () => viewport.bearing, getPitch: () => viewport.pitch,
  } as unknown as MapLibreMap;
}

function harness() {
  const store = createProjectStore();
  const camera = { current: store.getState().document.camera };
  const map = { current: nativeMap(motion) as MapLibreMap | null };
  const onChange = vi.fn<NonNullable<CameraViewportPublication['cameraViewportChange']['current']>>((...args) => {
    return store.getState().setCameraViewport(...args);
  });
  const publication: CameraViewportPublication = {
    cameraViewportChange: { current: onChange }, cameraViewportChangeMode: { current: 'history' },
  };
  const unsubscribe = store.subscribe((state) => { camera.current = state.document.camera; });
  const view = renderHook(() => useMapRendererRecovery(map, camera, publication));
  return { store, camera, map, onChange, publication, view, unsubscribe };
}

it('publishes genuine interrupted motion once through canonical history across failed retries', () => {
  const { store, map, onChange, view, unsubscribe } = harness();
  const original = store.getState().document.camera;
  act(() => view.result.current.retryMap());
  expect(store.getState().document.camera).toEqual({ ...roundedMotion, locked: false });
  expect(store.getState().past).toHaveLength(1);
  expect(view.result.current.getInitialCamera()).toEqual(store.getState().document.camera);
  map.current = null;
  act(() => {
    view.result.current.retryMap();
    view.result.current.retryMap();
  });
  expect(onChange).toHaveBeenCalledExactlyOnceWith(roundedMotion.center, roundedMotion.zoom, 'history', {
    bearing: roundedMotion.bearing, pitch: roundedMotion.pitch,
  });
  expect(store.getState().past).toHaveLength(1);
  const recovered = view.result.current.getInitialCamera();
  map.current = nativeMap(recovered);
  view.result.current.onMapCreated();
  act(() => store.getState().undo());
  expect(store.getState().document.camera).toEqual(original);
  expect(store.getState().canUndo).toBe(false);
  expect(store.getState().canRedo).toBe(true);
  unsubscribe();
});

it('preserves document and both history stacks when retrying an equal viewport with native precision noise', () => {
  const { store, map, view, unsubscribe } = harness();
  store.getState().setProjectTitle('Redo me');
  store.getState().undo();
  const before = store.getState();
  const camera = before.document.camera;
  map.current = nativeMap({
    ...camera, center: [camera.center[0] + 1e-11, camera.center[1] + 1e-11], zoom: camera.zoom + 1e-11,
  });
  act(() => view.result.current.retryMap());
  expect(store.getState().document).toBe(before.document);
  expect(store.getState().past).toBe(before.past);
  expect(store.getState().future).toBe(before.future);
  expect(store.getState().canRedo).toBe(true);
  unsubscribe();
});

it('preserves the amend policy instead of adding a separate history operation', () => {
  const { store, publication, onChange, view, unsubscribe } = harness();
  store.getState().setProjectTitle('Operation with a fit');
  const past = store.getState().past;
  publication.cameraViewportChangeMode.current = 'amend';
  act(() => view.result.current.retryMap());
  expect(store.getState().document.camera).toEqual({ ...roundedMotion, locked: false });
  expect(store.getState().past).toBe(past);
  expect(onChange).toHaveBeenCalledWith(roundedMotion.center, roundedMotion.zoom, 'amend', expect.any(Object));
  expect(publication.cameraViewportChangeMode.current).toBe('history');
  unsubscribe();
});

it.each(['undo', 'edit', 'document'] as const)('does not overwrite a later %s with an obsolete recovery snapshot', (change) => {
  const { store, map, view, onChange, unsubscribe } = harness();
  act(() => view.result.current.retryMap());
  map.current = null;
  act(() => {
    if (change === 'undo') store.getState().undo();
    else if (change === 'edit') store.getState().setCameraBearing(45);
    else store.getState().openDocument(createNewProjectDocument());
  });
  const current = store.getState();
  act(() => view.result.current.retryMap());
  expect(view.result.current.getInitialCamera()).toEqual(current.document.camera);
  expect(store.getState()).toBe(current);
  expect(onChange).toHaveBeenCalledOnce();
  unsubscribe();
});

it('uses the latest lock without treating it as a changed viewport', () => {
  const { store, map, view, unsubscribe } = harness();
  act(() => view.result.current.retryMap());
  map.current = null;
  act(() => store.getState().setMapAreaLocked(true));
  const current: CameraSettings = store.getState().document.camera;
  act(() => view.result.current.retryMap());
  expect(view.result.current.getInitialCamera()).toEqual(current);
  expect(current).toEqual({ ...roundedMotion, locked: true });
  unsubscribe();
});

it('does not retain a rejected recovery viewport or poison later renderer generations', () => {
  const { camera, map, publication, view, store, unsubscribe } = harness();
  const before = store.getState();
  publication.cameraViewportChange.current = () => ({ ok: false, error: 'Portable project limit' });
  act(() => view.result.current.retryMap());
  expect(view.result.current.getInitialCamera()).toEqual(camera.current);
  expect(store.getState()).toBe(before);
  map.current = null;
  act(() => view.result.current.retryMap());
  expect(view.result.current.getInitialCamera()).toEqual(camera.current);
  expect(view.result.current.generation).toBe(2);
  unsubscribe();
});
