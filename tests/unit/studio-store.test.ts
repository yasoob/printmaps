import { createProjectStore, type ProjectState } from '../../src/app/store';
import { copyDocument } from '../../src/app/storeDocument';
import { createInitialProjectDocument, createNewProjectDocument } from '../../src/domain/project';
import { parseProjectDocument, parseProjectFileText } from '../../src/domain/projectFile';
import type { StudioSettings } from '../../src/domain/studio';
import * as photos from '../../src/domain/studioPhotoAssets';
import { byteBudgetProject } from '../fixtures/portableBudget';
import { photoAsset, photoPoi, studioProject } from '../fixtures/studio';

it('keeps settings isolated across defaults, stores, callers and clones', () => {
  const input = studioProject();
  const store = createProjectStore(input);
  const second = createProjectStore();
  const poster = structuredClone(input.studio.poster);
  poster.title.text = 'New display title';
  expect(store.getState().setStudioSection('poster', poster)).toEqual({ ok: true, changed: true });
  poster.title.text = 'Caller mutation';
  input.studio.photos.stops[0].caption = 'Caller photo mutation';
  expect(store.getState().document.studio.poster.title.text).toBe('New display title');
  expect(store.getState().document.studio.photos.stops[0].caption).toBe('A photo');
  expect(second.getState().document.studio).toEqual(createNewProjectDocument().studio);
  const cloned = copyDocument(store.getState().document);
  cloned.studio.terrain.contours.enabled = false;
  expect(store.getState().document.studio.terrain.contours.enabled).toBe(true);
  expect(Reflect.set(store.getState().document.studio.poster.title, 'text', 'No bypass')).toBe(false);
});

it('preserves unrelated section identity through camera edits, camera undo/redo and single-section mutations', () => {
  const store = createProjectStore(studioProject());
  const initial = store.getState().document;
  const parseAssets = vi.spyOn(photos, 'parsePhotoAssets');
  for (let index = 0; index < 5; index += 1) store.getState().setCameraBearing(index + 1);
  expect(store.getState().document.studio).toBe(initial.studio);
  store.getState().undo();
  expect(store.getState().document.studio).toBe(initial.studio);
  store.getState().redo();
  expect(store.getState().document.studio).toBe(initial.studio);
  expect(parseAssets).not.toHaveBeenCalled();
  const beforeWall = store.getState().document;
  store.getState().setStudioSection('wall', { ...initial.studio.wall, frame: 'oak' });
  const changed = store.getState().document;
  expect(changed.studio.wall).not.toBe(initial.studio.wall);
  for (const key of ['poster', 'photos', 'decorations', 'terrain', 'video', 'relief'] as const) {
    expect(changed.studio[key]).toBe(initial.studio[key]);
  }
  expect(changed.layers).toBe(beforeWall.layers);
  expect(changed.page).toBe(beforeWall.page);
  expect(changed.style).toBe(beforeWall.style);
  expect(parseAssets).not.toHaveBeenCalled();
  parseAssets.mockRestore();
});

it('treats value-equal section and template applications as no-ops without history or notifications', () => {
  const store = createProjectStore(studioProject());
  const before = store.getState();
  const listener = vi.fn();
  store.subscribe(listener);
  expect(before.setStudioSection('poster', structuredClone(before.document.studio.poster))).toEqual({ ok: true, changed: false });
  expect(before.applyStudioTemplate({
    poster: structuredClone(before.document.studio.poster),
    page: structuredClone(before.document.page), style: structuredClone(before.document.style), camera: structuredClone(before.document.camera),
  })).toEqual({ ok: true, changed: false });
  expect(store.getState()).toBe(before);
  expect(listener).not.toHaveBeenCalled();
});

