import { fireEvent, render, screen } from '@testing-library/react';
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
    await user.click(screen.getByRole('switch', { name: 'Toggle layer visibility' }));

    expect(screen.getByRole('heading', { name: 'Danube route' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Toggle layer visibility' })).not.toBeChecked();
  });

  it('moves focus to Project properties after deleting the final layer', async () => {
    const user = userEvent.setup();
    render(<App />);

    for (const layerName of ['Route 01', 'Coffee stop', 'City center', 'Paper basemap']) {
      await user.click(screen.getByRole('button', { name: `Select ${layerName}` }));
      await user.click(screen.getByRole('button', { name: 'Layer menu' }));
      await user.click(screen.getByRole('menuitem', { name: 'Delete layer' }));
    }

    expect(screen.getByRole('heading', { name: 'Project' })).toHaveFocus();
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

    const opacity = screen.getByRole('spinbutton', { name: 'Layer opacity' });
    await user.clear(opacity);
    await user.type(opacity, '150');
    await user.tab();
    expect(screen.getByRole('spinbutton', { name: 'Layer opacity' })).toHaveValue(100);
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
    const opacity = screen.getByRole('spinbutton', { name: 'Layer opacity' });
    await user.click(opacity);
    await user.keyboard('{Control>}a{/Control}55');
    await user.tab();
    expect(opacity).toHaveValue(55);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('spinbutton', { name: 'Layer opacity' })).toHaveValue(28);
  });
});

