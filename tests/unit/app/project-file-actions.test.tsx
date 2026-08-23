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

import { ProjectSaveButton } from '../../../src/app/components/ProjectFileActions';

describe('portable project save actions', () => {
  beforeEach(() => {
    downloadProjectArchive.mockReset();
    downloadProjectDocument.mockReset();
  });

  it('reports an actionable ZIP guard failure and clears it after a successful retry', async () => {
    const user = userEvent.setup();
    downloadProjectArchive.mockImplementationOnce(() => {
      throw new Error('The generated project ZIP is larger than 10 MB. Remove project content before saving.');
    });
    render(<ProjectSaveButton document={createInitialProjectDocument()} />);

    await user.click(screen.getByRole('button', { name: 'Save ZIP' }));

    expect(screen.getByRole('alert', { name: 'Project save status' })).toHaveTextContent(
      'Remove project content before saving',
    );
    expect(screen.getByRole('button', { name: 'Save ZIP' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Save ZIP' }));

    expect(downloadProjectArchive).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert', { name: 'Project save status' })).not.toBeInTheDocument();
  });
});
