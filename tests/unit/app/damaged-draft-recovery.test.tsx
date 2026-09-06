import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { AutosaveCorruptionError } from '../../../src/storage/autosave';

const { downloadAutosaveRecovery } = vi.hoisted(() => ({ downloadAutosaveRecovery: vi.fn() }));
vi.mock('../../../src/storage/autosaveRecovery', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../src/storage/autosaveRecovery')>(),
  downloadAutosaveRecovery,
}));
vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

beforeEach(() => {
  downloadAutosaveRecovery.mockReset();
});

function openDamagedDraft() {
  const record = { recordVersion: 99, document: { title: 'Recover me' } };
  const repository = { load: vi.fn(), save: vi.fn(), discard: vi.fn(), close: vi.fn() };
  render(<App autosaveRepository={repository} autosaveLoadError={new AutosaveCorruptionError('Unsupported record version', { record })} />);
  return { record, repository };
}

it('downloads the captured recovery data without dismissing the decision or discarding it', async () => {
  const user = userEvent.setup();
  const { record, repository } = openDamagedDraft();
  const keep = screen.getByRole('button', { name: 'Continue without autosave' });
  await waitFor(() => expect(keep).toHaveFocus());
  await user.click(screen.getByRole('button', { name: 'Download recovery data' }));
  expect(downloadAutosaveRecovery).toHaveBeenCalledExactlyOnceWith(record);
  expect(screen.getByRole('dialog', { name: 'Local draft unavailable' })).toBeInTheDocument();
  expect(repository.discard).not.toHaveBeenCalled();
  expect(repository.save).not.toHaveBeenCalled();
  await user.click(keep);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Project' })).toHaveFocus());
  expect(screen.getByRole('status', { name: 'Autosave status' })).toHaveTextContent('Autosave off');
  await user.click(screen.getByRole('status', { name: 'Offline autosave notice' }));
  expect(screen.getByText(/New work is not saved locally/)).toBeVisible();
  expect(screen.queryByRole('alert', { name: 'Autosave status' })).not.toBeInTheDocument();
});

it('surfaces failed recovery downloads and still offers non-destructive continuation', async () => {
  const user = userEvent.setup();
  const { repository } = openDamagedDraft();
  downloadAutosaveRecovery.mockImplementationOnce(() => { throw new Error('Download blocked'); });
  await user.click(screen.getByRole('button', { name: 'Download recovery data' }));
  expect(screen.getByRole('alert', { name: 'Recovery download status' })).toHaveTextContent('Download blocked');
  await user.click(screen.getByRole('button', { name: 'Continue without autosave' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(repository.discard).not.toHaveBeenCalled();
});
