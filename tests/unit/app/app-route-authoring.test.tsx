import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createInitialProjectDocument } from '../../../src/domain/project';
import type { DirectionsProvider, SearchProvider } from '../../../src/services/mapbox/contracts';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

it('adds selected search results as road-route waypoints before provider routing', async () => {
  const user = userEvent.setup();
  const directions = vi.fn<DirectionsProvider['directions']>().mockResolvedValue({
    routes: [{
      geometry: [[16.31, 48.19], [16.355, 48.215], [16.4, 48.24]],
      distanceMeters: 9200,
      durationSeconds: 1320,
    }],
    useBoundary: 'provider-response-use-requires-terms-review',
  });
  const search = vi.fn<SearchProvider['search']>().mockImplementation(async ({ query }) => ({
    results: query.includes('West')
      ? [{ providerFeatureId: 'west', label: 'Vienna West', center: [16.31, 48.19] }]
      : [{ providerFeatureId: 'east', label: 'Vienna East', center: [16.4, 48.24] }],
    useBoundary: 'provider-response-use-requires-terms-review',
  }));
  render(<App autosaveRepository={null} directionsProvider={{ directions }} searchProvider={{ search }} />);

  await user.click(screen.getByRole('button', { name: 'Route (R)' }));
  await user.click(screen.getByRole('radio', { name: 'Road' }));
  const input = screen.getByRole('combobox', { name: 'Search places and addresses' });
  await user.type(input, 'Vienna West');
  await user.click(screen.getByRole('button', { name: 'Search locations' }));
  await user.click(await screen.findByRole('option', { name: 'Vienna West' }));
  expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('1 point');

  await user.clear(input);
  await user.type(input, 'Vienna East');
  await user.click(screen.getByRole('button', { name: 'Search locations' }));
  await user.click(await screen.findByRole('option', { name: 'Vienna East' }));
  expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('2 points');
  await user.click(screen.getByRole('button', { name: 'Finish route' }));

  expect(directions).toHaveBeenCalledWith(expect.objectContaining({
    profile: 'driving',
    waypoints: [[16.31, 48.19], [16.4, 48.24]],
  }));
  expect(await screen.findByRole('button', { name: 'Select Route 02' })).toHaveAttribute('aria-current', 'true');
});

