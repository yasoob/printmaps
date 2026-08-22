import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createInitialProjectDocument } from '../../../src/domain/project';
import { AutosaveCorruptionError, type AutosaveRepository } from '../../../src/storage/autosave';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('editor autosave lifecycle', () => {
  it('does not lose an edit made while local storage is still loading', async () => {
    const user = userEvent.setup();
    let finishLoad: ((draft: null) => void) | undefined;
    const repository: AutosaveRepository = {
      load: vi.fn(() => new Promise<null>((resolve) => { finishLoad = resolve; })),
      save: vi.fn().mockResolvedValue(undefined),
      discard: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };
    render(<App autosaveRepository={repository} />);

    await user.click(screen.getByRole('button', { name: 'Portrait' }));
    finishLoad?.(null);

    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      page: { preset: 'A4', widthMm: 210, heightMm: 297, orientation: 'portrait' },
    }));
  });

  it('ignores a stale autosave load from the StrictMode effect probe', async () => {
    const staleDraft = createInitialProjectDocument();
    staleDraft.title = 'Stale local work';
    let finishFirstLoad: ((draft: { recordVersion: 1; savedAt: string; document: typeof staleDraft }) => void) | undefined;
    let finishSecondLoad: ((draft: null) => void) | undefined;
    const repository: AutosaveRepository = {
      load: vi.fn()
        .mockImplementationOnce(() => new Promise((resolve) => { finishFirstLoad = resolve; }))
        .mockImplementationOnce(() => new Promise<null>((resolve) => { finishSecondLoad = resolve; })),
      save: vi.fn().mockResolvedValue(undefined),
      discard: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };
    render(<StrictMode><App autosaveRepository={repository} /></StrictMode>);
    await waitFor(() => expect(repository.load).toHaveBeenCalledTimes(2));

    await act(async () => { finishSecondLoad?.(null); });
    await screen.findByText('Autosave ready');
    await act(async () => {
      finishFirstLoad?.({ recordVersion: 1, savedAt: '2026-08-22T10:00:00.000Z', document: staleDraft });
    });

    expect(screen.queryByRole('dialog', { name: 'Recover local draft' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vienna field guide' })).toBeInTheDocument();
  });

  it('keeps a damaged-draft decision contained when discard storage fails', async () => {
    const user = userEvent.setup();
    const repository: AutosaveRepository = {
      load: vi.fn().mockRejectedValue(new AutosaveCorruptionError()),
      save: vi.fn().mockResolvedValue(undefined),
      discard: vi.fn().mockRejectedValue(new Error('database blocked')),
      close: vi.fn(),
    };
    render(<App autosaveRepository={repository} />);
    const dialog = await screen.findByRole('dialog', { name: 'Local draft unavailable' });
    const discard = screen.getByRole('button', { name: 'Discard damaged draft' });

    await user.click(discard);

    expect(dialog).toBeInTheDocument();
    expect(discard).toHaveFocus();
    expect(await screen.findByRole('alert', { name: 'Autosave status' })).toHaveTextContent('Save a project file');
  });

  it('does not run a queued stale save after the editor unmounts', async () => {
    const user = userEvent.setup();
    let finishFirstSave: (() => void) | undefined;
    const repository: AutosaveRepository = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn()
        .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirstSave = resolve; }))
        .mockResolvedValue(undefined),
      discard: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };
    const { unmount } = render(<App autosaveRepository={repository} />);
    await screen.findByText('Autosave ready');
    await user.click(screen.getByRole('button', { name: 'Portrait' }));
    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Page preset' }), 'A3');
    await new Promise((resolve) => window.setTimeout(resolve, 350));

    unmount();
    finishFirstSave?.();
    await new Promise((resolve) => window.setTimeout(resolve, 20));

    expect(repository.save).toHaveBeenCalledTimes(1);
  });
});
