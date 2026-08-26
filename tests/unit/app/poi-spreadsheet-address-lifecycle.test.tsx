import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PoiSpreadsheetPanel } from '../../../src/app/components/PoiSpreadsheetPanel';
import type { SearchProvider, SearchResponse } from '../../../src/services/mapbox/contracts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}

describe('POI spreadsheet address lifecycle', () => {
  it('restores focus to the address rows after a lookup error', async () => {
    const user = userEvent.setup();
    const search = vi.fn<SearchProvider['search']>().mockResolvedValue({
      results: [],
      useBoundary: 'provider-response-use-requires-terms-review',
    });
    render(
      <PoiSpreadsheetPanel documentEpoch={1} onCancel={vi.fn()} onSubmit={vi.fn()} searchProvider={{ search }} />,
    );
    await user.click(screen.getByRole('radio', { name: 'Addresses' }));
    const rows = screen.getByRole('textbox', { name: 'POI spreadsheet rows' });
    await user.type(rows, 'Missing\tUnknown address');
    await user.click(screen.getByRole('button', { name: 'Find and add POIs' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Spreadsheet row 1 address could not be found.');
    expect(rows).toHaveFocus();
  });

  it('cancels a stale address batch when the document changes', async () => {
    const user = userEvent.setup();
    const pending = deferred<SearchResponse>();
    const search = vi.fn<SearchProvider['search']>(() => pending.promise);
    const onSubmit = vi.fn();
    const { rerender } = render(
      <PoiSpreadsheetPanel documentEpoch={1} onCancel={vi.fn()} onSubmit={onSubmit} searchProvider={{ search }} />,
    );
    await user.click(screen.getByRole('radio', { name: 'Addresses' }));
    await user.type(screen.getByRole('textbox', { name: 'POI spreadsheet rows' }), 'Café\tHerrengasse 14, Vienna');
    await user.click(screen.getByRole('button', { name: 'Find and add POIs' }));
    await waitFor(() => expect(search).toHaveBeenCalledOnce());
    const signal = search.mock.calls[0][0].signal;

    rerender(<PoiSpreadsheetPanel documentEpoch={2} onCancel={vi.fn()} onSubmit={onSubmit} searchProvider={{ search }} />);

    expect(signal?.aborted).toBe(true);
    pending.resolve({
      results: [{ providerFeatureId: 'address.cafe', label: 'Café, Vienna', center: [16.365, 48.2105] }],
      useBoundary: 'provider-response-use-requires-terms-review',
    });
    await Promise.resolve();
    expect(search).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
