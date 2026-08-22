import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { exportMocks } from './exportMocks';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('editor layer actions', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
  });

  it('covers redo, list locking, property toggles, duplication, and deletion focus', async () => {
    const user = userEvent.setup();
    render(<App />);

    const redo = screen.getByRole('button', { name: 'Redo' });
    expect(redo).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Hide Route 01' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(redo).toBeEnabled();
    await user.click(redo);
    expect(screen.getByRole('button', { name: 'Show Route 01' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lock Coffee stop' }));
    expect(screen.getByRole('button', { name: 'Unlock Coffee stop' })).toBeInTheDocument();
    expect(redo).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    const visibleToggle = screen.getByRole('button', { name: 'Toggle layer visibility' });
    const lockToggle = screen.getByRole('button', { name: 'Toggle layer lock' });
    expect(visibleToggle).toHaveAttribute('aria-pressed', 'true');
    expect(lockToggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(visibleToggle);
    expect(visibleToggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(lockToggle);
    expect(lockToggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Layer menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate layer' }));
    expect(screen.getByRole('heading', { name: 'Coffee stop copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Coffee stop copy' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Layer menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete layer' }));
    expect(screen.getByRole('button', { name: 'Select City center' })).toHaveFocus();
  });

  it('keeps destructive layer actions in the compact layer menu', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));

    expect(screen.queryByRole('button', { name: 'Move up' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move down' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duplicate layer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete layer' })).not.toBeInTheDocument();

    const menuButton = screen.getByRole('button', { name: 'Layer menu' });
    await user.click(menuButton);
    const duplicate = screen.getByRole('menuitem', { name: 'Duplicate layer' });
    expect(duplicate).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete layer' })).toBeInTheDocument();
    expect(duplicate).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Delete layer' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(duplicate).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menuitem', { name: 'Duplicate layer' })).not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();
  });

  it('reorders layers by dragging a layer handle', () => {
    render(<App />);
    const routeHandle = screen.getByRole('button', { name: 'Reorder Route 01' });
    const coffeeHandle = screen.getByRole('button', { name: 'Reorder Coffee stop' });

    fireEvent.dragStart(routeHandle);
    fireEvent.dragOver(coffeeHandle);
    fireEvent.drop(coffeeHandle);

    expect(screen.getAllByRole('button', { name: /Select (Route 01|Coffee stop)/ }).map((button) => button.getAttribute('aria-label')))
      .toEqual(['Select Coffee stop', 'Select Route 01']);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Route 01' }), { key: 'ArrowUp', altKey: true });
    expect(screen.getAllByRole('button', { name: /Select (Route 01|Coffee stop)/ }).map((button) => button.getAttribute('aria-label')))
      .toEqual(['Select Route 01', 'Select Coffee stop']);
  });
});
