import { IDBFactory } from 'fake-indexeddb';
import { createProjectStore } from '../../src/app/store';
import { createNewProjectDocument } from '../../src/domain/project';
import { createProjectArchive, parseProjectArchive } from '../../src/domain/projectArchive';
import { parseProjectFileText } from '../../src/domain/projectFile';
import { portableProjectText } from '../../src/domain/projectSerialization';
import { isPristineProjectDocument } from '../../src/domain/pristineProject';
import { createIndexedDbAutosaveRepository } from '../../src/storage/autosave';
import { AutosavePersistenceSession } from '../../src/storage/AutosavePersistenceSession';
import { studioProject } from '../fixtures/studio';

it('retains all studio settings and embedded photos in JSON, ZIP, open and undo/redo', () => {
  const source = studioProject();
  const json = parseProjectFileText(portableProjectText(source));
  const archived = parseProjectArchive(createProjectArchive(json));
  expect(archived).toEqual(source);
  const store = createProjectStore();
  expect(store.getState().openDocument(archived)).toMatchObject({ ok: true });
  expect(store.getState().document).toEqual(source);
  expect(store.getState().documentEpoch).toBe(1);
  expect(store.getState().past).toEqual([]);
  const updated = { ...source.studio.video, fps: 30 as const };
  store.getState().setStudioSection('video', updated);
  store.getState().undo();
  expect(store.getState().document).toEqual(source);
  store.getState().redo();
  expect(store.getState().document.studio.video).toEqual(updated);
  expect(store.getState().document.studio.photos).toEqual(source.studio.photos);
});

it('counts studio-only edits as work worth protecting, while defaults remain pristine', () => {
  const store = createProjectStore();
  expect(isPristineProjectDocument(store.getState().document)).toBe(true);
  store.getState().setStudioSection('video', { ...store.getState().document.studio.video, motion: 'sway' });
  expect(isPristineProjectDocument(store.getState().document)).toBe(false);
  store.getState().undo();
  expect(isPristineProjectDocument(store.getState().document)).toBe(true);
});

it.each([24, 25])('normalizes a directly opened schema %i document before copying or publishing it', (schemaVersion) => {
  const legacy = createNewProjectDocument();
  Reflect.set(legacy, 'schemaVersion', schemaVersion);
  Reflect.deleteProperty(legacy, 'studio');
  if (schemaVersion === 24) Reflect.deleteProperty(legacy.style, 'customization');
  const store = createProjectStore(studioProject());
  expect(store.getState().openDocument(legacy)).toMatchObject({ ok: true });
  expect(store.getState().document).toEqual(createNewProjectDocument());
  expect(store.getState().documentEpoch).toBe(1);
  expect(store.getState().past).toEqual([]);
});

it('rejects a malformed legacy open without changing the epoch, document or history', () => {
  const legacy = studioProject();
  Reflect.set(legacy, 'schemaVersion', 25);
  legacy.studio.terrain.exaggeration = Infinity;
  const store = createProjectStore();
  store.getState().setProjectTitle('Current work');
  const before = store.getState();
  expect(before.openDocument(legacy)).toMatchObject({ ok: false, code: 'invalid' });
  expect(store.getState()).toBe(before);
});

it('round-trips all studio data through IndexedDB without a second store or record namespace', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  const repository = createIndexedDbAutosaveRepository({ databaseName: 'studio-roundtrip' });
  try {
    const source = studioProject();
    await repository.load();
    await repository.save(source);
    const loaded = await repository.load();
    expect(loaded?.document).toEqual(source);
  } finally {
    repository.close();
    vi.unstubAllGlobals();
  }
});

it('schedules autosave for a studio mutation, but not for a rejected mutation', async () => {
  vi.useFakeTimers();
  const store = createProjectStore();
  const save = vi.fn().mockResolvedValue(undefined);
  const session = new AutosavePersistenceSession({
    store, repository: { load: vi.fn(), save, discard: vi.fn(), close: vi.fn() },
    onSaveStarted: vi.fn(), onSaveFailed: vi.fn(), onSaveSucceeded: vi.fn(),
  }).start();
  try {
    store.getState().setStudioSection('wall', { ...createNewProjectDocument().studio.wall, enabled: true });
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].studio.wall.enabled).toBe(true);
    const before = store.getState();
    expect(before.setStudioSection('wall', { ...before.document.studio.wall, matWidthMm: Infinity })).toMatchObject({ ok: false });
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(store.getState()).toBe(before);
  } finally {
    session();
    vi.useRealTimers();
  }
});
