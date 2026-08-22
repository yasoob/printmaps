import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/app/App';
import { exportMocks } from './app/exportMocks';

vi.mock('../../src/map/MapCanvas', async () => import('./app/MapCanvasMock'));

describe('editor selection context', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
  });

  it('synchronizes ordered content state while list hover previews and canvas clicks select', async () => {
    const user = userEvent.setup();
    render(<App />);
    const map = screen.getByTestId('map-canvas');
    const coffee = screen.getByRole('button', { name: 'Select Coffee stop' });

    expect(map).toHaveAttribute('data-layer-state', 'route-01:true,poi-cafe:true,area-center:true');
    fireEvent.mouseEnter(coffee);
    expect(map).toHaveAttribute('data-previewed-layer', 'poi-cafe');
    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
    fireEvent.mouseLeave(coffee);
    expect(map).toHaveAttribute('data-previewed-layer', '');

    await user.click(screen.getByRole('button', { name: 'Map Coffee stop' }));
    expect(map).toHaveAttribute('data-selected-layer', 'poi-cafe');
    expect(screen.getByRole('heading', { name: 'Coffee stop' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide Route 01' }));
    expect(map).toHaveAttribute('data-layer-state', 'route-01:false,poi-cafe:true,area-center:true');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder City center' }), { key: 'ArrowUp', altKey: true });
    expect(map).toHaveAttribute('data-layer-state', 'route-01:false,area-center:true,poi-cafe:true');
  });
  it('clears a hovered layer preview when the layer is hidden', async () => {
    const user = userEvent.setup();
    render(<App />);
    const map = screen.getByTestId('map-canvas');
    const route = screen.getByRole('button', { name: 'Select Route 01' });

    fireEvent.mouseEnter(route);
    expect(map).toHaveAttribute('data-previewed-layer', 'route-01');
    await user.click(screen.getByRole('button', { name: 'Hide Route 01' }));
    expect(map).toHaveAttribute('data-previewed-layer', '');
    await user.click(screen.getByRole('button', { name: 'Show Route 01' }));
    expect(map).toHaveAttribute('data-previewed-layer', '');
  });

  it('does not preview a hidden layer on hover', async () => {
    const user = userEvent.setup();
    render(<App />);
    const map = screen.getByTestId('map-canvas');

    await user.click(screen.getByRole('button', { name: 'Hide Route 01' }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Select Route 01' }));

    expect(map).toHaveAttribute('data-previewed-layer', '');
  });

  it('clears a preview when its layer is deleted', async () => {
    const user = userEvent.setup();
    render(<App />);
    const map = screen.getByTestId('map-canvas');
    const coffee = screen.getByRole('button', { name: 'Select Coffee stop' });

    await user.click(coffee);
    fireEvent.mouseEnter(coffee);
    expect(map).toHaveAttribute('data-previewed-layer', 'poi-cafe');
    fireEvent.click(screen.getByRole('button', { name: 'Layer menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete layer' }));

    expect(map).toHaveAttribute('data-previewed-layer', '');
  });

  it('does not restore a stale preview when a deleted layer is undone', async () => {
    const user = userEvent.setup();
    render(<App />);
    const map = screen.getByTestId('map-canvas');
    const coffee = screen.getByRole('button', { name: 'Select Coffee stop' });

    await user.click(coffee);
    fireEvent.mouseEnter(coffee);
    fireEvent.click(screen.getByRole('button', { name: 'Layer menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete layer' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(map).toHaveAttribute('data-previewed-layer', '');
  });
  it('shows project properties until a layer is selected, then returns on canvas click', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Layers sidebar' })).toBeInTheDocument();
    expect(screen.getByText('Local draft')).toBeInTheDocument();
    expect(screen.queryByText('All changes saved locally')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
    expect(screen.getByRole('heading', { name: 'Route 01' })).toBeInTheDocument();
    expect(screen.getByLabelText('Layer opacity')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Map background' }));
    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
  });
});
