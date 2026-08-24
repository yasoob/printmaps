import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInitialProjectDocument } from '../../../src/domain/project';

const { downloadProjectArchive, downloadProjectDocument } = vi.hoisted(() => ({
  downloadProjectArchive: vi.fn(),
  downloadProjectDocument: vi.fn(),
}));

vi.mock('../../../src/app/components/projectDownload', () => ({
  downloadProjectArchive,
  downloadProjectDocument,
}));

import { ProjectFileMenu } from '../../../src/app/components/ProjectFileActions';

describe('portable project file menu', () => {
  beforeEach(() => {
    downloadProjectArchive.mockReset();
    downloadProjectDocument.mockReset();
  });

  it('groups open and portable downloads under one keyboard-accessible project menu', async () => {
    const user = userEvent.setup();
    render(
      <ProjectFileMenu
        document={createInitialProjectDocument()}
        onOpen={vi.fn()}
        title="Vienna field guide"
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Vienna field guide' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save ZIP' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    trigger.focus();
    await user.keyboard('{ArrowDown}');

    const menu = screen.getByRole('menu', { name: 'Project file menu' });
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open project' })).toHaveFocus();
    const downloadProject = screen.getByRole('menuitem', { name: 'Download project' });
    const downloadArchive = screen.getByRole('menuitem', { name: 'Download project archive' });
    await user.keyboard('{ArrowDown}');
    expect(downloadProject).toHaveFocus();
    await user.keyboard('{End}');
    expect(downloadArchive).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Open project' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(downloadArchive).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(menu).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.keyboard(' ');
    expect(screen.getByRole('menu', { name: 'Project file menu' })).toBeInTheDocument();
    await user.click(trigger.querySelector('span')!);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(trigger);
    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('reports an actionable archive guard failure and clears it after a successful retry', async () => {
    const user = userEvent.setup();
    downloadProjectArchive.mockImplementationOnce(() => {
      throw new Error('The generated project ZIP is larger than 10 MB. Remove project content before saving.');
    });
    render(
      <ProjectFileMenu
        document={createInitialProjectDocument()}
        onOpen={vi.fn()}
        title="Vienna field guide"
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Vienna field guide' });
    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Download project archive' }));

    expect(screen.getByRole('alert', { name: 'Project save status' })).toHaveTextContent(
      'Remove project content before saving',
    );
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Download project archive' }));

    expect(downloadProjectArchive).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert', { name: 'Project save status' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
