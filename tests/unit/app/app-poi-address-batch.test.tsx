import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import type { SearchProvider } from '../../../src/services/mapbox/contracts';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('POI spreadsheet address geocoding', () => {
  it('geocodes pasted address rows as one undoable POI batch', async () => {
    const user = userEvent.setup();
    const search = vi.fn<SearchProvider['search']>()
      .mockResolvedValueOnce({
        results: [{ providerFeatureId: 'address.cafe', label: 'Café Central, Vienna', center: [16.365, 48.2105] }],
        useBoundary: 'provider-response-use-requires-terms-review',
      })
      .mockResolvedValueOnce({
        results: [{ providerFeatureId: 'address.museum', label: 'MuseumsQuartier, Vienna', center: [16.3599, 48.2034] }],
        useBoundary: 'provider-response-use-requires-terms-review',
      });
    render(<App autosaveRepository={null} searchProvider={{ search }} />);

    await user.click(screen.getByRole('button', { name: 'Pin (P)' }));
    await user.click(screen.getByRole('button', { name: 'Paste POI list' }));
    await user.click(screen.getByRole('radio', { name: 'Addresses' }));
    await user.type(
      screen.getByRole('textbox', { name: 'POI spreadsheet rows' }),
      'Name\tAddress\nCafé Central\tHerrengasse 14, Vienna\nMuseum Quarter\tMuseumsplatz 1, Vienna',
    );
    await user.click(screen.getByRole('button', { name: 'Find and add POIs' }));

    expect(await screen.findByRole('button', { name: 'Select Café Central' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Select Museum Quarter' })).toBeInTheDocument();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute(
      'data-layer-geometry',
      expect.stringContaining('poi-02:[16.3599,48.2034]'),
    );
    expect(search).toHaveBeenNthCalledWith(1, expect.objectContaining({ autocomplete: false, query: 'Herrengasse 14, Vienna', limit: 1 }));
    expect(search).toHaveBeenNthCalledWith(2, expect.objectContaining({ autocomplete: false, query: 'Museumsplatz 1, Vienna', limit: 1 }));

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Select Café Central' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Museum Quarter' })).not.toBeInTheDocument();
  });
});
