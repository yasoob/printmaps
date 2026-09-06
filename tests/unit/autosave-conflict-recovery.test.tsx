import { act, renderHook } from '@testing-library/react';
import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';
import { AutosaveConflictError, AutosaveCorruptionError, type AutosaveDraft, type AutosaveRepository } from '../../src/storage/autosave';
import { AutosavePersistenceSession } from '../../src/storage/AutosavePersistenceSession';
import { useProjectAutosave } from '../../src/storage/useProjectAutosave';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function savedDraft(): AutosaveDraft {
  const store = createProjectStore(createInitialProjectDocument());
  store.getState().setPagePreset('A3');
  return { recordVersion: 1, savedAt: new Date().toISOString(), document: store.getState().document };
}

function repositoryWith(load = vi.fn<AutosaveRepository['load']>().mockResolvedValue(savedDraft())) {
  return {
    load, save: vi.fn<AutosaveRepository['save']>().mockRejectedValueOnce(new AutosaveConflictError()).mockResolvedValue(undefined),
    discard: vi.fn<AutosaveRepository['discard']>(), close: vi.fn(),
  } satisfies AutosaveRepository;
}

async function conflictedHook(repository = repositoryWith()) {
  const store = createProjectStore(createInitialProjectDocument());
  const hook = renderHook(() => useProjectAutosave(store, repository, null));
  act(() => {
    store.getState().setPagePreset('A5');
    store.getState().selectLayer('route-01');
    store.getState().setHasUnfinishedDrawing(0, true);
  });
  await act(async () => vi.advanceTimersByTimeAsync(300));
  expect(hook.result.current.statusKind).toBe('conflict');
  return { ...hook, store, repository };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('permanently retires all queued and lifecycle writes when an older in-flight save conflicts', async () => {
  const pending = deferred<void>();
  const repository = repositoryWith();
  repository.save.mockReset().mockReturnValue(pending.promise);
  const store = createProjectStore();
  const failed = vi.fn();
  const started = vi.fn();
  const session = new AutosavePersistenceSession({ store, repository, onSaveFailed: failed, onSaveStarted: started, onSaveSucceeded: vi.fn() });
  const stop = session.start();
  store.getState().setPagePreset('A5');
  await vi.advanceTimersByTimeAsync(300);
  store.getState().setPagePreset('A6');
  await vi.advanceTimersByTimeAsync(300);
  window.dispatchEvent(new PageTransitionEvent('pagehide'));
  const error = new AutosaveConflictError();
  pending.reject(error);
  await vi.advanceTimersByTimeAsync(0);
  expect(failed).toHaveBeenCalledExactlyOnceWith(error);
  store.getState().setPagePreset('A4');
  window.dispatchEvent(new PageTransitionEvent('pagehide'));
  stop();
  await vi.advanceTimersByTimeAsync(1000);
  expect(repository.save).toHaveBeenCalledTimes(1);
  expect(started).toHaveBeenCalledTimes(2);
  expect(repository.close).toHaveBeenCalledOnce();
});

it('preserves document, selection, history and unfinished work on Keep editing and warns before unloading', async () => {
  const { store, result, repository, unmount } = await conflictedHook();
  const before = store.getState();
  act(() => result.current.reviewConflict());
  act(() => result.current.keepEditingConflict());
  expect(result.current.conflictOpen).toBe(false);
  expect(store.getState()).toBe(before);
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  act(() => store.getState().setPagePreset('A6'));
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  act(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  unmount();
  expect(repository.save).toHaveBeenCalledTimes(1);
  expect(repository.load).not.toHaveBeenCalled();
  expect(repository.discard).not.toHaveBeenCalled();
});

it('loads only after explicit consent, resets the document epoch, and starts a fresh writer without saving the loaded version', async () => {
  const { store, result, repository } = await conflictedHook();
  act(() => result.current.reviewConflict());
  await act(async () => { expect(await result.current.loadSavedVersion()).toBe(true); });
  expect(store.getState()).toMatchObject({ documentEpoch: 1, selectedId: null, canUndo: false, canRedo: false, hasUnfinishedDrawing: false });
  expect(store.getState().document.page.preset).toBe('A3');
  expect(result.current.statusKind).toBe('status');
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(repository.save).toHaveBeenCalledTimes(1);
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  act(() => store.getState().setPagePreset('A6'));
  await act(async () => vi.advanceTimersByTimeAsync(300));
  expect(repository.save).toHaveBeenCalledTimes(2);
});

it('cancels a pending read without replacing work or enabling writes through its newly read identity', async () => {
  const pending = deferred<AutosaveDraft | null>();
  const repository = repositoryWith(vi.fn().mockReturnValue(pending.promise));
  const { store, result } = await conflictedHook(repository);
  act(() => result.current.reviewConflict());
  let loading!: Promise<boolean>;
  act(() => { loading = result.current.loadSavedVersion(); });
  act(() => result.current.keepEditingConflict());
  act(() => {
    store.getState().setPagePreset('A6');
    result.current.reviewConflict();
  });
  await act(async () => { expect(await result.current.loadSavedVersion()).toBe(false); });
  const before = store.getState();
  await act(async () => {
    pending.resolve(savedDraft());
    expect(await loading).toBe(false);
  });
  expect(store.getState()).toBe(before);
  expect(result.current.statusKind).toBe('conflict');
  expect(result.current.conflictPending).toBe(false);
  expect(repository.load).toHaveBeenCalledOnce();
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(repository.save).toHaveBeenCalledOnce();
});

it.each(['completed', 'unfinished'])('rejects replacement if %s work changes during the read', async (changed) => {
  const pending = deferred<AutosaveDraft | null>();
  const { store, result, repository } = await conflictedHook(repositoryWith(vi.fn().mockReturnValue(pending.promise)));
  act(() => result.current.reviewConflict());
  let loading!: Promise<boolean>;
  act(() => { loading = result.current.loadSavedVersion(); });
  act(() => {
    if (changed === 'completed') store.getState().setPagePreset('A6');
    else store.getState().setHasUnfinishedDrawing(0, false);
  });
  const before = store.getState();
  await act(async () => { pending.resolve(savedDraft()); expect(await loading).toBe(false); });
  expect(store.getState()).toBe(before);
  expect(result.current.conflictOpen).toBe(true);
  expect(result.current.conflictError).toContain('This tab changed');
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(repository.save).toHaveBeenCalledOnce();
});

it.each([null, new AutosaveCorruptionError(), new Error('Storage blocked')])('keeps the losing version when the saved version cannot be loaded: %s', async (failure) => {
  const load = vi.fn<AutosaveRepository['load']>();
  if (failure) load.mockRejectedValue(failure);
  else load.mockResolvedValue(null);
  const { store, result, repository } = await conflictedHook(repositoryWith(load));
  const before = store.getState();
  act(() => result.current.reviewConflict());
  await act(async () => { expect(await result.current.loadSavedVersion()).toBe(false); });
  expect(store.getState()).toBe(before);
  expect(result.current.conflictError).toBeTruthy();
  expect(result.current.conflictOpen).toBe(true);
  expect(repository.save).toHaveBeenCalledOnce();
});

it('ignores a pending recovery result after unmount', async () => {
  const pending = deferred<AutosaveDraft | null>();
  const { store, result, unmount, repository } = await conflictedHook(repositoryWith(vi.fn().mockReturnValue(pending.promise)));
  act(() => result.current.reviewConflict());
  let loading!: Promise<boolean>;
  act(() => { loading = result.current.loadSavedVersion(); });
  const before = store.getState();
  unmount();
  pending.resolve(savedDraft());
  expect(await loading).toBe(false);
  expect(store.getState()).toBe(before);
  expect(repository.close).toHaveBeenCalledTimes(2);
});
