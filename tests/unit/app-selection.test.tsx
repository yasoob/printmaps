import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/app/App';

vi.mock('../../src/map/MapCanvas', () => ({
  MapCanvas: ({ onBackgroundClick, fitRequest }: { onBackgroundClick: () => void; fitRequest?: number }) => (
    <button type="button" data-testid="map-canvas" data-fit-request={fitRequest} onClick={onBackgroundClick}>Map canvas</button>
  ),
}));

describe('editor selection context', () => {
  it('exposes project fields, tool state, and page disclosure accessibly', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('combobox', { name: 'Page preset' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Map style' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Bearing' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Pitch' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Text scale' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Export resolution' })).toBeInTheDocument();

    const select = screen.getByRole('button', { name: 'Select (V)' });
    const pan = screen.getByRole('button', { name: 'Pan (H)' });
    expect(select).toHaveAttribute('aria-pressed', 'true');
    expect(pan).toHaveAttribute('aria-pressed', 'false');
    await user.click(pan);
    expect(select).toHaveAttribute('aria-pressed', 'false');
    expect(pan).toHaveAttribute('aria-pressed', 'true');

    expect(screen.queryByRole('button', { name: 'Page 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add page' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Map layers' })).toBeInTheDocument();
  });

  it('updates the selected project orientation', async () => {
    const user = userEvent.setup();
    render(<App />);
    const landscape = screen.getByRole('button', { name: 'Landscape' });
    const portrait = screen.getByRole('button', { name: 'Portrait' });

    expect(landscape).toHaveAttribute('aria-pressed', 'true');
    expect(portrait).toHaveAttribute('aria-pressed', 'false');
    await user.click(portrait);
    expect(landscape).toHaveAttribute('aria-pressed', 'false');
    expect(portrait).toHaveAttribute('aria-pressed', 'true');
  });

  it('fits the page without changing the persistent tool', async () => {
    const user = userEvent.setup();
    render(<App />);
    const pan = screen.getByRole('button', { name: 'Pan (H)' });
    const map = screen.getByTestId('map-canvas');
    expect(map).toHaveAttribute('data-fit-request', '0');
    await user.click(pan);
    await user.click(screen.getByRole('button', { name: 'Fit page (Shift+1)' }));
    expect(pan).toHaveAttribute('aria-pressed', 'true');
    expect(map).toHaveAttribute('data-fit-request', '1');
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

  it('commits a field draft without dropping the directly clicked action', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));

    const name = screen.getByRole('textbox', { name: 'Layer name' });
    await user.clear(name);
    await user.type(name, 'Danube route');
    await user.click(screen.getByRole('button', { name: 'Toggle layer visibility' }));

    expect(screen.getByRole('heading', { name: 'Danube route' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle layer visibility' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('moves focus to Project properties after deleting the final layer', async () => {
    const user = userEvent.setup();
    render(<App />);

    for (const layerName of ['Route 01', 'Coffee stop', 'City center', 'Liberty basemap']) {
      await user.click(screen.getByRole('button', { name: `Select ${layerName}` }));
      await user.click(screen.getByRole('button', { name: 'Layer menu' }));
      await user.click(screen.getByRole('menuitem', { name: 'Delete layer' }));
    }

    expect(screen.getByRole('heading', { name: 'Project' })).toHaveFocus();
    expect(screen.getByText('0 layers')).toBeInTheDocument();
  });

  it('normalizes trimmed names and clamped opacity drafts after blur', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));

    const name = screen.getByRole('textbox', { name: 'Layer name' });
    await user.clear(name);
    await user.type(name, '  Route 01  ');
    await user.tab();
    expect(screen.getByRole('textbox', { name: 'Layer name' })).toHaveValue('Route 01');

    const opacity = screen.getByRole('textbox', { name: 'Layer opacity' });
    await user.clear(opacity);
    await user.type(opacity, '150');
    await user.tab();
    expect(screen.getByRole('textbox', { name: 'Layer opacity' })).toHaveValue('100');
  });

  it('preserves spaces while renaming a layer from its property field', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
    const name = screen.getByRole('textbox', { name: 'Layer name' });
    await user.click(name);
    await user.keyboard('{Control>}a{/Control}Danube loop');
    await user.tab();

    expect(screen.getByRole('heading', { name: 'Danube loop' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Danube loop' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Select Route 01' })).toBeInTheDocument();
  });

  it('commits an opacity field edit as one undoable change', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select City center' }));
    const opacity = screen.getByRole('textbox', { name: 'Layer opacity' });
    await user.click(opacity);
    await user.keyboard('{Control>}a{/Control}55');
    await user.tab();
    expect(opacity).toHaveValue('55');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('textbox', { name: 'Layer opacity' })).toHaveValue('28');
  });

  it('ignores an empty opacity edit instead of coercing it to zero', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select City center' }));
    const opacity = screen.getByRole('textbox', { name: 'Layer opacity' });
    expect(opacity).toHaveValue('28');

    await user.clear(opacity);
    await user.tab();
    expect(opacity).toHaveValue('28');
  });

  it('wires layer edits to undoable editor controls', async () => {
    const user = userEvent.setup();
    render(<App />);

    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Hide Route 01' }));
    expect(screen.getByRole('button', { name: 'Show Route 01' })).toBeInTheDocument();
    expect(undo).toBeEnabled();

    await user.click(undo);
    expect(screen.getByRole('button', { name: 'Hide Route 01' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    await user.click(screen.getByRole('button', { name: 'Layer menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete layer' }));
    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Coffee stop' })).not.toBeInTheDocument();

    await user.click(undo);
    expect(screen.getByRole('button', { name: 'Select Coffee stop' })).toBeInTheDocument();
  });

  it('shows project properties until a layer is selected, then returns on canvas click', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
    expect(screen.getByText('Layers')).toBeInTheDocument();
    expect(screen.getByText('Local draft')).toBeInTheDocument();
    expect(screen.queryByText('All changes saved locally')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
    expect(screen.getByRole('heading', { name: 'Route 01' })).toBeInTheDocument();
    expect(screen.getByLabelText('Layer opacity')).toBeInTheDocument();

    await user.click(screen.getByTestId('map-canvas'));
    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
  });
});
