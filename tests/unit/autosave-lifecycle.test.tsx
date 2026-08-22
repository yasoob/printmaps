import { act, renderHook } from '@testing-library/react';
import { createProjectStore } from '../../src/app/store';
import type { AutosaveRepository } from '../../src/storage/autosave';
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
    act(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      page: expect.objectContaining({ orientation: 'portrait' }),
    }));
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