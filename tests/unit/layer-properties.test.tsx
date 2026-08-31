import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ContentLayer } from '../../src/domain/project';
import { LayerProperties } from '../../src/app/components/LayerProperties';

const actions = {
  assets: {},
  onAppearanceChange: vi.fn(),
  onDelete: vi.fn(),
  onDuplicate: vi.fn(),
  onOpacityChange: vi.fn(),
  onPoiCoordinatesChange: vi.fn(),
  onPoiCustomMarkerChange: vi.fn(),
  onReplace: vi.fn(),
  onRouteVertexInsert: vi.fn(),
  onRouteVertexRemove: vi.fn(),
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
    appearance: {
      kind: 'route', color: '#d9363e', width, strokeStyle: 'solid', marker: null, segmentStyles: [null],
    },
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
    appearance: { kind: 'shape', fillColor: '#ffd0cc', strokeColor: '#c5352c', strokeWidth: 2, invert: false },
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
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.removeItem('print-map-studio:inspector:layer:route-advanced');
  });

  it('keeps route vertices and elevation behind a collapsed Advanced section', async () => {
    const user = userEvent.setup();
    render(<LayerProperties layer={route(4)} {...actions} />);

    const advanced = screen.getByRole('button', { name: /Advanced/ });
    expect(advanced).toHaveAttribute('aria-expanded', 'false');
    expect(advanced).toHaveTextContent('Vertices · Elevation profile');
    expect(screen.queryByRole('combobox', { name: 'Route anchor' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate elevation profile' })).not.toBeInTheDocument();

    await user.click(advanced);

    expect(advanced).toHaveAttribute('aria-expanded', 'true');
    expect(advanced).not.toHaveTextContent('Vertices · Elevation profile');
    expect(screen.getByRole('combobox', { name: 'Route anchor' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Generate elevation profile' })).toBeVisible();
    expect(screen.getByText('Copernicus DEM GLO-90 via Open-Meteo')).toBeVisible();
  });

  it('disables imported-data replacement for a locked layer and advances to the next menu action', async () => {
    const user = userEvent.setup();
    const lockedRoute = route(4);
    lockedRoute.locked = true;
    render(<LayerProperties layer={lockedRoute} {...actions} />);

    await user.click(screen.getByRole('button', { name: 'Layer menu' }));

    expect(screen.getByRole('menuitem', { name: 'Replace layer data' })).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Replace layer data' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Duplicate layer' })).toHaveFocus();
  });

  it('toggles inverted fill as one canonical appearance edit', async () => {
    const user = userEvent.setup();
    render(<LayerProperties layer={shapeWithHole()} {...actions} />);

    await user.click(screen.getByRole('switch', { name: 'Invert shape fill' }));

    expect(actions.onAppearanceChange).toHaveBeenLastCalledWith({
      kind: 'shape',
      fillColor: '#ffd0cc',
      strokeColor: '#c5352c',
      strokeWidth: 2,
      invert: true,
    });
  });

  it('does not resurrect an abandoned width draft when canonical history returns to its source value', async () => {
    const user = userEvent.setup();
    const view = render(<LayerProperties layer={route(4)} {...actions} />);
    const width = screen.getByRole('spinbutton', { name: 'Route width' });
    await user.clear(width);
    await user.type(width, '8');

    view.rerender(<LayerProperties layer={route(6)} {...actions} />);
    expect(screen.getByRole('spinbutton', { name: 'Route width' })).toHaveValue(6);
    view.rerender(<LayerProperties layer={route(4)} {...actions} />);

    expect(screen.getByRole('spinbutton', { name: 'Route width' })).toHaveValue(4);
    expect(actions.onAppearanceChange).not.toHaveBeenCalled();
  });

  it('accepts zero and does not impose a maximum route width', async () => {
    const user = userEvent.setup();
    const view = render(<LayerProperties layer={route(4)} {...actions} />);
    const width = screen.getByRole('spinbutton', { name: 'Route width' });
    expect(width).toHaveAttribute('min', '0');
    expect(width).not.toHaveAttribute('max');

    await user.clear(width);
    await user.type(width, '0');
    await user.tab();
    expect(actions.onAppearanceChange).toHaveBeenLastCalledWith({
      ...route(4).appearance,
      width: 0,
    });

    view.rerender(<LayerProperties layer={route(0)} {...actions} />);
    await user.clear(screen.getByRole('spinbutton', { name: 'Route width' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Route width' }), '24');
    await user.tab();
    expect(actions.onAppearanceChange).toHaveBeenLastCalledWith({
      ...route(0).appearance,
      width: 24,
    });
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

  it('does not offer destructive map matching for a Directions route', async () => {
    const user = userEvent.setup();
    const directionsRoute = route(4);
    directionsRoute.provenance = {
      provider: 'mapbox',
      service: 'directions-v5',
      waypoints: [[0, 0], [1, 1]],
      profile: 'driving',
      distanceMeters: 100,
      durationSeconds: 10,
    };
    render(
      <LayerProperties
        layer={directionsRoute}
        {...actions}
        onApplyMapMatching={vi.fn()}
      />,
    );

    const advanced = screen.getByRole('button', { name: /Advanced/ });
    expect(advanced).toHaveTextContent('Waypoints · Elevation profile');
    await user.click(advanced);

    expect(screen.queryByRole('combobox', { name: 'Road matching travel mode' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Route waypoint' })).toBeInTheDocument();
  });
});
