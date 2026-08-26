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

  it('keeps file commands under Project and leaves Export as the primary action', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
    const project = screen.getByRole('button', { name: 'Project' });
    await user.click(project);
    expect(screen.getByRole('menuitem', { name: 'Open project' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Download project' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Import map data' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search places and addresses' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Map scale:/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1:20,000' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Share/i })).not.toBeInTheDocument();
  });
});
