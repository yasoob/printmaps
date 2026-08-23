import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ContentLayer } from '../../src/domain/project';
import { LayerProperties } from '../../src/app/components/LayerProperties';

const actions = {
  onAppearanceChange: vi.fn(),
  onDelete: vi.fn(),
  onDuplicate: vi.fn(),
  onOpacityChange: vi.fn(),
  onPoiCoordinatesChange: vi.fn(),
  onRouteVertexChange: vi.fn(),
  onRename: vi.fn(),
  onToggleLock: vi.fn(),
  onToggleVisibility: vi.fn(),
};

function route(width: number): ContentLayer {
  return {
    id: 'route',
    name: 'Route',
    type: 'route',
    visible: true,
    locked: false,
    opacity: 100,
    appearance: { kind: 'route', color: '#d9363e', width },
    geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
  };
}

describe('layer appearance draft boundaries', () => {
  it('does not resurrect an abandoned width draft when canonical history returns to its source value', async () => {
    const user = userEvent.setup();
    const view = render(<LayerProperties layer={route(4)} {...actions} />);
    const width = screen.getByRole('textbox', { name: 'Route width' });
    await user.clear(width);
    await user.type(width, '8');

    view.rerender(<LayerProperties layer={route(6)} {...actions} />);
    expect(screen.getByRole('textbox', { name: 'Route width' })).toHaveValue('6');
    view.rerender(<LayerProperties layer={route(4)} {...actions} />);

    expect(screen.getByRole('textbox', { name: 'Route width' })).toHaveValue('4');
    expect(actions.onAppearanceChange).not.toHaveBeenCalled();
  });
});
