import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createProjectStore } from '../../../src/app/store';
import { createInitialProjectDocument } from '../../../src/domain/project';
import { AutosaveConflictError } from '../../../src/storage/autosave';

const { downloadProjectDocument } = vi.hoisted(() => ({ downloadProjectDocument: vi.fn() }));
vi.mock('../../../src/app/components/projectDownload', async (original) => ({
  ...await original<typeof import('../../../src/app/components/projectDownload')>(), downloadProjectDocument,
}));
vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

beforeEach(() => { downloadProjectDocument.mockReset(); });

async function openConflict() {
  const user = userEvent.setup();
  const winner = createProjectStore(createInitialProjectDocument());
  winner.getState().setPagePreset('A3');
  const repository = {
    save: vi.fn().mockRejectedValue(new AutosaveConflictError()),
    load: vi.fn().mockResolvedValue({ recordVersion: 1, savedAt: new Date().toISOString(), document: winner.getState().document }),
    discard: vi.fn(), close: vi.fn(),
  };
  render(<App autosaveRepository={repository} initialDocument={createInitialProjectDocument()} />);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Page preset' }), 'A5');
  await screen.findByRole('status', { name: 'Autosave conflict notice' });
  expect(screen.queryByRole('alert', { name: 'Autosave status' })).not.toBeInTheDocument();
  return { user, repository };
}

it('downloads only completed losing-tab work without treating download initiation as replacement consent', async () => {
  const { user, repository } = await openConflict();
  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
  const map = screen.getByTestId('map-canvas');
  const geometry = map.dataset.layerGeometry;
  await user.click(screen.getByRole('button', { name: 'Review autosave conflict' }));
  const dialog = screen.getByRole('dialog', { name: 'Keep this tab’s version?' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus());
  expect(dialog).toHaveTextContent('Unfinished drawings and unadded point inputs are not saved or included in downloads');
  await user.keyboard('prsv{Control>}z{/Control}{Control>}y{/Control}{Delete}{Backspace}');
  expect(map).toHaveAttribute('data-interaction-mode', 'shape');
  expect(map.dataset.layerGeometry).toBe(geometry);
  await user.click(screen.getByRole('button', { name: 'Download this tab’s version' }));
  expect(downloadProjectDocument).toHaveBeenCalledOnce();
  const downloaded = downloadProjectDocument.mock.calls[0][0];
  expect(downloaded.page.preset).toBe('A5');
  expect(downloaded.layers).toHaveLength(4);
  expect(downloaded).not.toHaveProperty('hasUnfinishedDrawing');
  expect(screen.getByRole('status', { name: 'Conflict download status' })).toHaveTextContent('Download started. Check your browser’s downloads');
  expect(dialog).toBeInTheDocument();
  expect(repository.load).not.toHaveBeenCalled();
  expect(repository.discard).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Project' })).toHaveFocus());
  expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('1 vertex');
  expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  expect(repository.save).toHaveBeenCalledOnce();
});

it('keeps failed backup decisions and losing-tab work intact with a safe default action', async () => {
  const { user, repository } = await openConflict();
  downloadProjectDocument.mockImplementation(() => { throw new Error('Browser download blocked'); });
  await user.click(screen.getByRole('button', { name: 'Review autosave conflict' }));
  await user.click(screen.getByRole('button', { name: 'Download this tab’s version' }));
  expect(screen.getByRole('alert', { name: 'Conflict download error' })).toHaveTextContent('Browser download blocked');
  expect(repository.load).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByRole('combobox', { name: 'Page preset' })).toHaveValue('A5');
  expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  expect(repository.discard).not.toHaveBeenCalled();
});

it('loads the saved version only on the explicit destructive action, without writing the losing tab again', async () => {
  const { user, repository } = await openConflict();
  await user.click(screen.getByRole('button', { name: 'Review autosave conflict' }));
  await user.click(screen.getByRole('button', { name: 'Discard this tab and load saved version' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('combobox', { name: 'Page preset' })).toHaveValue('A3');
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  expect(screen.getByRole('status', { name: 'Autosave status' })).toHaveTextContent('Autosave ready');
  expect(repository.save).toHaveBeenCalledOnce();
  expect(repository.discard).not.toHaveBeenCalled();
});
