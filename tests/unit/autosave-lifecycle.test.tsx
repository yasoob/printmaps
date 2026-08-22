import { act, renderHook } from '@testing-library/react';
import { createProjectStore } from '../../src/app/store';
import { AutosaveCorruptionError, type AutosaveRepository } from '../../src/storage/autosave';
import { useProjectAutosave } from '../../src/storage/useProjectAutosave';

function repositoryWith(save: AutosaveRepository['save'] = vi.fn().mockResolvedValue(undefined)) {
  return {
    load: vi.fn().mockResolvedValue(null),
    save,
    discard: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  } satisfies AutosaveRepository;
}

async function finishInitialLoad() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('project autosave teardown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts the newest debounced edit before immediate unmount', async () => {
    const repository = repositoryWith();
    const store = createProjectStore();
    const { unmount } = renderHook(() => useProjectAutosave(store, repository));
    await finishInitialLoad();

    act(() => store.getState().setPageOrientation('portrait'));
    unmount();

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      page: expect.objectContaining({ orientation: 'portrait' }),
    }));
  });

  it('starts the newest debounced edit on immediate pagehide', async () => {
    const repository = repositoryWith();
    const store = createProjectStore();
    renderHook(() => useProjectAutosave(store, repository));
    await finishInitialLoad();

    act(() => store.getState().setPageOrientation('portrait'));
    await act(async () => {
      window.dispatchEvent(new PageTransitionEvent('pagehide'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      page: expect.objectContaining({ orientation: 'portrait' }),
    }));
  });

  it('keeps the newest pagehide edit final when an older save is queued behind an in-flight save', async () => {
    let finishFirstSave: (() => void) | undefined;
    let persistedWidth: number | undefined;
    let isClosed = false;
    let isSaveStartedAfterClose = false;
    let callCount = 0;
    const save = vi.fn((document: Parameters<AutosaveRepository['save']>[0]) => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise<void>((resolve) => {
          finishFirstSave = () => {
            persistedWidth = document.page.widthMm;
            resolve();
          };
        });
      }
      isSaveStartedAfterClose = isClosed;
      persistedWidth = document.page.widthMm;
      return Promise.resolve();
    });
    const repository = repositoryWith(save);
    repository.close = vi.fn(() => { isClosed = true; });
    const store = createProjectStore();
    const { unmount } = renderHook(() => useProjectAutosave(store, repository));
    await finishInitialLoad();

    act(() => store.getState().setPageDimension('widthMm', 301));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(save).toHaveBeenCalledTimes(1);

    act(() => store.getState().setPageDimension('widthMm', 302));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(save).toHaveBeenCalledTimes(1);

    act(() => store.getState().setPageDimension('widthMm', 303));
    act(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    unmount();

    await act(async () => {
      finishFirstSave?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(persistedWidth).toBe(303);
    expect(isSaveStartedAfterClose).toBe(false);
    expect(repository.close).toHaveBeenCalledTimes(1);
  });

  it('promotes an already-queued newest edit when pagehide precedes teardown', async () => {
    let finishFirstSave: (() => void) | undefined;
    const save = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirstSave = resolve; }))
      .mockResolvedValue(undefined);
    const repository = repositoryWith(save);
    const store = createProjectStore();
    const { unmount } = renderHook(() => useProjectAutosave(store, repository));
    await finishInitialLoad();

    act(() => store.getState().setPageDimension('widthMm', 301));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    act(() => store.getState().setPageDimension('widthMm', 302));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(save).toHaveBeenCalledTimes(1);

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
  });

  it('does not let an old effect completion discard the replacement repository intent', async () => {
    let finishOldSave: (() => void) | undefined;
    const oldRepository = repositoryWith(vi.fn(() => (
      new Promise<void>((resolve) => { finishOldSave = resolve; })
    )));
    const newRepository = repositoryWith();
    const store = createProjectStore();
    const { rerender } = renderHook(
      ({ repository }) => useProjectAutosave(store, repository),
      { initialProps: { repository: oldRepository as AutosaveRepository } },
    );
    await finishInitialLoad();

    act(() => store.getState().setPageDimension('widthMm', 301));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    rerender({ repository: newRepository });
    await finishInitialLoad();
    act(() => store.getState().setPageDimension('widthMm', 302));
    await act(async () => vi.advanceTimersByTimeAsync(300));

    await act(async () => {
      finishOldSave?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(newRepository.save).toHaveBeenCalledTimes(1);
    expect(newRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      page: expect.objectContaining({ widthMm: 302 }),
    }));
  });
});

