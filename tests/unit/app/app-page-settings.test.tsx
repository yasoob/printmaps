import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { exportMocks } from './exportMocks';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('editor page settings and tools', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
  });

  it('exposes project fields, tool state, and page disclosure accessibly', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('combobox', { name: 'Page preset' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Map style' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Bearing' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Pitch' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Text scale' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Show roads' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Show buildings' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Show labels' })).toBeChecked();
    const exportResolution = screen.getByRole('combobox', { name: 'Export resolution' });
    expect(exportResolution).toHaveValue('Browser preview');
    expect(exportResolution).toBeDisabled();
    const attribution = screen.getByRole('checkbox', { name: 'Include map attribution' });
    expect(attribution).toBeChecked();
    expect(attribution).toBeDisabled();
    const mapboxAlert = screen.getByRole('alert');
    expect(mapboxAlert).toHaveTextContent('Mapbox services unavailable');
    expect(mapboxAlert).toHaveTextContent('VITE_MAPBOX_PUBLIC_ACCESS');

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
    expect(screen.getByRole('textbox', { name: 'Page width' })).toHaveValue('210');
    expect(screen.getByRole('textbox', { name: 'Page height' })).toHaveValue('297');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-orientation', 'portrait');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(landscape).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('textbox', { name: 'Page width' })).toHaveValue('297');
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
    expect(screen.getByRole('textbox', { name: 'Page width' })).toHaveValue('420');
    expect(screen.getByRole('textbox', { name: 'Page height' })).toHaveValue('297');
    expect(map).toHaveAttribute('data-page-preset', 'A3');
    expect(map).toHaveAttribute('data-page-size', '420x297');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(preset).toHaveValue('A4');
    expect(screen.getByRole('textbox', { name: 'Page width' })).toHaveValue('297');
    expect(map).toHaveAttribute('data-page-preset', 'A4');
  });
});

describe('editor map style controls', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
  });

  it('applies a canonical open map style as one undoable change', async () => {
    const user = userEvent.setup();
    render(<App />);
    const style = screen.getByRole('combobox', { name: 'Map style' });
    const map = screen.getByTestId('map-canvas');

    await user.selectOptions(style, 'positron');

    expect(style).toHaveValue('positron');
    expect(map).toHaveAttribute('data-style-preset', 'positron');
    expect(screen.getByRole('button', { name: 'Select Positron basemap' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(style).toHaveValue('liberty');
    expect(map).toHaveAttribute('data-style-preset', 'liberty');
    expect(screen.getByRole('button', { name: 'Select Liberty basemap' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(style).toHaveValue('positron');
    expect(map).toHaveAttribute('data-style-preset', 'positron');
  });

  it('offers the Bright open style as a canonical undoable preset', async () => {
    const user = userEvent.setup();
    render(<App />);
    const style = screen.getByRole('combobox', { name: 'Map style' });
    const map = screen.getByTestId('map-canvas');

    await user.selectOptions(style, 'bright');

    expect(style).toHaveValue('bright');
    expect(map).toHaveAttribute('data-style-preset', 'bright');
    expect(screen.getByRole('button', { name: 'Select Bright basemap' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(style).toHaveValue('liberty');
    expect(map).toHaveAttribute('data-style-preset', 'liberty');
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
    const textScale = screen.getByRole('textbox', { name: 'Text scale' });
    const undo = screen.getByRole('button', { name: 'Undo' });
    const map = screen.getByTestId('map-canvas');

    await user.clear(textScale);
    await user.type(textScale, '125');
    expect(undo).toBeDisabled();
    await user.tab();

    expect(textScale).toHaveValue('125');
    expect(map).toHaveAttribute('data-text-scale', '125');
    await user.click(undo);
    expect(screen.getByRole('textbox', { name: 'Text scale' })).toHaveValue('100');
    expect(map).toHaveAttribute('data-text-scale', '100');
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByRole('textbox', { name: 'Text scale' })).toHaveValue('125');
    expect(map).toHaveAttribute('data-text-scale', '125');
  });

  it('marks an invalid global text scale and restores the canonical value without history', async () => {
    const user = userEvent.setup();
    render(<App />);
    const textScale = screen.getByRole('textbox', { name: 'Text scale' });

    await user.clear(textScale);
    await user.type(textScale, '201');
    expect(textScale).toHaveAttribute('aria-invalid', 'true');
    await user.tab();

    expect(screen.getByRole('textbox', { name: 'Text scale' })).toHaveValue('100');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

describe('editor map detail and page commands', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
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
    const field = screen.getByRole('textbox', { name: 'Page width' });
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
    const field = screen.getByRole('textbox', { name: 'Page width' });
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
    const pan = screen.getByRole('button', { name: 'Pan (H)' });
    const map = screen.getByTestId('map-canvas');
    expect(map).toHaveAttribute('data-fit-request', '0');
    await user.click(pan);
    await user.click(screen.getByRole('button', { name: 'Fit page (Shift+1)' }));
    expect(pan).toHaveAttribute('aria-pressed', 'true');
    expect(map).toHaveAttribute('data-fit-request', '1');
  });
});
