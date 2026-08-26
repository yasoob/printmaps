import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

const square = {
  type: 'Polygon' as const,
  coordinates: [[[15, 47], [16, 47], [16, 48], [15, 47]]],
};

it('explains when generated countries are available only at country level', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/data/administrative/index.json')) {
      return Response.json({
        schemaVersion: 1,
        sourceVersion: 'Natural Earth 5.1.1',
        countries: [
          { id: 'AUT', name: 'Austria', bounds: [9, 46, 17, 50], levels: ['country', 'region'], shard: 'countries/AUT.json' },
          { id: 'BJN', name: 'Bajo Nuevo Bank', bounds: [-80, 15, -79, 16], levels: ['country'], shard: 'countries/BJN.json' },
        ],
      });
    }
    if (url.endsWith('/data/administrative/countries/AUT.json')) {
      return Response.json({
        schemaVersion: 1,
        country: { id: 'AUT', name: 'Austria', sourceId: 'NE-AUT', geometry: square },
        regions: [{ id: 'AT-9', name: 'Vienna', sourceId: 'NE-AT-9', geometry: square }],
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });

  try {
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Region country' })).toHaveValue('AUT'));
    expect(screen.getByText('1 country has regional boundaries. 1 country is available at Country level only.')).toBeVisible();
  } finally {
    fetchMock.mockRestore();
  }
});
