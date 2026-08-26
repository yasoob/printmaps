import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInitialProjectDocument } from '../../../src/domain/project';

const { downloadProjectDocument } = vi.hoisted(() => ({
  downloadProjectDocument: vi.fn(),
}));

vi.mock('../../../src/app/components/projectDownload', () => ({ downloadProjectDocument }));

import { ProjectFileActions } from '../../../src/app/components/ProjectFileActions';

describe('project file actions', () => {
  beforeEach(() => downloadProjectDocument.mockReset());

  it('keeps infrequent file commands in one clearly named Project menu', async () => {
    const user = userEvent.setup();
    render(
      <ProjectFileActions document={createInitialProjectDocument()} onOpen={vi.fn()}>
        <button type="button" role="menuitem">Import map data</button>
      </ProjectFileActions>,
    );

    expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Project' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    const openProject = screen.getByRole('menuitem', { name: 'Open project' });
    const downloadProject = screen.getByRole('menuitem', { name: 'Download project' });
    const importMapData = screen.getByRole('menuitem', { name: 'Import map data' });
    expect(openProject).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(downloadProject).toHaveFocus();
    await user.keyboard('{End}');
    expect(importMapData).toHaveFocus();
    await user.keyboard('{Home}');
    expect(openProject).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(openProject);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(importMapData);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(downloadProject);
    expect(downloadProjectDocument).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('opens a selected project file and reports an actionable save failure', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const project = { ...createInitialProjectDocument(), title: 'Opened map' };
    const { container } = render(<ProjectFileActions document={project} onOpen={onOpen} />);
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
