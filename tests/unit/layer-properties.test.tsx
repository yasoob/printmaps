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
  onShapeVertexChange: vi.fn(),
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

function shapeWithHole(): ContentLayer {
  return {
    id: 'shape',
    name: 'Shape',
    type: 'shape',
    visible: true,
    locked: false,
    opacity: 30,
    appearance: { kind: 'shape', fillColor: '#ffd0cc', strokeColor: '#c5352c', strokeWidth: 2 },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [[0, 0], [4, 0], [0, 4], [0, 0]],
        [[1, 1], [2, 1], [1, 2], [1, 1]],
      ],
    },
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

  it('selects and edits a polygon hole vertex independently', async () => {
    const user = userEvent.setup();
    render(<LayerProperties layer={shapeWithHole()} {...actions} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Shape ring' }), '1');
    const longitude = screen.getByRole('textbox', { name: 'Shape vertex longitude' });
    expect(longitude).toHaveValue('1');
    await user.clear(longitude);
    await user.type(longitude, '1.5');
    await user.tab();

    expect(actions.onShapeVertexChange).toHaveBeenCalledWith(1, 0, [1.5, 1]);
  });

  it('does not offer vertex fields for an unclosed polygon ring', () => {
    const layer = shapeWithHole();
    if (layer.geometry?.type !== 'Polygon') throw new Error('Expected polygon geometry.');
    layer.geometry.coordinates = [[[0, 0], [4, 0], [0, 4]]];

    render(<LayerProperties layer={layer} {...actions} />);

    expect(screen.getByRole('combobox', { name: 'Shape ring' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Shape vertex' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Shape vertex longitude' })).not.toBeInTheDocument();
    expect(screen.getByText('Close this ring with at least three vertices before editing it.')).toBeInTheDocument();
  });
});
