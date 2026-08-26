import { act, render, screen, waitFor, within } from '@testing-library/react';
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

it('loads a generated country shard and creates an area outside the legacy catalogue', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/data/administrative/index.json')) {
      return Response.json({
        schemaVersion: 1,
        sourceVersion: 'Natural Earth 5.1.1',
        countries: [
          { id: 'AUT', name: 'Austria', bounds: [9, 46, 17, 50], levels: ['country', 'region'], shard: 'countries/AUT.json' },
          { id: 'JPN', name: 'Japan', bounds: [129, 31, 146, 46], levels: ['country', 'region'], shard: 'countries/JPN.json' },
        ],
      });
    }
    if (url.endsWith('/data/administrative/countries/AUT.json')) {
      return Response.json({
        schemaVersion: 1,
        country: { id: 'AUT', name: 'Austria', sourceId: 'NE-AUT', geometry: square(15, 47) },
        regions: [{ id: 'AT-9', name: 'Vienna', sourceId: 'NE-AT-9', geometry: square(16, 48) }],
      });
    }
    if (url.endsWith('/data/administrative/countries/JPN.json')) {
      return Response.json({
        schemaVersion: 1,
        country: { id: 'JPN', name: 'Japan', sourceId: 'NE-JPN', geometry: square(135, 34) },
        regions: [{ id: 'JP-26', name: 'Kyoto', sourceId: 'NE-JP-26', geometry: square(135, 35) }],
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });

  try {
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Region country' }), 'JPN');

    const regions = await screen.findByRole('group', { name: 'Japan regions' });
    await user.click(within(regions).getByRole('checkbox', { name: 'Kyoto' }));
    await user.click(screen.getByRole('button', { name: 'Add selected area' }));

    expect(screen.getByRole('button', { name: 'Select Kyoto' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-fit-layer-id', 'admin-jp-26');
    expect(fetchMock.mock.calls.filter(([request]) => String(request).endsWith('/countries/JPN.json'))).toHaveLength(1);
  } finally {
    fetchMock.mockRestore();
  }
});

it('loads a generated country shard and creates a country outside the legacy catalogue', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/data/administrative/index.json')) {
      return Response.json({
        schemaVersion: 1,
        sourceVersion: 'Natural Earth 5.1.1',
        countries: [
          { id: 'AUT', name: 'Austria', bounds: [9, 46, 17, 50], levels: ['country', 'region'], shard: 'countries/AUT.json' },
          { id: 'JPN', name: 'Japan', bounds: [129, 31, 146, 46], levels: ['country', 'region'], shard: 'countries/JPN.json' },
        ],
      });
    }
    if (url.endsWith('/data/administrative/countries/JPN.json')) {
      return Response.json({
        schemaVersion: 1,
        country: { id: 'JPN', name: 'Japan', sourceId: 'NE-JPN', geometry: square(135, 34) },
        regions: [{ id: 'JP-26', name: 'Kyoto', sourceId: 'NE-JP-26', geometry: square(135, 35) }],
      });
    }
    if (url.endsWith('/data/administrative/countries/AUT.json')) {
      return Response.json({
        schemaVersion: 1,
        country: { id: 'AUT', name: 'Austria', sourceId: 'NE-AUT', geometry: square(15, 47) },
        regions: [{ id: 'AT-9', name: 'Vienna', sourceId: 'NE-AT-9', geometry: square(16, 48) }],
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });

  try {
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    const countries = screen.getByRole('combobox', { name: 'Administrative area' });
    await waitFor(() => expect(within(countries).getByRole('option', { name: 'Japan' })).toBeInTheDocument());
    await user.selectOptions(countries, 'JPN');

    expect(await screen.findByRole('status', { name: 'Administrative country status' })).toHaveTextContent('Japan boundary loaded.');
    await user.click(screen.getByRole('button', { name: 'Add administrative area' }));

    expect(screen.getByRole('button', { name: 'Select Japan' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-fit-layer-id', 'admin-jpn');
    expect(fetchMock.mock.calls.filter(([request]) => String(request).endsWith('/countries/JPN.json'))).toHaveLength(1);
  } finally {
    fetchMock.mockRestore();
  }
});

it('does not fall back to bundled country geometry after generated catalogue activation', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/data/administrative/index.json')) {
      return Response.json({
        schemaVersion: 1,
        sourceVersion: 'Natural Earth 5.1.1',
        countries: [
          { id: 'AUT', name: 'Austria', bounds: [9, 46, 17, 50], levels: ['country'], shard: 'countries/AUT.json' },
        ],
      });
    }
    if (url.endsWith('/data/administrative/countries/AUT.json')) throw new Error('Shard unavailable');
    throw new Error(`Unexpected fetch: ${url}`);
  });

  try {
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));

    expect(await screen.findByRole('status', { name: 'Administrative country status' })).toHaveTextContent('Austria boundary unavailable. Shard unavailable');
    expect(screen.getByRole('button', { name: 'Add administrative area' })).toBeDisabled();
  } finally {
    fetchMock.mockRestore();
  }
});