describe('project autosave repository replacement', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits for a replacement repository load before saving edits', async () => {
    let finishReplacementLoad: (() => void) | undefined;
    const oldRepository = repositoryWith();
    const newRepository = repositoryWith();
    newRepository.load = vi.fn(() => new Promise<null>((resolve) => {
      finishReplacementLoad = () => resolve(null);
    }));
    const store = createProjectStore();
    const { rerender } = renderHook(
      ({ repository }) => useProjectAutosave(store, repository),
      { initialProps: { repository: oldRepository as AutosaveRepository } },
    );
    await finishInitialLoad();

    rerender({ repository: newRepository });
    act(() => store.getState().setPageDimension('widthMm', 302));
    await act(async () => vi.advanceTimersByTimeAsync(300));

    expect(newRepository.save).not.toHaveBeenCalled();
    await act(async () => {
      finishReplacementLoad?.();
      await Promise.resolve();
    });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(newRepository.save).toHaveBeenCalledTimes(1);
  });

  it('clears stale corruption state when the repository is replaced', async () => {
    const oldRepository = repositoryWith();
    oldRepository.load = vi.fn().mockRejectedValue(new AutosaveCorruptionError());
    const newRepository = repositoryWith();
    newRepository.load = vi.fn(() => new Promise<null>(() => {}));
    const store = createProjectStore();
    const { result, rerender } = renderHook(
      ({ repository }) => useProjectAutosave(store, repository),
      { initialProps: { repository: oldRepository as AutosaveRepository } },
    );
    await finishInitialLoad();
    expect(result.current.corrupted).toBe(true);

    rerender({ repository: newRepository });

    expect(result.current.corrupted).toBe(false);
    expect(result.current.recoveryDraft).toBeNull();
    expect(result.current.status).toBe('Checking for a local draft…');
    expect(result.current.statusKind).toBe('status');
  });

  it('does not re-expose stale recovery state when a repository object returns', async () => {
    const firstRepository = repositoryWith();
    firstRepository.load = vi.fn()
      .mockRejectedValueOnce(new AutosaveCorruptionError())
      .mockImplementation(() => new Promise<null>(() => {}));
    const secondRepository = repositoryWith();
    secondRepository.load = vi.fn(() => new Promise<null>(() => {}));
    const store = createProjectStore();
    const { result, rerender } = renderHook(
      ({ repository }) => useProjectAutosave(store, repository),
      { initialProps: { repository: firstRepository as AutosaveRepository } },
    );
    await finishInitialLoad();
    expect(result.current.corrupted).toBe(true);

    rerender({ repository: secondRepository });
    expect(result.current.corrupted).toBe(false);
    rerender({ repository: firstRepository });

    expect(result.current.corrupted).toBe(false);
    expect(result.current.recoveryDraft).toBeNull();
  });

  it('hands an old queued newest edit to the replacement repository', async () => {
    let finishOldSave: (() => void) | undefined;
    const oldRepository = repositoryWith(vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishOldSave = resolve; }))
      .mockResolvedValue(undefined));
    const newRepository = repositoryWith();
    const store = createProjectStore();
    const { rerender } = renderHook(
      ({ repository }) => useProjectAutosave(store, repository),
      { initialProps: { repository: oldRepository as AutosaveRepository } },
    );
    await finishInitialLoad();

    act(() => store.getState().setPageDimension('widthMm', 301));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    act(() => store.getState().setPageDimension('widthMm', 302));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    rerender({ repository: newRepository });
    await finishInitialLoad();
    await act(async () => vi.advanceTimersByTimeAsync(300));

    expect(newRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      page: expect.objectContaining({ widthMm: 302 }),
    }));
    await act(async () => {
      finishOldSave?.();
      await Promise.resolve();
    });
  });

  it('ignores a discard completion from the repository that was replaced', async () => {
    let finishOldDiscard: (() => void) | undefined;
    const oldRepository = repositoryWith();
    oldRepository.discard = vi.fn(() => new Promise<void>((resolve) => {
      finishOldDiscard = resolve;
    }));
    const newRepository = repositoryWith();
    newRepository.load = vi.fn(() => new Promise<null>(() => {}));
    const store = createProjectStore();
    const { result, rerender } = renderHook(
      ({ repository }) => useProjectAutosave(store, repository),
      { initialProps: { repository: oldRepository as AutosaveRepository } },
    );
    await finishInitialLoad();

    let oldDiscard: Promise<boolean> | undefined;
    act(() => { oldDiscard = result.current.discard(); });
    rerender({ repository: newRepository });
    act(() => store.getState().setPageDimension('widthMm', 302));
    await act(async () => {
      finishOldDiscard?.();
      await oldDiscard;
    });
    await act(async () => vi.advanceTimersByTimeAsync(300));

    expect(newRepository.save).not.toHaveBeenCalled();
  });

  it('does not run a stale queued save after its editor unmounts', async () => {
    let finishFirstSave: (() => void) | undefined;
    const save = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirstSave = resolve; }))
      .mockResolvedValue(undefined);
    const repository = repositoryWith(save);
    const store = createProjectStore();
    const { unmount } = renderHook(() => useProjectAutosave(store, repository));
    await finishInitialLoad();

    act(() => store.getState().setPageOrientation('portrait'));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(save).toHaveBeenCalledTimes(1);

    act(() => store.getState().setPagePreset('A3'));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(save).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      finishFirstSave?.();
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
  });
});