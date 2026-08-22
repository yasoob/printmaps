import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createInitialProjectDocument } from '../../../src/domain/project';
import { AutosaveCorruptionError, type AutosaveRepository } from '../../../src/storage/autosave';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('editor autosave recovery', () => {
  it('requires an explicit choice before recovering a valid local draft', async () => {
    const user = userEvent.setup();
    const recovered = createInitialProjectDocument();
    recovered.id = 'recovered-project';
    recovered.title = 'Recovered field guide';
    recovered.page = { preset: 'A3', widthMm: 297, heightMm: 420, orientation: 'portrait' };
    const repository: AutosaveRepository = {
      load: vi.fn().mockResolvedValue({
        recordVersion: 1,
        savedAt: '2026-08-22T10:00:00.000Z',
        document: recovered,
      }),
      save: vi.fn().mockResolvedValue(undefined),
      discard: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };

    render(<App autosaveRepository={repository} />);

    const dialog = await screen.findByRole('dialog', { name: 'Recover local draft' });
    expect(dialog).toHaveTextContent('Recovered field guide');
    expect(screen.getByRole('button', { name: 'Recover draft' })).toHaveFocus();
    expect(document.querySelector('.studio-shell')).toHaveAttribute('inert');
    await user.click(screen.getByRole('button', { name: 'Recover draft' }));

    expect(dialog).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recovered field guide' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Page preset' })).toHaveValue('A3');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Autosave status' })).toHaveTextContent('Recovered local draft');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Recovered field guide' })).toHaveFocus());
  });

  it('autosaves the canonical document after an edit', async () => {
    const user = userEvent.setup();
    const repository: AutosaveRepository = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
      discard: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };
    render(<App autosaveRepository={repository} />);
    await screen.findByText('Autosave ready');

    await user.click(screen.getByRole('button', { name: 'Portrait' }));

    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      page: { preset: 'A4', widthMm: 210, heightMm: 297, orientation: 'portrait' },
    }));
    expect(screen.getByRole('status', { name: 'Autosave status' })).toHaveTextContent('All changes saved locally');
  });

  it('traps focus until the user explicitly discards a recovered draft', async () => {
    const user = userEvent.setup();
    const recovered = createInitialProjectDocument();
    recovered.title = 'Older local work';
    const repository: AutosaveRepository = {
      load: vi.fn().mockResolvedValue({ recordVersion: 1, savedAt: '2026-08-22T10:00:00.000Z', document: recovered }),
      save: vi.fn().mockResolvedValue(undefined),
      discard: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };
    render(<App autosaveRepository={repository} />);
    const dialog = await screen.findByRole('dialog', { name: 'Recover local draft' });
    const recover = screen.getByRole('button', { name: 'Recover draft' });
    const discard = screen.getByRole('button', { name: 'Discard draft' });

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(discard).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(recover).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
    await user.click(discard);

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(repository.discard).toHaveBeenCalledTimes(1);
    expect(repository.save).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Vienna field guide' })).toHaveFocus());
  });

  it('contains recovery actions while a draft discard is pending', async () => {
    const user = userEvent.setup();
    const recovered = createInitialProjectDocument();
    recovered.title = 'Older local work';
    let finishDiscard: (() => void) | undefined;
    const repository: AutosaveRepository = {
      load: vi.fn().mockResolvedValue({ recordVersion: 1, savedAt: '2026-08-22T10:00:00.000Z', document: recovered }),
      save: vi.fn().mockResolvedValue(undefined),
      discard: vi.fn(() => new Promise<void>((resolve) => { finishDiscard = resolve; })),
      close: vi.fn(),
    };
    render(<App autosaveRepository={repository} />);
    const dialog = await screen.findByRole('dialog', { name: 'Recover local draft' });

    await user.click(screen.getByRole('button', { name: 'Discard draft' }));

    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(dialog).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Discard draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Recover draft' })).toBeDisabled();
    finishDiscard?.();
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Vienna field guide' })).toBeInTheDocument();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('keeps edits usable and exposes an actionable quota failure', async () => {
    const user = userEvent.setup();
    const repository: AutosaveRepository = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockRejectedValue(new DOMException('Storage full', 'QuotaExceededError')),
      discard: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };
    render(<App autosaveRepository={repository} />);
    await screen.findByText('Autosave ready');

    await user.click(screen.getByRole('button', { name: 'Portrait' }));

    const alert = await screen.findByRole('alert', { name: 'Autosave status' });
    expect(alert).toHaveClass('autosave-error-notice');
    expect(alert).toHaveTextContent('browser storage is full');
    expect(alert).toHaveTextContent('Use Save');
    expect(screen.getByRole('status', { name: 'Autosave status' })).toHaveTextContent('Autosave paused');
    expect(screen.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('blocks unsafe recovery until a damaged local draft is explicitly discarded', async () => {
    const user = userEvent.setup();
    const repository: AutosaveRepository = {
      load: vi.fn().mockRejectedValue(new AutosaveCorruptionError()),
      save: vi.fn().mockResolvedValue(undefined),
      discard: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };
    render(<App autosaveRepository={repository} />);

    const dialog = await screen.findByRole('dialog', { name: 'Local draft unavailable' });
    const discard = screen.getByRole('button', { name: 'Discard damaged draft' });
    expect(dialog).toHaveTextContent('damaged or unsupported');
    expect(discard).toHaveFocus();
    expect(document.querySelector('.studio-shell')).toHaveAttribute('inert');
    await user.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
    await user.click(discard);

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(repository.discard).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Vienna field guide' })).toHaveFocus());
    expect(screen.getByRole('status', { name: 'Autosave status' })).toHaveTextContent('Autosave ready');
  });

});
