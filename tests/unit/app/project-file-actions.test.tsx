import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInitialProjectDocument } from '../../../src/domain/project';

const { downloadProjectDocument } = vi.hoisted(() => ({
  downloadProjectDocument: vi.fn(),
}));

vi.mock('../../../src/app/components/projectDownload', () => ({ downloadProjectDocument }));

import { ProjectFileActions } from '../../../src/app/components/ProjectFileActions';

describe('direct project file actions', () => {
  beforeEach(() => downloadProjectDocument.mockReset());

  it('exposes direct Open and Save buttons without a project dropdown or archive action', async () => {
    const user = userEvent.setup();
    render(<ProjectFileActions document={createInitialProjectDocument()} onOpen={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ZIP|archive/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(downloadProjectDocument).toHaveBeenCalledOnce();
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
    const save = screen.getByRole('button', { name: 'Save' });
    await user.click(save);
    expect(screen.getByRole('alert', { name: 'Project save status' })).toHaveTextContent('Browser storage is unavailable');
    expect(save).toHaveFocus();
  });
});