describe('editor content appearance and POI geometry fields', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
    window.localStorage.removeItem('print-map-studio:inspector:layer:route-advanced');
  });

  it('commits route color and width as separate undoable appearance edits', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
    const color = screen.getByLabelText('Route color');
    const width = screen.getByRole('spinbutton', { name: 'Route width' });

    fireEvent.change(color, { target: { value: '#123456' } });
    await user.clear(width);
    await user.type(width, '8');
    await user.tab();

    expect(color).toHaveValue('#123456');
    expect(width).toHaveValue(8);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('spinbutton', { name: 'Route width' })).toHaveValue(4);
    expect(screen.getByLabelText('Route color')).toHaveValue('#123456');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByLabelText('Route color')).toHaveValue('#d9363e');
  });

  it('selects and moves one route vertex with live map feedback and history', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
    await user.click(screen.getByRole('button', { name: /Advanced/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Route vertex' }), '1');
    const longitude = screen.getByRole('textbox', { name: 'Route vertex longitude' });
    const latitude = screen.getByRole('textbox', { name: 'Route vertex latitude' });
    const map = screen.getByTestId('map-canvas');
    expect(longitude).toHaveValue('16.353');
    expect(latitude).toHaveValue('48.205');

    await user.clear(longitude);
    await user.type(longitude, '16.4');
    expect(map).toHaveAttribute('data-layer-geometry', expect.stringContaining('route-01:[[16.326,48.194],[16.353,48.205]'));
    await user.tab();

    expect(latitude).toHaveFocus();
    expect(map).toHaveAttribute('data-layer-geometry', expect.stringContaining('route-01:[[16.326,48.194],[16.4,48.205]'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('textbox', { name: 'Route vertex longitude' })).toHaveValue('16.353');
    expect(map).toHaveAttribute('data-layer-geometry', expect.stringContaining('route-01:[[16.326,48.194],[16.353,48.205]'));
  });

  it('rejects an invalid route vertex coordinate without changing geometry or history', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
    await user.click(screen.getByRole('button', { name: /Advanced/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Route vertex' }), '1');
    const longitude = screen.getByRole('textbox', { name: 'Route vertex longitude' });
    const map = screen.getByTestId('map-canvas');
    await user.clear(longitude);
    await user.type(longitude, '181');

    expect(longitude).toHaveAttribute('aria-invalid', 'true');
    expect(map).toHaveAttribute('data-layer-geometry', expect.stringContaining('route-01:[[16.326,48.194],[16.353,48.205]'));
    await user.tab();
    expect(screen.getByRole('textbox', { name: 'Route vertex longitude' })).toHaveValue('16.353');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('inserts and removes the selected route vertex with accessible controls', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
    await user.click(screen.getByRole('button', { name: /Advanced/ }));
    const vertex = screen.getByRole('combobox', { name: 'Route vertex' });
    await user.selectOptions(vertex, '1');
    await user.click(screen.getByRole('button', { name: 'Insert route vertex after selected' }));

    expect(vertex).toHaveValue('2');
    expect(vertex).toHaveAccessibleName('Route vertex');
    expect(screen.getByRole('textbox', { name: 'Route vertex longitude' })).toHaveValue('16.372');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute(
      'data-layer-geometry',
      expect.stringContaining('route-01:[[16.326,48.194],[16.353,48.205],[16.372,48.21]'),
    );

    await user.click(screen.getByRole('button', { name: 'Remove selected route vertex' }));
    expect(vertex).toHaveValue('2');
    expect(screen.getByRole('textbox', { name: 'Route vertex longitude' })).toHaveValue('16.391');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute(
      'data-layer-geometry',
      expect.stringContaining('route-01:[[16.326,48.194],[16.353,48.205],[16.391,48.215]'),
    );

    await user.click(screen.getByRole('switch', { name: 'Toggle layer visibility' }));
    expect(vertex).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Route vertex longitude' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Insert route vertex after selected' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove selected route vertex' })).toBeDisabled();
  });

  it('moves a shape vertex with live ring closure and history feedback', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select City center' }));
    const ring = screen.getByRole('combobox', { name: 'Shape ring' });
    const vertex = screen.getByRole('combobox', { name: 'Shape vertex' });
    const longitude = screen.getByRole('textbox', { name: 'Shape vertex longitude' });
    const map = screen.getByTestId('map-canvas');
    expect(ring).toHaveValue('0');
    expect(vertex).toHaveValue('0');
    expect(longitude).toHaveValue('16.354');

    await user.clear(longitude);
    await user.type(longitude, '16.35');
    await user.tab();

    expect(screen.getByRole('textbox', { name: 'Shape vertex latitude' })).toHaveFocus();
    expect(map).toHaveAttribute('data-layer-geometry', expect.stringContaining(
      'area-center:[[[16.35,48.198],[16.395,48.198],[16.395,48.22],[16.354,48.22],[16.35,48.198]]]',
    ));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('textbox', { name: 'Shape vertex longitude' })).toHaveValue('16.354');
  });

  it('marks and rejects a shape edit that would collapse the ring below three distinct vertices', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select City center' }));
    const vertex = screen.getByRole('combobox', { name: 'Shape vertex' });
    await user.selectOptions(vertex, '1');
    const secondLongitude = screen.getByRole('textbox', { name: 'Shape vertex longitude' });
    await user.clear(secondLongitude);
    await user.type(secondLongitude, '16.354');
    await user.tab();

    await user.selectOptions(vertex, '2');
    const thirdLongitude = screen.getByRole('textbox', { name: 'Shape vertex longitude' });
    await user.clear(thirdLongitude);
    await user.type(thirdLongitude, '16.354');

    expect(thirdLongitude).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Keep at least three distinct vertices in this ring.')).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('textbox', { name: 'Shape vertex longitude' })).toHaveValue('16.395');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('textbox', { name: 'Shape vertex longitude' })).toHaveValue('16.395');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

describe('editor POI appearance and geometry fields', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
  });

  it('commits POI color and marker size as undoable appearance edits', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    const color = screen.getByLabelText('POI color');
    const size = screen.getByRole('spinbutton', { name: 'POI marker size' });

    fireEvent.change(color, { target: { value: '#654321' } });
    await user.clear(size);
    await user.type(size, '24');
    await user.tab();

    expect(color).toHaveValue('#654321');
    expect(size).toHaveValue(24);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('spinbutton', { name: 'POI marker size' })).toHaveValue(14);
  });

  it('commits POI marker shape, symbol, and label as separate undoable edits', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    const shape = screen.getByRole('combobox', { name: 'POI marker shape' });

    await user.selectOptions(shape, 'diamond');
    expect(screen.getByRole('combobox', { name: 'POI marker shape' })).toHaveFocus();
    await user.tab();
    const symbol = screen.getByRole('combobox', { name: 'POI marker symbol' });
    expect(symbol).toHaveFocus();
    await user.selectOptions(symbol, 'coffee');
    expect(screen.getByRole('combobox', { name: 'POI marker symbol' })).toHaveFocus();
    await user.tab();
    const label = screen.getByRole('textbox', { name: 'POI label' });
    expect(label).toHaveFocus();
    await user.type(label, 'Café Central');
    await user.tab();

    expect(screen.getByRole('combobox', { name: 'POI marker shape' })).toHaveValue('diamond');
    expect(screen.getByRole('combobox', { name: 'POI marker symbol' })).toHaveValue('coffee');
    expect(screen.getByRole('textbox', { name: 'POI label' })).toHaveValue('Café Central');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('textbox', { name: 'POI label' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'POI marker symbol' })).toHaveValue('coffee');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('combobox', { name: 'POI marker symbol' })).toHaveValue('none');
    expect(screen.getByRole('combobox', { name: 'POI marker shape' })).toHaveValue('diamond');
  });

  it('rejects a POI label over 40 characters without changing history', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    const label = screen.getByRole('textbox', { name: 'POI label' });
    await user.type(label, 'x'.repeat(41));
    expect(label).toHaveAttribute('aria-invalid', 'true');
    await user.tab();

    expect(screen.getByRole('textbox', { name: 'POI label' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('commits a POI longitude edit to the live map as one undoable change', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    const longitude = screen.getByRole('textbox', { name: 'POI longitude' });
    const map = screen.getByTestId('map-canvas');
    expect(longitude).toHaveValue('16.3725');

    await user.clear(longitude);
    await user.type(longitude, '16.4');
    expect(map).toHaveAttribute('data-layer-geometry', expect.stringContaining('poi-cafe:[16.3725,48.2084]'));
    await user.tab();

    expect(longitude).toHaveValue('16.4');
    expect(screen.getByRole('textbox', { name: 'POI latitude' })).toHaveFocus();
    expect(map).toHaveAttribute('data-layer-geometry', expect.stringContaining('poi-cafe:[16.4,48.2084]'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('textbox', { name: 'POI longitude' })).toHaveValue('16.3725');
    expect(map).toHaveAttribute('data-layer-geometry', expect.stringContaining('poi-cafe:[16.3725,48.2084]'));
  });

  it('commits a POI latitude edit to the live map as one undoable change', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    const latitude = screen.getByRole('textbox', { name: 'POI latitude' });
    const map = screen.getByTestId('map-canvas');
    expect(latitude).toHaveValue('48.2084');

    await user.clear(latitude);
    await user.type(latitude, '48.25');
    await user.tab();

    expect(latitude).toHaveValue('48.25');
    expect(map).toHaveAttribute('data-layer-geometry', expect.stringContaining('poi-cafe:[16.3725,48.25]'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('textbox', { name: 'POI latitude' })).toHaveValue('48.2084');
  });

  it.each([
    ['POI longitude', '181', '16.3725'],
    ['POI latitude', '-91', '48.2084'],
  ])('rejects invalid %s without moving the POI or changing history', async (
    controlName,
    invalidValue,
    canonicalValue,
  ) => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    const control = screen.getByRole('textbox', { name: controlName });
    const map = screen.getByTestId('map-canvas');

    await user.clear(control);
    await user.type(control, invalidValue);
    expect(control).toHaveAttribute('aria-invalid', 'true');
    await user.tab();

    expect(screen.getByRole('textbox', { name: controlName })).toHaveValue(canonicalValue);
    expect(map).toHaveAttribute('data-layer-geometry', expect.stringContaining('poi-cafe:[16.3725,48.2084]'));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

describe('route travel-profile properties', () => {
  it('commits profile and marker visibility as separate undoable edits', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
    const profile = screen.getByRole('combobox', { name: 'Route travel profile' });
    const marker = screen.getByRole('checkbox', { name: 'Show travel-mode marker' });
    await user.selectOptions(profile, 'air');
    await user.click(marker);

    expect(profile).toHaveValue('air');
    expect(marker).toBeChecked();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-layer-state', expect.stringContaining('route-01:true'));

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('checkbox', { name: 'Show travel-mode marker' })).not.toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Route travel profile' })).toHaveValue('air');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('combobox', { name: 'Route travel profile' })).toHaveValue('car');
  });
});

describe('editor layer appearance validation and actions', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
  });

  it('commits shape fill, outline, width, and invert as undoable appearance edits', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select City center' }));
    const fill = screen.getByLabelText('Shape fill color');
    const stroke = screen.getByLabelText('Shape outline color');
    const width = screen.getByRole('spinbutton', { name: 'Shape outline width' });
    const invert = screen.getByRole('switch', { name: 'Invert shape fill' });

    fireEvent.change(fill, { target: { value: '#abcdef' } });
    fireEvent.change(stroke, { target: { value: '#123456' } });
    await user.clear(width);
    await user.type(width, '5');
    await user.tab();
    await user.click(invert);

    expect(fill).toHaveValue('#abcdef');
    expect(stroke).toHaveValue('#123456');
    expect(width).toHaveValue(5);
    expect(invert).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('switch', { name: 'Invert shape fill' })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('spinbutton', { name: 'Shape outline width' })).toHaveValue(2);
  });

  it.each([
    ['Route 01', 'Route width', '17', '4'],
    ['Coffee stop', 'POI marker size', '7', '14'],
    ['City center', 'Shape outline width', '13', '2'],
  ])('marks and restores an invalid %s appearance size without changing history', async (
    layerName,
    controlName,
    invalidValue,
    canonicalValue,
  ) => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: `Select ${layerName}` }));
    const control = screen.getByRole('spinbutton', { name: controlName });
    await user.clear(control);
    await user.type(control, invalidValue);
    expect(control).toHaveAttribute('aria-invalid', 'true');
    await user.tab();

    expect(control).toHaveValue(Number(canonicalValue));
    expect(control).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('ignores an empty opacity edit instead of coercing it to zero', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select City center' }));
    const opacity = screen.getByRole('spinbutton', { name: 'Layer opacity' });
    expect(opacity).toHaveValue(28);

    await user.clear(opacity);
    await user.tab();
    expect(opacity).toHaveValue(28);
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
