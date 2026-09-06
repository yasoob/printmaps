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
  it('keeps an unfound address correctable without adding a POI', async () => {
    const user = userEvent.setup();
    const search = vi.fn<SearchProvider['search']>().mockResolvedValue({
      results: [],
      useBoundary: 'provider-response-use-requires-terms-review',
    });
    render(
      <PoiSpreadsheetPanel documentEpoch={1} onCancel={vi.fn()} onComplete={vi.fn()} onSubmit={vi.fn()} searchProvider={{ search }} />,
    );
    await user.click(screen.getByRole('radio', { name: 'Addresses' }));
    const rows = screen.getByRole('textbox', { name: 'POI spreadsheet rows' });
    await user.type(rows, 'Missing\tUnknown address');
    await user.click(screen.getByRole('button', { name: 'Look up addresses' }));

    expect(await screen.findByText('No matches found. Correct the address, retry, or exclude this row.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add selected POIs' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Back to pasted rows' }));
    expect(screen.getByRole('textbox', { name: 'POI spreadsheet rows' })).toHaveValue('Missing\tUnknown address');
  });

  it('cancels a stale address batch when the document changes', async () => {
    const user = userEvent.setup();
    const pending = deferred<SearchResponse>();
    const search = vi.fn<SearchProvider['search']>(() => pending.promise);
    const onSubmit = vi.fn();
    const { rerender } = render(
      <PoiSpreadsheetPanel documentEpoch={1} onCancel={vi.fn()} onComplete={vi.fn()} onSubmit={onSubmit} searchProvider={{ search }} />,
    );
    await user.click(screen.getByRole('radio', { name: 'Addresses' }));
    await user.type(screen.getByRole('textbox', { name: 'POI spreadsheet rows' }), 'Café\tHerrengasse 14, Vienna');
    await user.click(screen.getByRole('button', { name: 'Look up addresses' }));
    await waitFor(() => expect(search).toHaveBeenCalledOnce());
    const signal = search.mock.calls[0][0].signal;

    rerender(<PoiSpreadsheetPanel documentEpoch={2} onCancel={vi.fn()} onComplete={vi.fn()} onSubmit={onSubmit} searchProvider={{ search }} />);

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
