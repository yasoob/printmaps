import { act, renderHook, waitFor } from '@testing-library/react';
import { TerraDraw, TerraDrawExtend, TerraDrawLineStringMode, TerraDrawSelectMode } from 'terra-draw';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createProjectStore } from '../../src/app/store';
import { createDefaultRouteAppearance, createNewProjectDocument } from '../../src/domain/project';
import { useTerraDrawRoutes } from '../../src/map/useTerraDrawRoutes';
import type { TerraRouteDrawLike } from '../../src/map/TerraDrawRouteEditing';

// Only map projection/rendering is stubbed; pointer routing and selection are installed Terra Draw.
class NativePointerAdapter extends TerraDrawExtend.TerraDrawBaseAdapter {
  private callbacks?: TerraDrawExtend.TerraDrawCallbacks;
  private readonly initialDrag: boolean;
  constructor(private readonly map: MapLibreMap) {
    super({ coordinatePrecision: 6, ignoreMismatchedPointerEvents: true, minPixelDragDistance: 3 });
    this.initialDrag = map.dragPan.isEnabled();
  }
  register(callbacks: TerraDrawExtend.TerraDrawCallbacks) { this.callbacks = callbacks; super.register(callbacks); }
  getMapEventElement() { return this.map.getCanvas(); }
  clear() { this.callbacks?.onClear(); }
  project(lng: number, lat: number) { return { x: lng * 100, y: lat * 100 }; }
  unproject(x: number, y: number) { return { lng: x / 100, lat: y / 100 }; }
  getLngLatFromEvent(event: PointerEvent | MouseEvent) { return this.unproject(event.clientX, event.clientY); }
  setDraggability(isEnabled: boolean) { if (this.initialDrag) this.map.dragPan[isEnabled ? 'enable' : 'disable'](); }
  setDoubleClickToZoom() {}
  setCursor() {}
  render() {}
}

function mapHarness(isLocked: boolean) {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const handlers = Object.fromEntries([
    'boxZoom', 'doubleClickZoom', 'dragPan', 'dragRotate', 'keyboard', 'scrollZoom', 'touchPitch', 'touchZoomRotate',
  ].map((name) => {
    let isEnabled = !isLocked;
    return [name, { enable: () => { isEnabled = true; }, disable: () => { isEnabled = false; }, isEnabled: () => isEnabled }];
  }));
  return { canvas, map: { ...handlers, getCanvas: () => canvas, getContainer: () => canvas } as unknown as MapLibreMap };
}

function pointer(
  canvas: HTMLElement, type: string, [x, y]: [number, number],
  { pointerType = 'mouse', pointerId = 1, isPrimary = true }: { pointerType?: string; pointerId?: number; isPrimary?: boolean } = {},
) {
  act(() => canvas.dispatchEvent(Object.assign(new MouseEvent(type, {
    bubbles: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1,
  }), { pointerId, pointerType, isPrimary })));
}

async function harness(isLocked = false) {
  const { map, canvas } = mapHarness(isLocked);
  const document = createNewProjectDocument();
  document.camera.locked = isLocked;
  document.layers.unshift({
    id: 'route-01', name: 'Closed route', type: 'route', visible: true, locked: false, opacity: 100,
    route: { kind: 'straight', closed: true },
    geometry: { type: 'LineString', coordinates: [[0, 0], [2, 2], [4, 0], [0, 0]] },
    appearance: { ...createDefaultRouteAppearance(3), segmentStyles: [
      { color: '#ff0000', width: 7, strokeStyle: 'dashed' },
      { color: '#00aa00', width: 3, strokeStyle: 'solid' },
      { color: '#0000ff', width: 5, strokeStyle: 'dashed' },
    ] },
  });
  const store = createProjectStore(document);
  store.getState().selectLayer('route-01');
  store.getState().renameLayer('route-01', 'Redo preserved');
  store.getState().undo();
  const draws: TerraDraw[] = [];
  const createDraw = vi.fn(() => {
    const draw = new TerraDraw({ adapter: new NativePointerAdapter(map), modes: [
      new TerraDrawLineStringMode(),
      new TerraDrawSelectMode({ pointerDistance: 22, flags: { linestring: {
        feature: { coordinates: { draggable: true, deletable: true, midpoints: { draggable: true } } },
      } } }),
    ] });
    draws.push(draw);
    return draw as unknown as TerraRouteDrawLike;
  });
  const onRoutePreview = vi.fn();
  const onRouteGeometryChange = vi.fn((id: string, points: readonly (readonly [number, number])[]) =>
    store.getState().replaceRouteGeometry(id, points));
  const loadRouteEditor = async () => ({ createTerraRouteDraw: createDraw });
  const hook = renderHook(({ layers, locked }) => useTerraDrawRoutes({
    layers, isMapAreaLocked: locked, map, selectedId: 'route-01',
    onRoutePreview, onRouteGeometryChange, loadRouteEditor,
  }), { initialProps: { layers: store.getState().document.layers, locked: isLocked } });
  await waitFor(() => expect(draws).toHaveLength(1));
  const nativeGeometry = () => draws.at(-1)!.getSnapshot().find((feature) => feature.geometry.type === 'LineString')!.geometry;
  return { ...hook, store, draws, nativeGeometry, map, canvas, onRoutePreview, onRouteGeometryChange };
}