it('keeps deferred catalogue status and data scoped to the selected country', async () => {
  const user = userEvent.setup();
  const indexResponse = deferred<Response>();
  const slovakiaResponse = deferred<Response>();
  const austriaResponse = deferred<Response>();
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input);
    if (url.endsWith('/data/administrative/index.json')) return indexResponse.promise;
    if (url.endsWith('/data/administrative/countries/SVK.json')) return slovakiaResponse.promise;
    if (url.endsWith('/data/administrative/countries/AUT.json')) return austriaResponse.promise;
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  try {
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Region country' }), 'SVK');

    await act(async () => indexResponse.resolve(Response.json({
      schemaVersion: 1,
      sourceVersion: 'Deferred source',
      countries: [
        { id: 'AUT', name: 'Austria', bounds: [9, 46, 17, 50], levels: ['country', 'region'], shard: 'countries/AUT.json' },
        { id: 'SVK', name: 'Slovakia', bounds: [16, 47, 23, 50], levels: ['country', 'region'], shard: 'countries/SVK.json' },
      ],
    })));
    await waitFor(() => expect(fetchMock.mock.calls.some(([request]) => String(request).endsWith('/countries/SVK.json'))).toBe(true));
    expect(screen.getByRole('status', { name: 'Administrative catalogue status' })).toHaveTextContent('Loading Slovakia boundaries…');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Region country' }), 'AUT');
    await waitFor(() => expect(fetchMock.mock.calls.some(([request]) => String(request).endsWith('/countries/AUT.json'))).toBe(true));
    expect(screen.getByRole('status', { name: 'Administrative catalogue status' })).toHaveTextContent('Loading Austria boundaries…');

    await act(async () => {
      slovakiaResponse.resolve(Response.json({
        schemaVersion: 1,
        country: { id: 'SVK', name: 'Slovakia', sourceId: 'NE-SVK', geometry: square(19, 48) },
        regions: [{ id: 'SK-DEFERRED', name: 'Deferred Slovakia', sourceId: 'NE-SK', geometry: square(20, 48) }],
      }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByRole('status', { name: 'Administrative catalogue status' })).toHaveTextContent('Loading Austria boundaries…');
    expect(screen.queryByRole('checkbox', { name: 'Deferred Slovakia' })).not.toBeInTheDocument();

    await act(async () => austriaResponse.resolve(Response.json({
      schemaVersion: 1,
      country: { id: 'AUT', name: 'Austria', sourceId: 'NE-AUT', geometry: square(15, 47) },
      regions: [{ id: 'AT-DEFERRED', name: 'Deferred Austria', sourceId: 'NE-AT', geometry: square(16, 48) }],
    })));
    expect(await screen.findByRole('checkbox', { name: 'Deferred Austria' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Administrative catalogue status' })).toHaveTextContent('1 Austria region loaded.');
  } finally {
    fetchMock.mockRestore();
  }
});