it('atomically applies a new silhouette, composition, page, style and camera in one undoable entry', () => {
  const store = createProjectStore(createInitialProjectDocument());
  const before = store.getState().document;
  const silhouette = { ...before.layers.find(({ type }) => type === 'shape')!, id: 'new-silhouette', locked: true };
  const poster = { ...before.studio.poster, enabled: true, templateId: 'silhouette' as const };
  const camera = { ...before.camera, center: [10, 20] as [number, number], zoom: 12 };
  expect(store.getState().applyStudioTemplate({
    poster, silhouette, page: { preset: 'A4', widthMm: 210, heightMm: 297, orientation: 'portrait' },
    style: { ...before.style, preset: 'blueprint' }, camera, expectedDocumentEpoch: 0,
  })).toEqual({ ok: true, changed: true });
  const applied = store.getState().document;
  expect(store.getState().past).toHaveLength(1);
  expect(applied.studio.poster.silhouetteLayerId).toBe(silhouette.id);
  expect(applied.title).toBe(before.title);
  expect(applied.layers.slice(0, -2)).toEqual(before.layers.slice(0, -1));
  expect(applied.layers.at(-1)?.name).toBe('Blueprint basemap');
  expect(applied.studio.photos).toBe(before.studio.photos);
  camera.center[0] = 99;
  poster.enabled = false;
  expect(applied.camera.center).toEqual([10, 20]);
  expect(applied.studio.poster.enabled).toBe(true);
  store.getState().undo();
  expect(store.getState().document).toEqual(before);
  store.getState().redo();
  expect(store.getState().document).toEqual(applied);
});

const invalidMutations: [string, (state: ProjectState) => { ok: boolean }][] = [
  ['nested non-finite setting', (state) => state.setStudioSection('terrain', { ...state.document.studio.terrain, contours: { ...state.document.studio.terrain.contours, intervalMeters: NaN } })],
  ['dangling silhouette', (state) => state.setStudioSection('poster', { ...state.document.studio.poster, silhouetteLayerId: 'missing' })],
  ['bad page template', (state) => state.applyStudioTemplate({ poster: { ...state.document.studio.poster, enabled: true }, page: { ...state.document.page, widthMm: 123 } })],
  ['duplicate silhouette', (state) => state.applyStudioTemplate({ poster: state.document.studio.poster, silhouette: state.document.layers[2] })],
  ['basemap silhouette', (state) => state.applyStudioTemplate({ poster: state.document.studio.poster, silhouette: { ...state.document.layers.at(-1)!, id: 'invalid-base' } })],
  ['stale template', (state) => state.applyStudioTemplate({ poster: state.document.studio.poster, expectedDocumentEpoch: 99 })],
  ['missing photo stop', (state) => state.removePhotoStop('missing')],
  ['stale photo', (state) => {
    const asset = photoAsset();
    return state.addPhotoStop({ stop: { id: 'added', assetId: asset.id, layerId: 'poi-cafe', caption: '' }, asset, expectedDocumentEpoch: 99 });
  }],
  ['unsafe photo', (state) => {
    const asset = { ...photoAsset(), dataUri: 'https://example.test/image.png' };
    return state.addPhotoStop({ stop: { id: 'added', assetId: asset.id, layerId: 'poi-cafe', caption: '' }, asset });
  }],
];

it.each(invalidMutations)('rejects %s atomically with redo, selection and subscribers untouched', (_label, mutate) => {
  const store = createProjectStore(createInitialProjectDocument());
  store.getState().setProjectTitle('Temporary');
  store.getState().undo();
  store.getState().selectLayer('poi-cafe');
  const before = store.getState();
  const listener = vi.fn();
  store.subscribe(listener);
  expect(mutate(before)).toMatchObject({ ok: false });
  expect(store.getState()).toBe(before);
  expect(store.getState().past).toBe(before.past);
  expect(store.getState().future).toBe(before.future);
  expect(listener).not.toHaveBeenCalled();
});

it('atomically inserts and removes photo assets/stops, leaving geography canonical and pruning only unused images', () => {
  const store = createProjectStore();
  const before = store.getState().document;
  const asset = photoAsset();
  const poi = photoPoi();
  const stop = { id: 'first', assetId: asset.id, layerId: poi.id, caption: 'First caption' };
  expect(store.getState().addPhotoStop({ stop, asset, poi, expectedDocumentEpoch: 0 })).toMatchObject({ ok: true });
  expect(store.getState().past).toHaveLength(1);
  const inserted = store.getState().document;
  expect(inserted.studio.photos.stops[0]).toEqual(stop);
  expect('coordinate' in inserted.studio.photos.stops[0]).toBe(false);
  stop.caption = 'Caller mutation';
  expect(inserted.studio.photos.stops[0].caption).toBe('First caption');
  store.getState().undo();
  expect(store.getState().document).toEqual(before);
  store.getState().redo();
  expect(store.getState().document).toEqual(inserted);
  expect(store.getState().addPhotoStop({ stop: { ...stop, id: 'second' }, asset })).toMatchObject({ ok: true });
  expect(store.getState().removePhotoStop('first')).toMatchObject({ ok: true });
  expect(Object.keys(store.getState().document.studio.photos.assets)).toEqual([asset.id]);
  expect(store.getState().removePhotoStop('second')).toMatchObject({ ok: true });
  expect(store.getState().document.studio.photos.assets).toEqual({});
  expect(store.getState().document.layers.some(({ id }) => id === poi.id)).toBe(true);
});

