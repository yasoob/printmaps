import { act, renderHook } from '@testing-library/react';
import { useEffect } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { CameraSettings, ContentLayer } from '../../src/domain/project';
import { useMapRendererRecovery } from '../../src/map/useMapRendererRecovery';
import { useMapLocationRequest } from '../../src/map/useMapLocationRequest';
import { useMapFitRequests } from '../../src/map/useMapFitRequests';
import { useMapCameraSynchronization } from '../../src/map/useMapCameraSynchronization';
import { useMapReadyInstance } from '../../src/map/useMapReadyInstance';

vi.mock('../../src/map/MapInteractionLock', () => ({ setMapInteractionLock: vi.fn() }));

function nativeMap() {
  return {
    getCenter: () => ({ lng: 17.2, lat: 49.3 }), getZoom: () => 12.4,
    getBearing: () => 15, getPitch: () => 20,
    easeTo: vi.fn(), fitBounds: vi.fn(), jumpTo: vi.fn(),
  };
}

const camera: CameraSettings = { center: [16.37, 48.21], zoom: 11, bearing: 0, pitch: 0, locked: false };
const layers: ContentLayer[] = [{
  id: 'route', type: 'route', name: 'Route', visible: true, locked: false, opacity: 100,
  geometry: { type: 'LineString', coordinates: [[16.35, 48.2], [16.38, 48.22]] },
}];

it('captures the actual live camera and never replays previously applied location, fit, layer or import commands', () => {
  const original = nativeMap();
  const map = { current: original as unknown as MapLibreMap };
  const cameraRef = { current: camera };
  const container = { current: document.createElement('div') };
  const cameraViewportChangeMode = { current: 'history' as const };
  const onApplied = vi.fn();
  const view = renderHook(({ boundMap, locationRequest }) => {
    const recovery = useMapRendererRecovery(map, cameraRef);
    useMapCameraSynchronization({ camera, container, map, instance: boundMap.current, stylePreset: 'paper' });
    useMapLocationRequest({
      container, map: boundMap, stylePreset: 'paper',
      locationRequest: { coordinate: [16.37, 48.21], request: locationRequest, onApplied },
    });
    useMapFitRequests({
      camera, cameraViewportChangeMode, container, map: boundMap, layers,
      fitRequest: 1, fitLayerRequest: 1, fitLayerId: 'route', fitImportRequest: 1,
      fitImportBounds: [[16.35, 48.2], [16.38, 48.22]],
    });
    return recovery;
  }, { initialProps: { boundMap: { current: map.current }, locationRequest: 1 } });

  expect(original.easeTo).toHaveBeenCalledOnce();
  expect(original.fitBounds).toHaveBeenCalledTimes(3);
  act(() => view.result.current.retryMap());
  expect(view.result.current.generation).toBe(1);
  expect(view.result.current.getInitialCamera()).toEqual({
    center: [17.2, 49.3], zoom: 12.4, bearing: 15, pitch: 20, locked: false,
  });

  const replacement = nativeMap();
  map.current = replacement as unknown as MapLibreMap;
  view.result.current.onMapCreated();
  expect(view.result.current.getInitialCamera()).toEqual(camera);
  view.rerender({ boundMap: { current: map.current }, locationRequest: 1 });
  expect(replacement.easeTo).not.toHaveBeenCalled();
  expect(replacement.fitBounds).not.toHaveBeenCalled();
  expect(replacement.jumpTo).not.toHaveBeenCalled();
  expect(onApplied).toHaveBeenCalledOnce();
  view.rerender({ boundMap: { current: map.current }, locationRequest: 2 });
  expect(replacement.easeTo).toHaveBeenCalledOnce();
  expect(onApplied).toHaveBeenCalledTimes(2);
});

it('falls back to canonical camera state when a destroyed renderer cannot report its camera', () => {
  const map = { current: { getCenter: () => { throw new Error('Destroyed'); } } as unknown as MapLibreMap };
  const { result } = renderHook(() => useMapRendererRecovery(map, { current: camera }));
  act(() => result.current.retryMap());
  expect(result.current.getInitialCamera()).toEqual(camera);
});

it('retains the actual camera across failed creations and reads the latest lock independently', () => {
  const map = { current: nativeMap() as unknown as MapLibreMap | null };
  const cameraRef = { current: camera };
  const { result } = renderHook(() => useMapRendererRecovery(map, cameraRef));
  act(() => result.current.retryMap());
  const captured = result.current.getInitialCamera();
  expect(captured).toEqual({ center: [17.2, 49.3], zoom: 12.4, bearing: 15, pitch: 20, locked: false });
  expect(result.current.getInitialCamera()).toEqual(captured);
  map.current = null;
  cameraRef.current = { ...camera, locked: true };
  act(() => result.current.retryMap());
  expect(result.current.getInitialCamera()).toEqual({ ...captured, locked: true });
  act(() => result.current.retryMap());
  expect(result.current.getInitialCamera()).toEqual({ ...captured, locked: true });
  map.current = nativeMap() as unknown as MapLibreMap;
  result.current.onMapCreated();
  expect(result.current.getInitialCamera()).toEqual(cameraRef.current);
});

it('does not erase a captured camera when a later attempt cannot read the old renderer', () => {
  const map = { current: nativeMap() as unknown as MapLibreMap };
  const { result } = renderHook(() => useMapRendererRecovery(map, { current: camera }));
  act(() => result.current.retryMap());
  const captured = result.current.getInitialCamera();
  map.current = { getCenter: () => { throw new Error('Destroyed'); } } as unknown as MapLibreMap;
  act(() => result.current.retryMap());
  expect(result.current.getInitialCamera()).toEqual(captured);
});

it('detaches controllers before native teardown and ignores publications from retired lifetimes', () => {
  const cleanup: string[] = [];
  const view = renderHook(({ scope }) => {
    const instance = useMapReadyInstance(scope);
    const { setMap } = instance;
    useEffect(() => instance.map ? () => { cleanup.push('controller'); } : undefined, [instance.map]);
    useEffect(() => {
      setMap(nativeMap() as unknown as MapLibreMap);
      return () => { cleanup.push('renderer'); };
    }, [setMap]);
    return instance;
  }, { initialProps: { scope: 'paper:0' } });
  const original = view.result.current.map;
  const retiredPublish = view.result.current.setMap;
  view.rerender({ scope: 'paper:1' });
  expect(cleanup).toEqual(['controller', 'renderer']);
  expect(view.result.current.map).not.toBe(original);
  const replacement = view.result.current.map;
  act(() => retiredPublish(original));
  expect(view.result.current.map).toBe(replacement);
  view.rerender({ scope: 'voyager:1' });
  expect(cleanup).toEqual(['controller', 'renderer', 'controller', 'renderer']);
});