it.each([
  { pointerType: 'mouse', isMidpoint: true },
  { pointerType: 'touch', isMidpoint: true },
  { pointerType: 'mouse', isMidpoint: false },
])('rolls back native $pointerType midpoint=$isMidpoint and cannot commit canceled work with the next drag', async ({ pointerType, isMidpoint }) => {
  const test = await harness();
  const before = test.store.getState();
  const writes = vi.fn();
  const unsubscribe = test.store.subscribe(writes);
  const [x, y] = isMidpoint ? [100, 100] : [200, 200];
  pointer(test.canvas, 'pointermove', [x, y], { pointerType });
  pointer(test.canvas, 'pointerdown', [x, y], { pointerType });
  pointer(test.canvas, 'pointermove', [x + 5, y], { pointerType });
  pointer(test.canvas, 'pointermove', [x + 15, y + 10], { pointerType });
  expect(test.nativeGeometry().coordinates).toHaveLength(isMidpoint ? 5 : 4);
  expect(test.nativeGeometry()).not.toEqual(before.document.layers[0].geometry);
  expect(test.onRouteGeometryChange).not.toHaveBeenCalled();
  pointer(test.canvas, 'pointerdown', [120, 120], { pointerType, pointerId: 2, isPrimary: false });
  pointer(test.canvas, 'pointercancel', [120, 120], { pointerType, pointerId: 2, isPrimary: false });
  pointer(test.canvas, 'pointerup', [120, 120], { pointerType, pointerId: 2, isPrimary: false });
  expect(test.draws).toHaveLength(1);
  pointer(test.canvas, 'pointercancel', [115, 110], { pointerType });
  expect(test.draws).toHaveLength(2);
  expect(test.nativeGeometry()).toEqual(before.document.layers[0].geometry);
  expect(test.onRoutePreview).toHaveBeenLastCalledWith('route-01', null);
  pointer(test.canvas, 'pointerup', [115, 110], { pointerType });
  expect(test.store.getState()).toBe(before);
  expect(writes).not.toHaveBeenCalled();
  expect(test.onRouteGeometryChange).not.toHaveBeenCalled();
  expect(test.map.dragPan.isEnabled()).toBe(true);
  pointer(test.canvas, 'pointermove', [200, 200], { pointerType });
  pointer(test.canvas, 'pointerdown', [200, 200], { pointerType });
  pointer(test.canvas, 'pointermove', [205, 200], { pointerType });
  pointer(test.canvas, 'pointermove', [220, 215], { pointerType });
  pointer(test.canvas, 'pointerup', [220, 215], { pointerType });
  expect(test.onRouteGeometryChange).toHaveBeenCalledOnce();
  const after = test.store.getState().document;
  expect(after.layers[0].geometry).toEqual({
    type: 'LineString', coordinates: [[0, 0], [2.2, 2.15], [4, 0], [0, 0]],
  });
  expect(after.layers[0].appearance).toBe(before.document.layers[0].appearance);
  expect(after.camera).toBe(before.document.camera);
  test.store.getState().undo();
  expect(test.store.getState().document).toEqual(before.document);
  test.store.getState().redo();
  expect(test.store.getState().document).toEqual(after);
  unsubscribe(); test.unmount(); test.canvas.remove();
});

