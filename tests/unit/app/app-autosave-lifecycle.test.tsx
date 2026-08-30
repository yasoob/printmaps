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

describe('editor autosave lifecycle', () => {
  it('keeps a damaged-draft decision contained when discard storage fails', async () => {
    const user = userEvent.setup();
    const repository: AutosaveRepository = {
      load: vi.fn().mockRejectedValue(new AutosaveCorruptionError()),
      save: vi.fn().mockResolvedValue(undefined),
      discard: vi.fn().mockRejectedValue(new Error('database blocked')),
      close: vi.fn(),
    };
    await renderLoadedApp(repository);
    const dialog = screen.getByRole('dialog', { name: 'Local draft unavailable' });
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
    const { unmount } = await renderLoadedApp(repository);
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
