import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { stubMobileViewport } from './mobileViewport';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('studio header project actions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renames from the mobile Project menu and preserves cancellation and history', async () => {
    stubMobileViewport();
    const user = userEvent.setup();
    render(<App />);
    const project = screen.getByRole('button', { name: 'Project' });
    await user.click(project);
    expect(screen.getByText('Current project')).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Rename project' }));
    const name = screen.getByRole('textbox', { name: 'Project name' });
    expect(name).toHaveValue('Vienna field guide');
    await user.clear(name);
    expect(screen.getByRole('button', { name: 'Rename' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a project name.');
    await user.type(name, 'Summer map');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Rename project' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vienna field guide' })).toBeInTheDocument();

    await user.click(project);
    await user.click(screen.getByRole('menuitem', { name: 'Rename project' }));
    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Summer map{Enter}');
    expect(screen.getByRole('button', { name: 'Summer map' })).toBeInTheDocument();
    await user.click(project);
    await user.click(screen.getByRole('menuitem', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Vienna field guide' })).toBeInTheDocument();
  });

  it('keeps document delete and history shortcuts out of the rename dialog', async () => {
    stubMobileViewport();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Hide Coffee stop' }));
    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    await user.click(screen.getByRole('button', { name: 'Project' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename project' }));
    screen.getByRole('button', { name: 'Cancel' }).focus();

    await user.keyboard('{Backspace}{Control>}z{/Control}');

    expect(screen.getByRole('dialog', { name: 'Rename project' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Select Coffee stop' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Coffee stop' })).toBeInTheDocument();
  });

  it('exposes the same document history through the mobile Project menu', async () => {
    stubMobileViewport();
    const user = userEvent.setup();
    render(<App />);
    const project = screen.getByRole('button', { name: 'Project' });

    await user.click(project);
    expect(screen.getByRole('menuitem', { name: 'Undo' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'Redo' })).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Hide Coffee stop' }));

    await user.click(project);
    await user.click(screen.getByRole('menuitem', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Hide Coffee stop' })).toBeInTheDocument();
    await user.click(project);
    await user.click(screen.getByRole('menuitem', { name: 'Redo' }));
    expect(screen.getByRole('button', { name: 'Show Coffee stop' })).toBeInTheDocument();
  });

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
    expect(screen.getByRole('menuitem', { name: 'New project' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open project' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Download project' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Import map data' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Undo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search places and addresses' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Map scale:/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1:20,000' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Share/i })).not.toBeInTheDocument();
  });
});