it('cancels pending road routing when a searched waypoint is selected', async () => {
  const user = userEvent.setup();
  let resolve!: (value: Awaited<ReturnType<DirectionsProvider['directions']>>) => void;
  const pending = new Promise<Awaited<ReturnType<DirectionsProvider['directions']>>>((nextResolve) => { resolve = nextResolve; });
  const directions = vi.fn<DirectionsProvider['directions']>(() => pending);
  const search = vi.fn<SearchProvider['search']>().mockResolvedValue({
    results: [{ providerFeatureId: 'new', label: 'New waypoint', center: [16.5, 48.3] }],
    useBoundary: 'provider-response-use-requires-terms-review',
  });
  render(<App autosaveRepository={null} directionsProvider={{ directions }} searchProvider={{ search }} />);

  await user.click(screen.getByRole('button', { name: 'Route (R)' }));
  await user.click(screen.getByRole('radio', { name: 'Road' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
  await user.click(screen.getByRole('button', { name: 'Finish route' }));
  const input = screen.getByRole('combobox', { name: 'Search places and addresses' });
  await user.type(input, 'New waypoint');
  await user.click(screen.getByRole('button', { name: 'Search locations' }));
  await user.click(await screen.findByRole('option', { name: 'New waypoint' }));

  expect(directions.mock.calls[0][0].signal?.aborted).toBe(true);
  resolve({
    routes: [{ geometry: [[16.31, 48.19], [16.4, 48.24]], distanceMeters: 1, durationSeconds: 1 }],
    useBoundary: 'provider-response-use-requires-terms-review',
  });
  await pending;
  expect(screen.queryByRole('button', { name: 'Select Route 02' })).not.toBeInTheDocument();
  expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('3 points');
});

describe('straight route authoring', () => {
  it('keeps the default route panel compact and self-explanatory', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));

    expect(screen.getByRole('radio', { name: 'Straight' })).toHaveTextContent('Straight');
    expect(screen.getByRole('radio', { name: 'Arc' })).toHaveTextContent('Arc');
    expect(screen.getByRole('radio', { name: 'Road' })).toHaveTextContent('Road');
    expect(screen.getByRole('combobox', { name: 'Travel marker' })).toHaveValue('none');
    expect(screen.queryByRole('radiogroup', { name: 'Travel mode marker' })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('Click the map to add route points');
  });

  it('uses roving path selection and one explicit marker field', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));

    const path = screen.getByRole('radiogroup', { name: 'Route path' });
    const straight = within(path).getByRole('radio', { name: 'Straight' });
    const arc = within(path).getByRole('radio', { name: 'Arc' });
    expect(straight).toHaveAttribute('tabindex', '0');
    expect(arc).toHaveAttribute('tabindex', '-1');
    straight.focus();
    await user.keyboard('{ArrowRight}');
    expect(arc).toHaveFocus();
    expect(arc).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{Home}');
    expect(straight).toHaveFocus();

    const marker = screen.getByRole('combobox', { name: 'Travel marker' });
    await user.selectOptions(marker, 'ship');
    expect(marker).toHaveValue('ship');
  });

  it('authors an arc with a travel profile and printable mode marker', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    expect(screen.queryByRole('combobox', { name: 'Route line shape' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Arc' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Travel marker' }), 'air');
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('1 point');
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));

    expect(screen.queryByRole('status', { name: 'Route drawing status' })).not.toBeInTheDocument();
    expect(screen.getByTestId('map-canvas').dataset.layerGeometry).toContain('route-02:[[16.31,48.19],[16.4,48.24]]');
    expect(screen.getByRole('combobox', { name: 'Route travel profile' })).toHaveValue('air');
    expect(screen.getByRole('checkbox', { name: 'Show travel-mode marker' })).toBeChecked();
  });

  it('routes drawn waypoints through Mapbox and commits one canonical road route', async () => {
    const user = userEvent.setup();
    const directions = vi.fn<DirectionsProvider['directions']>().mockResolvedValue({
      routes: [{
        geometry: [[16.31, 48.19], [16.355, 48.215], [16.4, 48.24]],
        distanceMeters: 9200,
        durationSeconds: 1320,
      }],
      useBoundary: 'provider-response-use-requires-terms-review',
    });
    render(<App autosaveRepository={null} directionsProvider={{ directions }} />);

    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByRole('radio', { name: 'Road' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
    await user.click(screen.getByRole('button', { name: 'Finish route' }));

    expect(directions).toHaveBeenCalledWith(expect.objectContaining({
      profile: 'driving',
      waypoints: [[16.31, 48.19], [16.4, 48.24]],
      signal: expect.any(AbortSignal),
    }));
    expect(await screen.findByRole('button', { name: 'Select Route 02' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('Mapbox Directions')).toBeInTheDocument();
    expect(screen.getByText('9.2 km · 22 min · 2 waypoints')).toBeInTheDocument();
    expect(screen.getByTestId('map-canvas').dataset.layerGeometry).toContain(
      'route-02:[[16.31,48.19],[16.355,48.215],[16.4,48.24]]',
    );
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Select Route 02' })).not.toBeInTheDocument();
    expect(directions).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending road route when its waypoints change', async () => {
    const user = userEvent.setup();
    let resolve!: (value: Awaited<ReturnType<DirectionsProvider['directions']>>) => void;
    const pending = new Promise<Awaited<ReturnType<DirectionsProvider['directions']>>>((nextResolve) => { resolve = nextResolve; });
    const directions = vi.fn<DirectionsProvider['directions']>(() => pending);
    render(<App autosaveRepository={null} directionsProvider={{ directions }} />);

    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByRole('radio', { name: 'Road' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
    await user.click(screen.getByRole('button', { name: 'Finish route' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));

    const signal = directions.mock.calls[0][0].signal;
    expect(signal?.aborted).toBe(true);
    resolve({
      routes: [{ geometry: [[16.31, 48.19], [16.4, 48.24]], distanceMeters: 1, durationSeconds: 1 }],
      useBoundary: 'provider-response-use-requires-terms-review',
    });
    await pending;
    expect(screen.queryByRole('button', { name: 'Select Route 02' })).not.toBeInTheDocument();
  });

  it('finishes two map clicks as one selected undoable route', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
    const finish = screen.getByRole('button', { name: 'Finish route' });
    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('Click the map to add route points');
    expect(finish).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('1 point');
    expect(finish).toBeDisabled();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-layer-state', expect.stringContaining('route-draft-point-1:true'));
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('2 points');
    expect(finish).toBeEnabled();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-layer-state', expect.stringContaining('route-draft:true'));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

    await user.click(finish);
    expect(screen.getByRole('button', { name: 'Select Route 02' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { name: 'Route 02' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Route drawing status' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Select Route 02' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByRole('button', { name: 'Select Route 02' })).toBeInTheDocument();
  });

  it('cancels an unfinished route without changing project history', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Cancel route' }));

    expect(screen.queryByRole('status', { name: 'Route drawing status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Route 02' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
  });

  it('discards an unfinished route when another project is opened', async () => {
    const user = userEvent.setup();
    const { container } = render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('1 point');
    const opened = createInitialProjectDocument();
    opened.id = 'opened-project';
    opened.title = 'Opened project';
    const input = container.querySelector<HTMLInputElement>('input[accept^=".printmap.json"]');
    if (!input) throw new Error('Project open input unavailable');

    fireEvent.change(input, {
      target: { files: [new File([JSON.stringify(opened)], 'opened.printmap.json', { type: 'application/json' })] },
    });

    expect(await screen.findByRole('button', { name: 'Opened project' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Route drawing status' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('Click the map to add route points');
  });

  it('discards route points when the user switches tools', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Pan (H)' }));
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));

    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('Click the map to add route points');
    expect(screen.getByRole('button', { name: 'Finish route' })).toBeDisabled();
  });
});