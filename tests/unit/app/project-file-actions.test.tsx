import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DropdownMenuItem } from '../../../src/components/ui/dropdown-menu';
import { createInitialProjectDocument, createNewProjectDocument } from '../../../src/domain/project';
import * as projectFile from '../../../src/domain/projectFile';

const { downloadProjectDocument } = vi.hoisted(() => ({
  downloadProjectDocument: vi.fn(),
}));

vi.mock('../../../src/app/components/projectDownload', () => ({ downloadProjectDocument }));

import { ProjectFileActions } from '../../../src/app/components/ProjectFileActions';

describe('project file actions', () => {
  beforeEach(() => {
    downloadProjectDocument.mockReset();
  });

  it('ignores an older file read that finishes after a newer selection', async () => {
    let resolveOlder!: (text: string) => void;
    const older = new File(['{}'], 'older.printmap.json', { type: 'application/json' });
    vi.spyOn(older, 'text').mockReturnValue(new Promise<string>((resolve) => { resolveOlder = resolve; }));
    const newer = { ...createInitialProjectDocument(), title: 'Newer choice' };
    const onOpen = vi.fn();
    const { container } = render(<ProjectFileActions getDocument={createInitialProjectDocument} onOpen={onOpen} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [older] } });
    fireEvent.change(input, { target: { files: [new File([JSON.stringify(newer)], 'newer.printmap.json', { type: 'application/json' })] } });
    await waitFor(() => expect(onOpen).toHaveBeenCalledOnce());
    await act(async () => resolveOlder(JSON.stringify(createInitialProjectDocument())));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ title: 'Newer choice' }));
  });

  it('keeps infrequent file commands in one clearly named Project menu', async () => {
    const user = userEvent.setup();
    render(
      <ProjectFileActions getDocument={() => createInitialProjectDocument()} onOpen={vi.fn()}>
        <DropdownMenuItem>Import map data</DropdownMenuItem>
      </ProjectFileActions>,
    );

    expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Project' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    trigger.focus();
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    const newProject = screen.getByRole('menuitem', { name: 'New project' });
    let openProject = screen.getByRole('menuitem', { name: 'Open project' });
    let downloadProject = screen.getByRole('menuitem', { name: 'Download project' });
    let importMapData = screen.getByRole('menuitem', { name: 'Import map data' });
    await waitFor(() => expect(newProject).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    expect(openProject).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(downloadProject).toHaveFocus();
    await user.keyboard('{End}');
    expect(importMapData).toHaveFocus();
    await user.keyboard('{Home}');
    expect(newProject).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    openProject = screen.getByRole('menuitem', { name: 'Open project' });
    await user.click(openProject);
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    importMapData = screen.getByRole('menuitem', { name: 'Import map data' });
    await user.click(importMapData);
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    downloadProject = screen.getByRole('menuitem', { name: 'Download project' });
    await user.click(downloadProject);
    expect(downloadProjectDocument).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('starts a canonical blank project and retires an older read before parsing its result', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    let finishRead!: (text: string) => void;
    const file = new File(['{}'], 'old.printmap.json');
    vi.spyOn(file, 'text').mockReturnValue(new Promise((resolve) => { finishRead = resolve; }));
    const parse = vi.spyOn(projectFile, 'parseProjectFileText');
    const { container } = render(<ProjectFileActions getDocument={createInitialProjectDocument} onOpen={onOpen} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [file] } });
    await user.click(screen.getByRole('button', { name: 'Project' }));
    await user.click(screen.getByRole('menuitem', { name: 'New project' }));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(createNewProjectDocument(), 'new');
    await act(async () => finishRead(JSON.stringify(createInitialProjectDocument())));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(parse).not.toHaveBeenCalled();
  });

  it('opens a selected project file and reports an actionable save failure', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const project = { ...createInitialProjectDocument(), title: 'Opened map' };
    const { container } = render(<ProjectFileActions getDocument={() => project} onOpen={onOpen} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;

    fireEvent.change(input, {
      target: { files: [new File([JSON.stringify(project)], 'opened.printmap.json', { type: 'application/json' })] },
    });
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ title: 'Opened map' })));

    downloadProjectDocument.mockImplementationOnce(() => { throw new Error('Browser storage is unavailable.'); });
    const trigger = screen.getByRole('button', { name: 'Project' });
    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Download project' }));
    expect(screen.getByRole('alert', { name: 'Project save status' })).toHaveTextContent('Browser storage is unavailable');
    expect(trigger).toHaveFocus();
  });
});
