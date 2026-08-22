import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { exportMocks } from './exportMocks';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('editor layer fields', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
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
});