it('keeps hidden photo references intact and cleans deleted layer references in the same undoable entry', () => {
  const store = createProjectStore(studioProject());
  const initial = store.getState().document;
  store.getState().toggleLayerVisibility('poi-cafe');
  expect(store.getState().document.studio).toBe(initial.studio);
  store.getState().deleteLayer('poi-cafe');
  const removed = store.getState().document;
  expect(removed.studio.photos.stops).toEqual([]);
  expect(removed.studio.photos.assets).toEqual({});
  expect(removed.studio.decorations.qr).toMatchObject({ enabled: false, target: 'map-center', layerId: null });
  expect(() => parseProjectFileText(JSON.stringify(removed))).not.toThrow();
  store.getState().undo();
  expect(store.getState().document.studio).toEqual(initial.studio);
  store.getState().deleteLayer('area-center');
  expect(store.getState().document.studio.poster.silhouetteLayerId).toBeNull();
  store.getState().deleteLayer('route-01');
  expect(store.getState().document.studio.relief.routeRidge).toMatchObject({ enabled: false, layerId: null });
  expect(() => parseProjectDocument(store.getState().document)).not.toThrow();
});

it('enforces the exact 10 MiB aggregate budget for settings, templates and photos without partial commits', () => {
  const store = createProjectStore(byteBudgetProject());
  const before = store.getState();
  const poster = { ...before.document.studio.poster, title: { ...before.document.studio.poster.title, text: 'Additional poster text' } };
  const asset = photoAsset();
  expect(before.setStudioSection('poster', poster)).toMatchObject({ ok: false, code: 'capacity' });
  expect(before.applyStudioTemplate({ poster, camera: { ...before.document.camera, pitch: 20 } })).toMatchObject({ ok: false, code: 'capacity' });
  expect(before.addPhotoStop({ asset, stop: { id: 'added', assetId: asset.id, layerId: 'marker-5', caption: '' } })).toMatchObject({ ok: false, code: 'capacity' });
  expect(store.getState()).toBe(before);
}, 30_000);

it('enforces stop and layer capacities without orphaning assets or inserting a partial POI', () => {
  const store = createProjectStore(createInitialProjectDocument());
  const asset = photoAsset();
  for (let index = 0; index < 24; index += 1) {
    expect(store.getState().addPhotoStop({ asset, stop: { id: `photo-${index}`, assetId: asset.id, layerId: 'poi-cafe', caption: '' } })).toMatchObject({ ok: true });
  }
  const before = store.getState();
  expect(before.addPhotoStop({ asset, poi: photoPoi(), stop: { id: 'extra', assetId: asset.id, layerId: 'photo-place', caption: '' } })).toMatchObject({ ok: false });
  expect(store.getState()).toBe(before);
  const full = createNewProjectDocument();
  full.layers.unshift(...Array.from({ length: 999 }, (_, index) => photoPoi(`poi-${index}`)));
  const fullStore = createProjectStore(full);
  const fullBefore = fullStore.getState();
  expect(fullBefore.addPhotoStop({ asset, poi: photoPoi(), stop: { id: 'extra', assetId: asset.id, layerId: 'photo-place', caption: '' } })).toMatchObject({ ok: false, code: 'capacity' });
  expect(fullStore.getState()).toBe(fullBefore);
});

it('rejects malformed section objects even when their enumerable values appear unchanged', () => {
  const store = createProjectStore();
  const before = store.getState();
  const malformed = { ...before.document.studio.photos, assets: new Date() };
  // Simulate an untyped client at the store boundary.
  const result = before.setStudioSection('photos', malformed as unknown as StudioSettings['photos']);
  expect(result).toMatchObject({ ok: false });
  expect(store.getState()).toBe(before);
});
