import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { exportMocks } from './exportMocks';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('editor page settings and tools', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
  });

  it('exposes project fields, tool state, and page disclosure accessibly', () => {
    render(<App />);

    expect(screen.getByRole('combobox', { name: 'Page preset' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Map style presets' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Bearing' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Pitch' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Text scale' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Show roads' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Show buildings' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Show labels' })).toBeChecked();
    expect(screen.queryByRole('button', { name: /Output settings/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Export resolution' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Include map attribution' })).not.toBeInTheDocument();

    const select = screen.getByRole('button', { name: 'Select (V)' });
    expect(select).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'More map tools' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fit page' })).toBeEnabled();

    expect(screen.queryByRole('button', { name: 'Page 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add page' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Map layers' })).toBeInTheDocument();
  });

  it('commits project orientation to history and keeps the canvas and dimensions synchronized', async () => {
    const user = userEvent.setup();
    render(<App />);
    const landscape = screen.getByRole('button', { name: 'Landscape' });
    const portrait = screen.getByRole('button', { name: 'Portrait' });

    expect(landscape).toHaveAttribute('aria-pressed', 'true');
    expect(portrait).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-orientation', 'landscape');
    await user.click(portrait);
    expect(landscape).toHaveAttribute('aria-pressed', 'false');
    expect(portrait).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('spinbutton', { name: 'Page width' })).toHaveValue(210);
    expect(screen.getByRole('spinbutton', { name: 'Page height' })).toHaveValue(297);
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-orientation', 'portrait');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(landscape).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('spinbutton', { name: 'Page width' })).toHaveValue(297);
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-orientation', 'landscape');

    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(portrait).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-orientation', 'portrait');
  });

  it('applies a standard page preset to properties and canvas as one undoable change', async () => {
    const user = userEvent.setup();
    render(<App />);
    const preset = screen.getByRole('combobox', { name: 'Page preset' });
    const map = screen.getByTestId('map-canvas');

    await user.selectOptions(preset, 'A3');

    expect(preset).toHaveValue('A3');
    expect(screen.getByRole('spinbutton', { name: 'Page width' })).toHaveValue(420);
    expect(screen.getByRole('spinbutton', { name: 'Page height' })).toHaveValue(297);
    expect(map).toHaveAttribute('data-page-preset', 'A3');
    expect(map).toHaveAttribute('data-page-size', '420x297');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(preset).toHaveValue('A4');
    expect(screen.getByRole('spinbutton', { name: 'Page width' })).toHaveValue(297);
    expect(map).toHaveAttribute('data-page-preset', 'A4');
  });

  it('supports the requested map-size preset catalogue', async () => {
    const user = userEvent.setup();
    render(<App />);
    const preset = screen.getByRole('combobox', { name: 'Page preset' });

    expect([...preset.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      'A2', 'A3', 'A4', 'A5', 'A6', 'US Letter', 'Custom',
    ]);
    for (const [value, expectedWidth, expectedHeight] of [
      ['A2', 594, 420],
      ['A3', 420, 297],
      ['A4', 297, 210],
      ['A5', 210, 148],
      ['A6', 148, 105],
      ['US Letter', 279.4, 215.9],
    ] as const) {
      await user.selectOptions(preset, value);
      expect(screen.getByRole('spinbutton', { name: 'Page width' })).toHaveValue(expectedWidth);
      expect(screen.getByRole('spinbutton', { name: 'Page height' })).toHaveValue(expectedHeight);
    }

    await user.selectOptions(preset, 'Custom');
    expect(preset).toHaveValue('Custom');
    expect(screen.getByRole('spinbutton', { name: 'Page width' })).toHaveValue(279.4);
    expect(screen.getByRole('spinbutton', { name: 'Page height' })).toHaveValue(215.9);
  });

  it('scrubs a page dimension through its InputGroup addon as one undoable change', () => {
    render(<App />);
    const width = screen.getByRole('spinbutton', { name: 'Page width' });
    const widthAddon = screen.getByText('W');

    expect(width).toBeValid();
    expect(width).toHaveAttribute('min', '0.1');
    expect(width).toHaveAttribute('step', '0.1');
    fireEvent.pointerDown(widthAddon, { button: 0, clientX: 10, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 18, pointerId: 1 });
    expect(width).toHaveValue(299);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    fireEvent.pointerUp(window, { clientX: 18, pointerId: 1 });

    expect(screen.getByRole('combobox', { name: 'Page preset' })).toHaveValue('Custom');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-page-size', '299x210');
  });
});

describe('editor map style controls', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
  });

  it('applies a canonical open map style as one undoable change', async () => {
    const user = userEvent.setup();
    render(<App />);
    const map = screen.getByTestId('map-canvas');

    await user.click(screen.getByRole('radio', { name: /Night Ink/ }));

    expect(map).toHaveAttribute('data-style-preset', 'night-ink');
    expect(screen.getByRole('button', { name: 'Select Night Ink basemap' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(map).toHaveAttribute('data-style-preset', 'paper');
    expect(screen.getByRole('button', { name: 'Select Paper basemap' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(map).toHaveAttribute('data-style-preset', 'night-ink');
  });

  it('offers the Coastal open style as a canonical undoable preset', async () => {
    const user = userEvent.setup();
    render(<App />);
    const map = screen.getByTestId('map-canvas');

    await user.click(screen.getByRole('radio', { name: /Coastal/ }));

    expect(map).toHaveAttribute('data-style-preset', 'coastal');
    expect(screen.getByRole('button', { name: 'Select Coastal basemap' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(map).toHaveAttribute('data-style-preset', 'paper');
  });

  it('changes the canonical map language as one undoable edit', async () => {
    const user = userEvent.setup();
    render(<App />);
    const language = screen.getByRole('combobox', { name: 'Map language' });
    const map = screen.getByTestId('map-canvas');

    expect(language).toHaveValue('local');
    await user.selectOptions(language, 'de');

    expect(language).toHaveValue('de');
    expect(map).toHaveAttribute('data-map-language', 'de');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(language).toHaveValue('local');
    expect(map).toHaveAttribute('data-map-language', 'local');
  });

  it('commits global text scale on blur and keeps Undo and Redo synchronized with the canvas', async () => {
    const user = userEvent.setup();
    render(<App />);
    const textScale = screen.getByRole('spinbutton', { name: 'Text scale' });
    const undo = screen.getByRole('button', { name: 'Undo' });
    const map = screen.getByTestId('map-canvas');

    await user.clear(textScale);
    await user.type(textScale, '125');
    expect(undo).toBeDisabled();
    await user.tab();

    expect(textScale).toHaveValue(125);
    expect(map).toHaveAttribute('data-text-scale', '125');
    await user.click(undo);
    expect(screen.getByRole('spinbutton', { name: 'Text scale' })).toHaveValue(100);
    expect(map).toHaveAttribute('data-text-scale', '100');
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByRole('spinbutton', { name: 'Text scale' })).toHaveValue(125);
    expect(map).toHaveAttribute('data-text-scale', '125');
  });

  it('marks an invalid global text scale and restores the canonical value without history', async () => {
    const user = userEvent.setup();
    render(<App />);
    const textScale = screen.getByRole('spinbutton', { name: 'Text scale' });

    await user.clear(textScale);
    await user.type(textScale, '201');
    expect(textScale).toHaveAttribute('aria-invalid', 'true');
    await user.tab();

    expect(screen.getByRole('spinbutton', { name: 'Text scale' })).toHaveValue(100);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

describe('editor map detail and page commands', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
  });

  it('locks map movement as one undoable project change', async () => {
    const user = userEvent.setup();
    render(<App />);
    const lock = screen.getByRole('switch', { name: 'Lock map area' });
    const fit = screen.getByRole('button', { name: 'Fit page' });
    const map = screen.getByTestId('map-canvas');

    expect(lock).not.toBeChecked();
    expect(fit).toBeEnabled();
    expect(map).toHaveAttribute('data-map-area-locked', 'false');

    await user.click(lock);

    expect(lock).toBeChecked();
    expect(fit).toBeDisabled();
    expect(map).toHaveAttribute('data-map-area-locked', 'true');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(lock).not.toBeChecked();
    expect(fit).toBeEnabled();
    expect(map).toHaveAttribute('data-map-area-locked', 'false');
  });

  it('centers the map from browser geolocation and gates the action while locked', async () => {
    let succeed: PositionCallback | undefined;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => { succeed = success; },
      },
    });
    const user = userEvent.setup();
    render(<App />);
    const locate = screen.getByRole('button', { name: 'Use my location' });
    const map = screen.getByTestId('map-canvas');

    await user.click(locate);
    act(() => succeed?.({ coords: { longitude: 16.37, latitude: 48.21 } } as GeolocationPosition));

    expect(map).toHaveAttribute('data-map-location-request', '1:16.37,48.21');
    expect(screen.getByRole('status')).toHaveTextContent('Map centered');

    await user.click(screen.getByRole('switch', { name: 'Lock map area' }));
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeDisabled();
    expect(screen.getByText('Unlock the map area to use your location.')).toBeInTheDocument();
  });

  it('stores a finished map movement and restores the prior viewport with Undo', async () => {
    const user = userEvent.setup();
    render(<App />);
    const map = screen.getByTestId('map-canvas');
    expect(map).toHaveAttribute('data-camera', '16.3725,48.2084,11.2,0,0');

    await user.click(screen.getByRole('button', { name: 'Finish map movement' }));

    expect(map).toHaveAttribute('data-camera', '16.41,48.23,13.5,0,0');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(map).toHaveAttribute('data-camera', '16.3725,48.2084,11.2,0,0');
  });

  it('toggles a map feature category as one undoable change', async () => {
    const user = userEvent.setup();
    render(<App />);
    const roads = screen.getByRole('checkbox', { name: 'Show roads' });
    const map = screen.getByTestId('map-canvas');

    await user.click(roads);

    expect(roads).not.toBeChecked();
    expect(map).toHaveAttribute('data-map-feature-visibility', 'roads:false,buildings:true,labels:true,water:true,parks:true,landuse:true,transit:true');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(roads).toBeChecked();
    expect(map).toHaveAttribute('data-map-feature-visibility', 'roads:true,buildings:true,labels:true,water:true,parks:true,landuse:true,transit:true');
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(roads).not.toBeChecked();
  });

  it('toggles water detail as one undoable map change', async () => {
    const user = userEvent.setup();
    render(<App />);
    const water = screen.getByRole('checkbox', { name: 'Show water' });
    const map = screen.getByTestId('map-canvas');

    await user.click(water);

    expect(water).not.toBeChecked();
    expect(map).toHaveAttribute('data-map-feature-visibility', 'roads:true,buildings:true,labels:true,water:false,parks:true,landuse:true,transit:true');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(water).toBeChecked();
  });

  it('toggles park detail as one undoable map change', async () => {
    const user = userEvent.setup();
    render(<App />);
    const parks = screen.getByRole('checkbox', { name: 'Show parks' });

    await user.click(parks);

    expect(parks).not.toBeChecked();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-map-feature-visibility', 'roads:true,buildings:true,labels:true,water:true,parks:false,landuse:true,transit:true');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(parks).toBeChecked();
  });

  it('toggles land detail as one undoable map change', async () => {
    const user = userEvent.setup();
    render(<App />);
    const land = screen.getByRole('checkbox', { name: 'Show land detail' });

    await user.click(land);

    expect(land).not.toBeChecked();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-map-feature-visibility', 'roads:true,buildings:true,labels:true,water:true,parks:true,landuse:false,transit:true');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(land).toBeChecked();
  });

  it('toggles transit detail as one undoable map change', async () => {
    const user = userEvent.setup();
    render(<App />);
    const transit = screen.getByRole('checkbox', { name: 'Show transit' });

    await user.click(transit);

    expect(transit).not.toBeChecked();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-map-feature-visibility', 'roads:true,buildings:true,labels:true,water:true,parks:true,landuse:true,transit:false');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(transit).toBeChecked();
  });

  it('keeps the A4 preset and history unchanged when page width is blurred without editing', async () => {
    const user = userEvent.setup();
    render(<App />);
    const field = screen.getByRole('spinbutton', { name: 'Page width' });
    const preset = screen.getByRole('combobox', { name: 'Page preset' });
    const undo = screen.getByRole('button', { name: 'Undo' });

    await user.click(field);
    await user.tab();

    expect(preset).toHaveValue('A4');
    expect(undo).toBeDisabled();
  });

  it('commits an unchanged valid page dimension as Custom on blur', async () => {
    const user = userEvent.setup();
    render(<App />);
    const field = screen.getByRole('spinbutton', { name: 'Page width' });
    const preset = screen.getByRole('combobox', { name: 'Page preset' });
    const undo = screen.getByRole('button', { name: 'Undo' });

    await user.clear(field);
    await user.type(field, '297');
    expect(undo).toBeDisabled();
    await user.tab();

    expect(preset).toHaveValue('Custom');
    expect(undo).toBeEnabled();
    await user.click(undo);
    expect(preset).toHaveValue('A4');
    expect(undo).toBeDisabled();
  });
  it('fits the page without changing the persistent tool', async () => {
    const user = userEvent.setup();
    render(<App />);
    const map = screen.getByTestId('map-canvas');
    const select = screen.getByRole('button', { name: 'Select (V)' });
    expect(map).toHaveAttribute('data-fit-request', '0');
    await user.click(screen.getByRole('button', { name: 'Fit page' }));
    expect(select).toHaveAttribute('aria-pressed', 'true');
    expect(map).toHaveAttribute('data-fit-request', '1');
  });
});
