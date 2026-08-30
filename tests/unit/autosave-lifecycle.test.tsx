import { act, renderHook } from '@testing-library/react';
import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';
import {
  AutosaveCorruptionError,
  type AutosaveRepository,
} from '../../src/storage/autosave';
import { useProjectAutosave } from '../../src/storage/useProjectAutosave';

function repositoryWith(save: AutosaveRepository['save'] = vi.fn().mockResolvedValue(undefined)) {
  return {
    load: vi.fn().mockResolvedValue(null),
    save,
    discard: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  } satisfies AutosaveRepository;
}

function createStore() {
  return createProjectStore(createInitialProjectDocument());
}

describe('project autosave persistence', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts from the project that was already loaded without loading again', () => {
    const repository = repositoryWith();
    const store = createStore();
    const { result } = renderHook(() => useProjectAutosave(store, repository, null));

    expect(repository.load).not.toHaveBeenCalled();
    expect(result.current.status).toBe('Autosave ready');
    expect(result.current.corrupted).toBe(false);
  });

  it('debounces edits and saves the canonical document', async () => {
    const repository = repositoryWith();
    const store = createStore();
    const { result } = renderHook(() => useProjectAutosave(store, repository, null));

    act(() => store.getState().setPageDimension('widthMm', 301));
    act(() => store.getState().setPageDimension('widthMm', 302));
    expect(result.current.status).toBe('Saving local draft…');
    await act(async () => vi.advanceTimersByTimeAsync(300));

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      page: expect.objectContaining({ widthMm: 302 }),
    }));
    expect(result.current.status).toBe('All changes saved locally');
  });

  it('flushes the newest debounced edit during pagehide', async () => {
    const repository = repositoryWith();
    const store = createStore();
    renderHook(() => useProjectAutosave(store, repository, null));

    act(() => store.getState().setPageOrientation('portrait'));
    await act(async () => {
      window.dispatchEvent(new PageTransitionEvent('pagehide'));
      await Promise.resolve();
    });

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      page: expect.objectContaining({ orientation: 'portrait' }),
    }));
  });

  it('flushes a debounced edit before closing on unmount', async () => {
    const repository = repositoryWith();
    const store = createStore();
    const { unmount } = renderHook(() => useProjectAutosave(store, repository, null));

    act(() => store.getState().setPageOrientation('portrait'));
    unmount();
    await act(() => Promise.resolve());

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.close).toHaveBeenCalledTimes(1);
  });

  it('keeps the newest pagehide edit final behind an in-flight save', async () => {
    let finishFirstSave: (() => void) | undefined;
    const save = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirstSave = resolve; }))
      .mockResolvedValue(undefined);
    const repository = repositoryWith(save);
    const store = createStore();
    const { unmount } = renderHook(() => useProjectAutosave(store, repository, null));

    act(() => store.getState().setPageDimension('widthMm', 301));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    act(() => store.getState().setPageDimension('widthMm', 302));
    act(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    unmount();
    await act(async () => {
      finishFirstSave?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({
      page: expect.objectContaining({ widthMm: 302 }),
    }));
    expect(repository.close).toHaveBeenCalledTimes(1);
  });

  it('does not start an ordinary queued save after unmount', async () => {
    let finishFirstSave: (() => void) | undefined;
    const save = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirstSave = resolve; }))
      .mockResolvedValue(undefined);
    const repository = repositoryWith(save);
    const store = createStore();
    const { unmount } = renderHook(() => useProjectAutosave(store, repository, null));

    act(() => store.getState().setPageOrientation('portrait'));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    act(() => store.getState().setPagePreset('A3'));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    unmount();
    await act(async () => {
      finishFirstSave?.();
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('keeps autosave disabled after a non-recoverable load failure', async () => {
    const repository = repositoryWith();
    const store = createStore();
    const { result, unmount } = renderHook(() => useProjectAutosave(store, repository, new Error('blocked')));

    act(() => store.getState().setPageOrientation('portrait'));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    unmount();

    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.close).toHaveBeenCalledTimes(1);
    expect(result.current.statusKind).toBe('error');
  });

  it('starts persistence after a damaged draft is discarded', async () => {
    const repository = repositoryWith();
    const store = createStore();
    const { result } = renderHook(() => (
      useProjectAutosave(store, repository, new AutosaveCorruptionError())
    ));

    expect(result.current.corrupted).toBe(true);
    await act(async () => {
      expect(await result.current.discard()).toBe(true);
    });
    act(() => store.getState().setPageOrientation('portrait'));
    await act(async () => vi.advanceTimersByTimeAsync(300));

    expect(repository.discard).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(result.current.corrupted).toBe(false);
  });
});
