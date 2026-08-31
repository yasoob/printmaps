import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createInitialProjectDocument } from '../../../src/domain/project';
import {
  AutosaveCorruptionError,
  loadAutosavedProject,
  type AutosaveRepository,
} from '../../../src/storage/autosave';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

function repositoryWith(overrides: Partial<AutosaveRepository> = {}): AutosaveRepository {
  return {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    discard: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    ...overrides,
  };
}

async function renderLoadedApp(repository: AutosaveRepository) {
  const startup = await loadAutosavedProject(repository, createInitialProjectDocument);
  return render(
    <App
      autosaveLoadError={startup.loadError}
      autosaveRepository={repository}
      initialDocument={startup.document}
    />,
  );
}

describe('editor autosave startup', () => {
  it('uses a valid local draft as the initial project without a recovery prompt', async () => {
    const recovered = createInitialProjectDocument();
    recovered.id = 'recovered-project';
    recovered.title = 'Recovered field guide';
    recovered.page = { preset: 'A3', widthMm: 297, heightMm: 420, orientation: 'portrait' };
    const repository = repositoryWith({
      load: vi.fn().mockResolvedValue({
        recordVersion: 1,
        savedAt: '2026-08-22T10:00:00.000Z',
        document: recovered,
      }),
    });

    await renderLoadedApp(repository);

    expect(screen.queryByRole('dialog', { name: 'Recover local draft' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recovered field guide' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Page preset' })).toHaveValue('A3');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Autosave status' })).toHaveTextContent('Autosave ready');
    expect(repository.load).toHaveBeenCalledTimes(1);
  });

  it('autosaves the canonical document after an edit', async () => {
    const user = userEvent.setup();
    const repository = repositoryWith();
    await renderLoadedApp(repository);

    await user.click(screen.getByRole('button', { name: 'Portrait' }));

    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      page: { preset: 'A4', widthMm: 210, heightMm: 297, orientation: 'portrait' },
    }));
    expect(screen.getByRole('status', { name: 'Autosave status' })).toHaveTextContent('All changes saved locally');
  });

  it('keeps edits usable and exposes an actionable quota failure', async () => {
    const user = userEvent.setup();
    const repository = repositoryWith({
      save: vi.fn().mockRejectedValue(new DOMException('Storage full', 'QuotaExceededError')),
    });
    await renderLoadedApp(repository);

    await user.click(screen.getByRole('button', { name: 'Portrait' }));

    const alert = await screen.findByRole('alert', { name: 'Autosave status' });
    expect(alert).toHaveTextContent('browser storage is full');
    expect(screen.getByRole('status', { name: 'Autosave status' })).toHaveTextContent('Autosave paused');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('blocks the editor until a damaged local draft is discarded', async () => {
    const user = userEvent.setup();
    const repository = repositoryWith({
      load: vi.fn().mockRejectedValue(new AutosaveCorruptionError()),
    });
    await renderLoadedApp(repository);

    const dialog = screen.getByRole('dialog', { name: 'Local draft unavailable' });
    const discard = screen.getByRole('button', { name: 'Discard damaged draft' });
    expect(dialog).toHaveTextContent('damaged or unsupported');
    await waitFor(() => expect(discard).toHaveFocus());
    const inertRoot = document.querySelector('body > [data-base-ui-inert]');
    expect(inertRoot).toHaveAttribute('aria-hidden', 'true');
    expect(inertRoot).toHaveAttribute('data-base-ui-inert');
    await user.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
    await user.click(discard);

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(repository.discard).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Project' })).toHaveFocus());
    expect(screen.getByRole('status', { name: 'Autosave status' })).toHaveTextContent('Autosave ready');
  });
});
