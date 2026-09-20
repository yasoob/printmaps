import { createProjectStore } from '../../src/app/store';
import type { ContentLayer } from '../../src/domain/project';
import { parseProjectDocument } from '../../src/domain/projectFile';
import { studioProject } from '../fixtures/studio';

function silhouetteFixture() {
  const source = studioProject();
  const previous = source.layers.find(({ id }) => id === source.studio.poster.silhouetteLayerId)!;
  if (previous.appearance?.kind !== 'shape') throw new Error('Expected a shape fixture.');
  previous.appearance.invert = true;
  const silhouette: ContentLayer = {
    ...previous, id: 'next-country',
    geometry: { type: 'Polygon', coordinates: [[[20, 10], [21, 10], [21, 11], [20, 10]]] },
  };
  return { source, previous, silhouette };
}

it('replaces the active silhouette without stacking visible inverted masks or losing previous geography', () => {
  const { source, previous, silhouette } = silhouetteFixture();
  const store = createProjectStore(source);
  const before = store.getState().document;
  expect(store.getState().applyStudioTemplate({ poster: source.studio.poster, silhouette })).toEqual({ ok: true, changed: true });
  const applied = store.getState().document;
  expect(applied.studio.poster.silhouetteLayerId).toBe(silhouette.id);
  expect(applied.layers.find(({ id }) => id === previous.id)).toEqual({ ...previous, visible: false });
  expect(applied.layers.find(({ id }) => id === silhouette.id)?.visible).toBe(true);
  expect(applied.layers).toHaveLength(before.layers.length + 1);
  for (const layer of before.layers) {
    if (layer.id === previous.id) continue;
    expect(applied.layers.find(({ id }) => id === layer.id)).toBe(layer);
  }
  expect(store.getState().selectedId).toBe(silhouette.id);
  expect(store.getState().past).toHaveLength(1);
  expect(() => parseProjectDocument(applied)).not.toThrow();
  store.getState().undo();
  expect(store.getState().document).toEqual(before);
  store.getState().redo();
  expect(store.getState().document).toEqual(applied);
});

it('rejects replacement of a visible locked silhouette without a partial template, selection or history change', () => {
  const { source, previous, silhouette } = silhouetteFixture();
  previous.locked = true;
  const store = createProjectStore(source);
  store.getState().setProjectTitle('Temporary');
  store.getState().undo();
  store.getState().selectLayer(previous.id);
  const before = store.getState();
  const listener = vi.fn();
  store.subscribe(listener);
  expect(before.applyStudioTemplate({
    poster: { ...source.studio.poster, backgroundColor: '#101010' },
    camera: { ...before.document.camera, zoom: 12 }, silhouette,
  })).toMatchObject({ ok: false, code: 'unavailable', error: expect.stringContaining('Unlock or hide') });
  expect(store.getState()).toBe(before);
  expect(listener).not.toHaveBeenCalled();
});

it.each([false, true])('retains an already hidden previous silhouette unchanged (locked: %s)', (locked) => {
  const { source, previous, silhouette } = silhouetteFixture();
  previous.visible = false;
  previous.locked = locked;
  const store = createProjectStore(source);
  const storedPrevious = store.getState().document.layers.find(({ id }) => id === previous.id);
  expect(store.getState().applyStudioTemplate({ poster: source.studio.poster, silhouette })).toMatchObject({ ok: true });
  expect(store.getState().document.layers.find(({ id }) => id === previous.id)).toBe(storedPrevious);
  expect(store.getState().document.studio.poster.silhouetteLayerId).toBe(silhouette.id);
});

it('leaves the previous silhouette visible if admission rejects the incoming shape', () => {
  const { source, silhouette } = silhouetteFixture();
  silhouette.geometry = { type: 'Point', coordinates: [20, 10] };
  const store = createProjectStore(source);
  const before = store.getState();
  expect(before.applyStudioTemplate({ poster: source.studio.poster, silhouette })).toMatchObject({ ok: false });
  expect(store.getState()).toBe(before);
});

it('does not hide or reject a locked silhouette when a template changes only poster styling', () => {
  const { source, previous } = silhouetteFixture();
  previous.locked = true;
  const store = createProjectStore(source);
  const layers = store.getState().document.layers;
  expect(store.getState().applyStudioTemplate({
    poster: { ...source.studio.poster, backgroundColor: '#101010' },
  })).toMatchObject({ ok: true });
  expect(store.getState().document.layers).toBe(layers);
  expect(store.getState().document.studio.poster.silhouetteLayerId).toBe(previous.id);
});
