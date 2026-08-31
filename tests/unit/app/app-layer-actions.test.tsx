import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { exportMocks } from './exportMocks';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

function stubMobileViewport() {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query === '(max-width: 899px)' || query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

describe('editor layer actions', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    const visibleToggle = screen.getByRole('switch', { name: 'Toggle layer visibility' });
    const lockToggle = screen.getByRole('switch', { name: 'Toggle layer lock' });
    expect(visibleToggle).toBeChecked();
    expect(lockToggle).toBeChecked();
    await user.click(visibleToggle);
    expect(visibleToggle).not.toBeChecked();
    await user.click(lockToggle);
    expect(lockToggle).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Layer menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate layer' }));
    expect(screen.getByRole('heading', { name: 'Coffee stop copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Coffee stop copy' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Layer menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete layer' }));
    expect(screen.getByRole('button', { name: 'Select City center' })).toHaveFocus();
  });

  it('uses matching close language for both mobile sidebars', async () => {
    stubMobileViewport();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Open layers' }));
    const closeLayers = screen.getByRole('button', { name: 'Close layers' });
    await waitFor(() => expect(closeLayers).toHaveFocus());
    await user.click(closeLayers);
    expect(screen.getByRole('button', { name: 'Open layers' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Open properties' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close properties' })).toHaveFocus());
  });

  it('restores focus to the replacement layer menu after duplicating inside the properties drawer', async () => {
    stubMobileViewport();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Open layers' }));
    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
    await user.click(screen.getByRole('button', { name: 'Open properties' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close properties' })).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'Layer menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate layer' }));

    expect(screen.getByRole('heading', { name: 'Route 01 copy' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Layer menu' })).toHaveFocus());
  });

  it('uses the current layer order when deleting through a memoized properties menu', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Coffee stop' }), {
      altKey: true,
      key: 'ArrowDown',
    });
    await user.click(screen.getByRole('button', { name: 'Layer menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete layer' }));

    expect(screen.getByRole('button', { name: 'Select Paper basemap' })).toHaveFocus();
  });

  it('deletes the selected editable layer with Backspace or Delete without hijacking fields', async () => {
    const user = userEvent.setup();
    render(<App />);

    const city = screen.getByRole('button', { name: 'Select City center' });
    await user.click(city);
    await user.keyboard('{Backspace}');
    expect(screen.queryByRole('button', { name: 'Select City center' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await user.click(screen.getByRole('button', { name: 'Select City center' }));
    const name = screen.getByRole('textbox', { name: 'Layer name' });
    await user.click(name);
    await user.keyboard('{Backspace}');
    expect(screen.getByRole('button', { name: 'Select City center' })).toBeInTheDocument();
    await user.keyboard('r');
    await user.tab();

    await user.click(screen.getByRole('button', { name: 'Select City center' }));
    await user.keyboard('{Delete}');
    expect(screen.queryByRole('button', { name: 'Select City center' })).not.toBeInTheDocument();
  });

  it('does not delete a selected locked layer with Backspace or Delete', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Lock City center' }));
    const city = screen.getByRole('button', { name: 'Select City center' });
    await user.click(city);
    await user.keyboard('{Backspace}{Delete}');

    expect(city).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'City center' })).toBeInTheDocument();
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
    const replace = screen.getByRole('menuitem', { name: 'Replace layer data' });
    const duplicate = screen.getByRole('menuitem', { name: 'Duplicate layer' });
    expect(replace).toBeInTheDocument();
    expect(duplicate).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete layer' })).toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    expect(replace).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(duplicate).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Delete layer' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(duplicate).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(replace).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menuitem', { name: 'Duplicate layer' })).not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();
  });

  it('reorders layers by dragging a layer handle', () => {
    render(<App />);
    const routeHandle = screen.getByRole('button', { name: 'Reorder Route 01' });
    const coffeeHandle = screen.getByRole('button', { name: 'Reorder Coffee stop' });
    expect(screen.getByRole('button', { name: 'Reorder Paper basemap' })).toBeDisabled();

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
