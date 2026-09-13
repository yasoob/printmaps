import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createInitialProjectDocument, createNewProjectDocument } from '../../../src/domain/project';
import { createProjectStore } from '../../../src/app/store';
import { ProjectStoreContext, useProject } from '../../../src/app/projectStoreContext';
import { useProjectOpening } from '../../../src/app/hooks/useProjectOpening';
import { ProjectFileActions } from '../../../src/app/components/ProjectFileActions';
import { deferred, recordWorkflowAnalytics } from '../workflowAnalyticsTestUtils';

const { download } = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('../../../src/app/components/projectDownload', () => ({ downloadProjectDocument: download }));

const { events } = recordWorkflowAnalytics();
beforeEach(() => download.mockReset());

function saveProject() {
  fireEvent.click(screen.getByRole('button', { name: 'Project' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Download project' }));
}

it('tracks confirmed opens and cancellations, not automatic document changes or stale confirmations', () => {
  const store = createProjectStore(createInitialProjectDocument());
  function Wrapper({ children }: { children: ReactNode }) {
    return <ProjectStoreContext value={store}>{children}</ProjectStoreContext>;
  }
  const hook = renderHook(() => useProjectOpening(useProject((state) => state.documentEpoch), vi.fn()), { wrapper: Wrapper });
  act(() => store.getState().openDocument(createInitialProjectDocument()));
  expect(events()).toEqual([]);
  act(() => hook.result.current.open(createNewProjectDocument()));
  const stale = hook.result.current.discardAndOpen;
  act(() => hook.result.current.keepEditing());
  act(() => stale());
  act(() => hook.result.current.open(createNewProjectDocument(), 'new'));
  expect(events().map(({ action }) => action)).toEqual(['projectOpenStarted', 'projectOpenCancelled', 'newProjectStarted']);
  act(() => hook.result.current.discardAndOpen());
  act(() => hook.result.current.open(createNewProjectDocument()));
  expect(events().map(({ action }) => action)).toEqual([
    'projectOpenStarted', 'projectOpenCancelled', 'newProjectStarted', 'newProjectCompleted',
    'projectOpenStarted', 'projectOpenCompleted',
  ]);
});

it('reports file parsing failure and retirement without exposing filenames, content, or parse errors', async () => {
  const onOpen = vi.fn();
  const view = render(<ProjectFileActions getDocument={createInitialProjectDocument} onOpen={onOpen} />);
  const input = view.container.querySelector('input')!;
  fireEvent.change(input, { target: { files: [new File(['Secret content'], 'secret.printmap.json')] } });
  await waitFor(() => expect(events().at(-1)?.action).toBe('projectFileReadFailed'));
  const pending = deferred<string>();
  const slow = new File([], 'private.printmap.json');
  vi.spyOn(slow, 'text').mockReturnValue(pending.promise);
  fireEvent.change(input, { target: { files: [slow] } });
  const nextFile = new File([JSON.stringify(createNewProjectDocument())], 'good.printmap.json');
  fireEvent.change(input, { target: { files: [nextFile] } });
  await waitFor(() => expect(onOpen).toHaveBeenCalledOnce());
  await act(async () => pending.resolve('Secret invalid late content'));
  expect(events().map(({ action }) => action)).toEqual([
    'projectFileReadStarted', 'projectFileReadFailed',
    'projectFileReadStarted', 'projectFileReadCancelled',
    'projectFileReadStarted', 'projectFileReadCompleted',
  ]);
  expect(events().every((event) => event.format === 'project' && event.source === 'file')).toBe(true);
  expect(JSON.stringify(events())).not.toMatch(/private|Secret|secret|good/);
});

it('reports project download success and failure independently of filenames', () => {
  render(<ProjectFileActions getDocument={createInitialProjectDocument} onOpen={vi.fn()} />);
  saveProject();
  download.mockImplementationOnce(() => { throw new Error('Private document serialization error'); });
  saveProject();
  expect(events()).toEqual([
    { action: 'projectSaveStarted', format: 'project' }, { action: 'projectSaveCompleted', format: 'project' },
    { action: 'projectSaveStarted', format: 'project' }, { action: 'projectSaveFailed', format: 'project' },
  ]);
});
