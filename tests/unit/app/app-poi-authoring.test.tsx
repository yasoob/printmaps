import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createInitialProjectDocument } from '../../../src/domain/project';
import type { SearchProvider } from '../../../src/services/mapbox/contracts';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('POI authoring', () => {
  it('places a selected address as one named undoable POI', async () => {
    const user = userEvent.setup();
    const search = vi.fn<SearchProvider['search']>().mockResolvedValue({
      results: [{
        providerFeatureId: 'address.cafe-central',
        label: 'Café Central, Herrengasse 14, Vienna',
        center: [16.365, 48.2105],
      }],
      useBoundary: 'provider-response-use-requires-terms-review',
    });
    render(<App autosaveRepository={null} searchProvider={{ search }} />);

    await user.click(screen.getByRole('button', { name: 'Pin (P)' }));
    const input = screen.getByRole('combobox', { name: 'Search places and addresses' });
    await user.type(input, 'Café Central');
    await user.click(screen.getByRole('button', { name: 'Search locations' }));
    await user.click(await screen.findByRole('option', { name: 'Café Central, Herrengasse 14, Vienna' }));

    const layer = screen.getByRole('button', { name: 'Select Café Central, Herrengasse 14, Vienna' });
    expect(layer).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute(
      'data-layer-geometry',
      expect.stringContaining('poi-01:[16.365,48.2105]'),
    );
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-map-location-request', '0');
    expect(screen.getByRole('textbox', { name: 'POI label' })).toHaveValue('Café Central, Herrengasse 14, Vienna');
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.queryByRole('status', { name: 'POI placement status' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(layer).not.toBeInTheDocument();
  });

  it('bounds a provider address label before canonical POI creation', async () => {
    const user = userEvent.setup();
    const providerLabel = ` ${'A'.repeat(20)}\u{202E}${'A'.repeat(22)} `;
    const canonicalLabel = 'A'.repeat(40);
    const search = vi.fn<SearchProvider['search']>().mockResolvedValue({
      results: [{ providerFeatureId: 'address.long', label: providerLabel, center: [16.365, 48.2105] }],
      useBoundary: 'provider-response-use-requires-terms-review',
    });
    render(<App autosaveRepository={null} searchProvider={{ search }} />);

    await user.click(screen.getByRole('button', { name: 'Pin (P)' }));
    const input = screen.getByRole('combobox', { name: 'Search places and addresses' });
    await user.type(input, 'Long address');
    await user.click(screen.getByRole('button', { name: 'Search locations' }));
    const results = await screen.findByRole('listbox', { name: 'Location results' });
    await user.click(within(results).getByRole('option'));

    expect(screen.getByRole('button', { name: `Select ${canonicalLabel}` })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('textbox', { name: 'POI label' })).toHaveValue(canonicalLabel);
  });

  it('keeps POI authoring open when a searched place cannot be committed', async () => {
    const user = userEvent.setup();
    const search = vi.fn<SearchProvider['search']>().mockResolvedValue({
      results: [{ providerFeatureId: 'x'.repeat(257), label: 'Rejected place', center: [16.365, 48.2105] }],
      useBoundary: 'provider-response-use-requires-terms-review',
    });
    render(<App autosaveRepository={null} searchProvider={{ search }} />);

    await user.click(screen.getByRole('button', { name: 'Pin (P)' }));
    const input = screen.getByRole('combobox', { name: 'Search places and addresses' });
    await user.type(input, 'Rejected place');
    await user.click(screen.getByRole('button', { name: 'Search locations' }));
    await user.click(await screen.findByRole('option', { name: 'Rejected place' }));

    expect(screen.getByText('That search result could not be added. Choose another result or place the POI on the map.')).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('status', { name: 'POI placement status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pin (P)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Select Rejected place' })).not.toBeInTheDocument();
  });

  it('discards stale address results when another project opens', async () => {
    const user = userEvent.setup();
    let resolveSearch!: (value: Awaited<ReturnType<SearchProvider['search']>>) => void;
    const pendingSearch = new Promise<Awaited<ReturnType<SearchProvider['search']>>>((resolve) => { resolveSearch = resolve; });
    const search = vi.fn<SearchProvider['search']>(() => pendingSearch);
    const { container } = render(<App autosaveRepository={null} searchProvider={{ search }} />);

    await user.click(screen.getByRole('button', { name: 'Pin (P)' }));
    const input = screen.getByRole('combobox', { name: 'Search places and addresses' });
    await user.type(input, 'Old address');
    await user.click(screen.getByRole('button', { name: 'Search locations' }));
    await waitFor(() => expect(search).toHaveBeenCalledOnce());
    const signal = search.mock.calls[0][0].signal;

    const opened = createInitialProjectDocument();
    opened.id = 'replacement';
    opened.title = 'Replacement project';
    const fileInput = container.querySelector<HTMLInputElement>('input[accept^=".printmap.json"]');
    if (!fileInput) throw new Error('Project open input unavailable');
    fireEvent.change(fileInput, {
      target: { files: [new File([JSON.stringify(opened)], 'replacement.printmap.json', { type: 'application/json' })] },
    });
    expect(await screen.findByRole('button', { name: 'Replacement project' })).toBeInTheDocument();
    expect(signal?.aborted).toBe(true);
    expect(screen.getByRole('combobox', { name: 'Search places and addresses' })).toHaveValue('');

    resolveSearch({
      results: [{ providerFeatureId: 'address.stale', label: 'Stale address', center: [16.5, 48.3] }],
      useBoundary: 'provider-response-use-requires-terms-review',
    });
    await Promise.resolve();

    expect(screen.queryByRole('option', { name: 'Stale address' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Stale address' })).not.toBeInTheDocument();
  });

  it('places one map click as a selected undoable POI', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Pin (P)' }));
    expect(screen.getByRole('button', { name: 'Export' })).toHaveAttribute('title', 'Finish or cancel map authoring before export');
    expect(screen.getByRole('status', { name: 'POI placement status' })).toHaveTextContent('Click the map to place a POI');

    await user.click(screen.getByRole('button', { name: 'Map POI point' }));

    expect(screen.getByRole('button', { name: 'Select POI 01' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { name: 'POI 01' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'POI placement status' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Select POI 01' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByRole('button', { name: 'Select POI 01' })).toBeInTheDocument();
  });

  it('cancels placement without changing project history', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Pin (P)' }));
    await user.click(screen.getByRole('button', { name: 'Cancel POI' }));

    expect(screen.queryByRole('status', { name: 'POI placement status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select POI 01' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
  });

  it('validates and creates a pasted POI spreadsheet as one undoable batch', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Pin (P)' }));
    await user.click(screen.getByRole('button', { name: 'Paste POI list' }));

    const spreadsheet = screen.getByRole('textbox', { name: 'POI spreadsheet rows' });
    expect(spreadsheet).toHaveFocus();
    await user.type(spreadsheet, 'Broken row');
    await user.click(screen.getByRole('button', { name: 'Add POIs' }));
    expect(screen.getByText(/Spreadsheet row 1/iu)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

    await user.clear(spreadsheet);
    await user.paste('Name\tLongitude\tLatitude\nCafé Central\t16.3725\t48.2084\nMuseum Quarter\t16.3599\t48.2034');
    await user.click(screen.getByRole('button', { name: 'Add POIs' }));

    expect(screen.getByRole('button', { name: 'Select Café Central' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Select Museum Quarter' })).toBeInTheDocument();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-layer-geometry', expect.stringContaining('poi-02:[16.3599,48.2034]'));
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Select Café Central' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Museum Quarter' })).not.toBeInTheDocument();
  });

  it('returns from the spreadsheet to map placement without changing history', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Pin (P)' }));
    await user.click(screen.getByRole('button', { name: 'Paste POI list' }));
    await user.click(screen.getByRole('button', { name: 'Cancel list' }));

    expect(screen.getByRole('status', { name: 'POI placement status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paste POI list' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});
