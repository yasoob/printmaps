import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

describe('studio header project actions', () => {
  it('edits the project title inline with select-all and preserves Undo', async () => {
    const user = userEvent.setup();
    render(<App />);

    const title = screen.getByRole('button', { name: 'Vienna field guide' });
    expect(title).toHaveAttribute('title', 'Rename project');
    await user.click(title);

    const input = screen.getByRole('textbox', { name: 'Project title' }) as HTMLInputElement;
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('Vienna field guide'.length);
    await user.keyboard('Summer poster{Enter}');

    expect(screen.getByRole('button', { name: 'Summer poster' })).toBeInTheDocument();
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeEnabled();
    await user.click(undo);
    expect(screen.getByRole('button', { name: 'Vienna field guide' })).toBeInTheDocument();
  });

  it('keeps direct Open, Save, Import, and Export actions without Share', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    const importButton = screen.getByRole('button', { name: 'Import' });
    expect(importButton).toBeInTheDocument();
    await user.tab();
    while (document.activeElement !== importButton) await user.tab();
    expect(importButton).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search places and addresses' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Map scale:/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1:20,000' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Share/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Project file menu' })).not.toBeInTheDocument();
  });
});
