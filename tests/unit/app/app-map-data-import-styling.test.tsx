import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

const mixedGeoJson = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Styled point' }, geometry: { type: 'Point', coordinates: [16.37, 48.21] } },
    { type: 'Feature', properties: { name: 'Styled route' }, geometry: { type: 'LineString', coordinates: [[16.36, 48.2], [16.38, 48.22]] } },
    { type: 'Feature', properties: { name: 'Styled shape' }, geometry: { type: 'Polygon', coordinates: [[[16.35, 48.2], [16.39, 48.2], [16.37, 48.23], [16.35, 48.2]]] } },
  ],
});

function mapDataFile(name: string) {
  const file = new File([], name, { type: 'application/geo+json' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(mixedGeoJson) });
  return file;
}

describe('reviewed map-data batch styling', () => {
  it('gates invalid styling and commits one style per imported content type', async () => {
    const user = userEvent.setup();
    const { container } = render(<App autosaveRepository={null} />);
    const importInput = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
    fireEvent.change(importInput, {
      target: { files: [mapDataFile('first.geojson'), mapDataFile('second.geojson')] },
    });

    const dialog = await screen.findByRole('dialog', { name: 'Import map data' });
    const commit = within(dialog).getByRole('button', { name: 'Import 2 files' });
    expect(within(dialog).getByRole('group', { name: 'Style imported routes' })).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'Style imported POIs' })).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'Style imported shapes' })).toBeInTheDocument();

    await user.clear(within(dialog).getByRole('textbox', { name: 'Import route width' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Import route width' }), '17');
    expect(within(dialog).getByRole('textbox', { name: 'Import route width' })).toHaveAttribute('aria-invalid', 'true');
    expect(commit).toBeDisabled();

    await user.clear(within(dialog).getByRole('textbox', { name: 'Import route width' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Import route width' }), '7');
    fireEvent.change(within(dialog).getByLabelText('Import route color'), { target: { value: '#112233' } });
    await user.clear(within(dialog).getByRole('textbox', { name: 'Import POI marker size' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Import POI marker size' }), '22');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Import POI marker shape' }), 'diamond');
    fireEvent.change(within(dialog).getByLabelText('Import POI color'), { target: { value: '#445566' } });
    await user.clear(within(dialog).getByRole('textbox', { name: 'Import shape outline width' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Import shape outline width' }), '3');
    fireEvent.change(within(dialog).getByLabelText('Import shape fill color'), { target: { value: '#778899' } });
    fireEvent.change(within(dialog).getByLabelText('Import shape outline color'), { target: { value: '#aabbcc' } });
    expect(commit).toBeEnabled();
    await user.click(commit);

    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Styled point' })).toBeVisible();
    expect(screen.getByLabelText('POI color')).toHaveValue('#445566');
    expect(screen.getByRole('spinbutton', { name: 'POI marker size' })).toHaveValue(22);
    expect(screen.getByRole('combobox', { name: 'POI marker shape' })).toHaveValue('diamond');

    await user.click(screen.getAllByRole('button', { name: 'Select Styled route' })[0]);
    expect(screen.getByLabelText('Route color')).toHaveValue('#112233');
    expect(screen.getByRole('spinbutton', { name: 'Route width' })).toHaveValue(7);

    await user.click(screen.getAllByRole('button', { name: 'Select Styled shape' })[0]);
    expect(screen.getByLabelText('Shape fill color')).toHaveValue('#778899');
    expect(screen.getByLabelText('Shape outline color')).toHaveValue('#aabbcc');
    expect(screen.getByRole('spinbutton', { name: 'Shape outline width' })).toHaveValue(3);
  });
});
