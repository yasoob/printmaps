import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createNewProjectDocument } from '../../../src/domain/project';

const { downloadProjectDocument } = vi.hoisted(() => ({ downloadProjectDocument: vi.fn() }));
vi.mock('../../../src/app/components/projectDownload', () => ({ downloadProjectDocument }));
vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

beforeEach(() => {
  downloadProjectDocument.mockReset();
});

async function requestNew(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Project' }));
  await user.click(screen.getByRole('menuitem', { name: 'New project' }));
}

it('protects completed work, keeps backup separate, and starts a blank history root only after confirmation', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Portrait' }));
  await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
  await requestNew(user);
  const dialog = screen.getByRole('dialog', { name: 'Start a new project?' });
  await user.click(screen.getByRole('button', { name: 'Download current project' }));
  expect(downloadProjectDocument).toHaveBeenCalledWith(expect.objectContaining({
    title: 'Vienna field guide', page: expect.objectContaining({ orientation: 'portrait' }),
  }));
  expect(dialog).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByRole('button', { name: 'Select Route 01' })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await requestNew(user);
  await user.click(screen.getByRole('button', { name: 'Start new project' }));
  expect(screen.getByRole('button', { name: 'Untitled map' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Select Route 01' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Select Paper basemap' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Project' })).toHaveFocus());
});

it('keeps unfinished POI lists through cancellation, then clears their document owner on a new project', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Place (P)' }));
  await user.click(screen.getByRole('button', { name: 'Paste POI list' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'POI spreadsheet rows' }), { target: { value: 'Unadded\t16.4\t48.2' } });
  await requestNew(user);
  expect(screen.getByRole('dialog', { name: 'Discard unfinished work?' })).toHaveTextContent('POI lists');
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByRole('textbox', { name: 'POI spreadsheet rows' })).toHaveValue('Unadded\t16.4\t48.2');
  await requestNew(user);
  await user.click(screen.getByRole('button', { name: 'Start new project' }));
  await user.click(screen.getByRole('button', { name: 'Place (P)' }));
  await user.click(screen.getByRole('button', { name: 'Paste POI list' }));
  expect(screen.getByRole('textbox', { name: 'POI spreadsheet rows' })).toHaveValue('');
});

it('does not interrupt a new project from pristine defaults or discard work when backup fails', async () => {
  const user = userEvent.setup();
  render(<App initialDocument={createNewProjectDocument()} autosaveRepository={null} />);
  await requestNew(user);
  expect(screen.queryByRole('dialog')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Portrait' }));
  await requestNew(user);
  downloadProjectDocument.mockImplementationOnce(() => { throw new Error('Download unavailable'); });
  await user.click(screen.getByRole('button', { name: 'Download current project' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Download unavailable');
  expect(screen.getByRole('dialog', { name: 'Start a new project?' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
});