it('cancels against the latest canonical geometry, appearance and lock rather than the session opening snapshot', async () => {
  const test = await harness();
  pointer(test.canvas, 'pointermove', [100, 100]);
  pointer(test.canvas, 'pointerdown', [100, 100]);
  pointer(test.canvas, 'pointermove', [105, 100]);
  pointer(test.canvas, 'pointermove', [115, 110]);
  test.store.getState().setRouteVertex('route-01', 2, [4.5, 0.2]);
  test.store.getState().setRouteSegmentStyle('route-01', 0, { color: '#123456', width: 9 });
  test.store.getState().setMapAreaLocked(true);
  const before = test.store.getState();
  test.rerender({ layers: before.document.layers, locked: true });
  const writes = vi.fn();
  const unsubscribe = test.store.subscribe(writes);
  pointer(test.canvas, 'pointercancel', [115, 110]);
  pointer(test.canvas, 'pointerup', [115, 110]);
  expect(test.nativeGeometry()).toEqual(before.document.layers[0].geometry);
  expect(test.store.getState()).toBe(before);
  expect(writes).not.toHaveBeenCalled();
  expect(test.map.dragPan.isEnabled()).toBe(false);
  expect(test.map.keyboard.isEnabled()).toBe(false);
  expect(test.onRouteGeometryChange).not.toHaveBeenCalled();
  unsubscribe(); test.unmount(); test.canvas.remove();
});

it.each(['click', 'drag'] as const)('still commits a valid native midpoint %s exactly once', async (gesture) => {
  const test = await harness();
  const before = test.store.getState().document;
  pointer(test.canvas, 'pointermove', [100, 100]);
  pointer(test.canvas, 'pointerdown', [100, 100]);
  if (gesture === 'drag') {
    pointer(test.canvas, 'pointermove', [105, 100]);
    pointer(test.canvas, 'pointermove', [115, 110]);
  }
  pointer(test.canvas, 'pointerup', gesture === 'drag' ? [115, 110] : [100, 100]);
  expect(test.draws).toHaveLength(1);
  expect(test.onRouteGeometryChange).toHaveBeenCalledOnce();
  const after = test.store.getState().document;
  expect(after.layers[0].geometry).toMatchObject({ coordinates: expect.any(Array) });
  expect(test.nativeGeometry().coordinates).toHaveLength(5);
  expect(after.layers[0].appearance).toMatchObject({ segmentStyles: [
    { color: '#ff0000', width: 7, strokeStyle: 'dashed' },
    { color: '#ff0000', width: 7, strokeStyle: 'dashed' },
    { color: '#00aa00', width: 3, strokeStyle: 'solid' },
    { color: '#0000ff', width: 5, strokeStyle: 'dashed' },
  ] });
  test.store.getState().undo();
  expect(test.store.getState().document).toEqual(before);
  test.store.getState().redo();
  expect(test.store.getState().document).toEqual(after);
  test.unmount(); test.canvas.remove();
});

it.each(['unmount', 'context-loss'] as const)('cannot restart or commit a canceled native gesture after %s', async (boundary) => {
  const test = await harness();
  pointer(test.canvas, 'pointermove', [100, 100]);
  pointer(test.canvas, 'pointerdown', [100, 100]);
  pointer(test.canvas, 'pointermove', [105, 100]);
  const before = test.store.getState();
  if (boundary === 'unmount') test.unmount();
  else act(() => test.canvas.dispatchEvent(new Event('webglcontextlost')));
  pointer(test.canvas, 'pointercancel', [105, 100]);
  pointer(test.canvas, 'pointerup', [105, 100]);
  expect(test.draws).toHaveLength(1);
  expect(test.onRouteGeometryChange).not.toHaveBeenCalled();
  expect(test.onRoutePreview).toHaveBeenLastCalledWith('route-01', null);
  expect(test.store.getState()).toBe(before);
  test.unmount(); test.canvas.remove();
});
