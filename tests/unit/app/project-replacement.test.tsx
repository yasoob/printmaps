import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { App } from '../../../src/app/App';
import { ProjectReplacementDialog } from '../../../src/app/components/ProjectReplacementDialog';
import { ProjectStoreContext } from '../../../src/app/projectStoreContext';
import { createProjectStore } from '../../../src/app/store';
import { createInitialProjectDocument, createNewProjectDocument, type ProjectDocument } from '../../../src/domain/project';

const { downloadProjectDocument } = vi.hoisted(() => ({ downloadProjectDocument: vi.fn() }));
vi.mock('../../../src/app/components/projectDownload', () => ({ downloadProjectDocument }));
vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

function requestOpen(container: HTMLElement, document: ProjectDocument) {
  const input = container.querySelector<HTMLInputElement>('input[accept^=".printmap.json"]');
  if (!input) throw new Error('Expected project file input');
  fireEvent.change(input, { target: { files: [new File([JSON.stringify(document)], 'next.printmap.json', { type: 'application/json' })] } });
}

beforeEach(() => {
  downloadProjectDocument.mockReset();
});

it('backs up the live document rather than the version when the replacement was requested', async () => {
  const store = createProjectStore(createInitialProjectDocument());
  const user = userEvent.setup();
  render(
    <ProjectStoreContext value={store}>
      <ProjectReplacementDialog title="Next map" onKeepEditing={vi.fn()} onDiscardAndOpen={vi.fn()} returnFocusRef={createRef()} />
    </ProjectStoreContext>,
  );
  act(() => store.getState().setProjectTitle('Updated while waiting'));
  await user.click(screen.getByRole('button', { name: 'Download current project' }));
  expect(downloadProjectDocument).toHaveBeenCalledExactlyOnceWith(store.getState().document);
  expect(screen.getByRole('dialog')).toHaveTextContent('Updated while waiting');
});

it('protects loaded completed work and keeps download/cancel separate from replacement', async () => {
  const user = userEvent.setup();
  const { container } = render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
  const next = { ...createNewProjectDocument(), title: 'Next map' };
  requestOpen(container, next);
  await screen.findByRole('dialog', { name: 'Replace current project?' });
  await user.click(screen.getByRole('button', { name: 'Download current project' }));
  expect(downloadProjectDocument).toHaveBeenCalledWith(expect.objectContaining({ title: 'Vienna field guide' }));
  expect(screen.getByRole('dialog', { name: 'Replace current project?' })).toBeInTheDocument();
  expect(container.querySelector('.project-title')).toHaveTextContent('Vienna field guide');
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByRole('button', { name: 'Select Route 01' })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  requestOpen(container, next);
  await user.click(await screen.findByRole('button', { name: 'Replace project' }));
  expect(await screen.findByRole('button', { name: 'Next map' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Select Route 01' })).not.toBeInTheDocument();
});

it('keeps the current project intact if its backup cannot be downloaded', async () => {
  downloadProjectDocument.mockImplementation(() => { throw new Error('Backup is too large.'); });
  const user = userEvent.setup();
  const { container } = render(<App autosaveRepository={null} />);
  requestOpen(container, createNewProjectDocument());
  await user.click(await screen.findByRole('button', { name: 'Download current project' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Backup is too large.');
  expect(screen.getByRole('dialog', { name: 'Replace current project?' })).toBeInTheDocument();
  expect(container.querySelector('.project-title')).toHaveTextContent('Vienna field guide');
});

it('does not interrupt the first open from a genuinely empty project', async () => {
  const { container } = render(<App initialDocument={createNewProjectDocument()} autosaveRepository={null} />);
  requestOpen(container, createInitialProjectDocument());
  await screen.findByRole('button', { name: 'Vienna field guide' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('protects restored basemap design even without document history', async () => {
  const initial = createNewProjectDocument();
  initial.camera.zoom = 14;
  const user = userEvent.setup();
  const { container } = render(<App initialDocument={initial} autosaveRepository={null} />);
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  requestOpen(container, createInitialProjectDocument());
  await screen.findByRole('dialog', { name: 'Replace current project?' });
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('protects redo history even when the current document matches blank defaults', async () => {
  const user = userEvent.setup();
  const { container } = render(<App initialDocument={createNewProjectDocument()} autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Portrait' }));
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  requestOpen(container, createInitialProjectDocument());
  await screen.findByRole('dialog', { name: 'Replace current project?' });
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled();
});
