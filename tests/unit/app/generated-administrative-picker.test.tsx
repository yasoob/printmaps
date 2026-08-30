import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

const square = (west: number, south: number) => ({
  type: 'Polygon' as const,
  coordinates: [[
    [west, south],
    [west + 1, south],
    [west + 1, south + 1],
    [west, south],
  ]],
});

const countries = [
  { id: 'AUT', name: 'Austria', bounds: [9, 46, 17, 50], levels: ['country', 'region'], shard: 'countries/AUT.json' },
  { id: 'BJN', name: 'Bajo Nuevo Bank', bounds: [-80, 15, -79, 16], levels: ['country'], shard: 'countries/BJN.json' },
  { id: 'JPN', name: 'Japan', bounds: [129, 31, 146, 46], levels: ['country', 'region'], shard: 'countries/JPN.json' },
];

function catalogueFetch(input: RequestInfo | URL) {
  const url = String(input);
  if (url.endsWith('/data/administrative/index.json')) {
    return Promise.resolve(Response.json({ schemaVersion: 1, sourceVersion: 'Natural Earth 5.1.1', countries }));
  }
  if (url.endsWith('/data/administrative/countries/AUT.json')) {
    return Promise.resolve(Response.json({
      schemaVersion: 1,
      country: { id: 'AUT', name: 'Austria', sourceId: 'NE-AUT', geometry: square(15, 47) },
      regions: [{ id: 'AT-9', name: 'Vienna', sourceId: 'NE-AT-9', geometry: square(16, 48) }],
    }));
  }
  if (url.endsWith('/data/administrative/countries/BJN.json')) {
    return Promise.resolve(Response.json({
      schemaVersion: 1,
      country: { id: 'BJN', name: 'Bajo Nuevo Bank', sourceId: 'NE-BJN', geometry: square(-80, 15) },
      regions: [],
    }));
  }
  if (url.endsWith('/data/administrative/countries/JPN.json')) {
    return Promise.resolve(Response.json({
      schemaVersion: 1,
      country: { id: 'JPN', name: 'Japan', sourceId: 'NE-JPN', geometry: square(135, 34) },
      regions: [
        { id: 'JP-23', name: 'Aichi Prefecture', sourceId: 'NE-JP-23', geometry: square(136, 35) },
        { id: 'JP-21', name: 'Gifu Prefecture', sourceId: 'NE-JP-21', geometry: square(136.5, 35) },
        { id: 'JP-26', name: 'Kyoto', sourceId: 'NE-JP-26', geometry: square(135, 35) },
      ],
    }));
  }
  return Promise.reject(new Error(`Unexpected fetch: ${url}`));
}

async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await screen.findByRole('combobox', { name: 'Country' });
}

async function selectCountry(user: ReturnType<typeof userEvent.setup>, name: string) {
  const country = screen.getByRole('combobox', { name: 'Country' });
  await user.type(country, name);
  await user.click(await screen.findByRole('option', { name: new RegExp(name) }));
  await screen.findByRole('combobox', { name: 'Boundary' });
}

it('requires a country, then defaults its boundary to the entire country', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(catalogueFetch);
  try {
    render(<App autosaveRepository={null} />);
    await openPicker(user);
    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Boundary' })).toBeDisabled();
    await selectCountry(user, 'Austria');
    expect(screen.getByRole('combobox', { name: 'Boundary' })).toHaveValue('Austria');
    await user.click(screen.getByRole('button', { name: 'Add area' }));

    expect(screen.getByRole('button', { name: 'Select Austria' })).toHaveAttribute('aria-current', 'true');
  } finally {
    fetchMock.mockRestore();
  }
});

it('changes country, searches its regions, and lazily creates one region', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(catalogueFetch);
  try {
    render(<App autosaveRepository={null} />);
    await openPicker(user);
    await selectCountry(user, 'Japan');
    const boundary = screen.getByRole('combobox', { name: 'Boundary' });
    await user.clear(boundary);
    await user.type(boundary, 'Kyoto');
    await user.click(await screen.findByRole('option', { name: /Kyoto/ }));
    await user.click(screen.getByRole('button', { name: 'Add area' }));

    expect(screen.getByRole('button', { name: 'Select Kyoto' })).toHaveAttribute('aria-current', 'true');
    expect(fetchMock.mock.calls.filter(([request]) => String(request).endsWith('/countries/JPN.json'))).toHaveLength(1);
  } finally {
    fetchMock.mockRestore();
  }
});

it('offers only the entire country when no regional data exists', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(catalogueFetch);
  try {
    render(<App autosaveRepository={null} />);
    await openPicker(user);
    await selectCountry(user, 'Bajo');
    const boundary = screen.getByRole('combobox', { name: 'Boundary' });
    await user.click(boundary);

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: /Bajo Nuevo Bank/ })).toHaveTextContent('Entire country');
  } finally {
    fetchMock.mockRestore();
  }
});

it('stays fail-closed when the country catalogue is unavailable', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ schemaVersion: 999 }));
  try {
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));

    expect(await screen.findByRole('status', { name: 'Administrative catalogue status' }))
      .toHaveTextContent('Worldwide catalogue unavailable');
    expect(screen.getByRole('combobox', { name: 'Country' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Boundary' })).toBeDisabled();
  } finally {
    fetchMock.mockRestore();
  }
});
