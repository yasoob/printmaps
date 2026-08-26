import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SearchProvider } from '../../../src/services/mapbox/contracts';
import { LocationSearch } from '../../../src/app/components/LocationSearch';

const provider = (search: SearchProvider['search']): SearchProvider => ({ search });

describe('map location search', () => {
  it('searches from the initial workspace and jumps to a keyboard-selected result', async () => {
    const user = userEvent.setup();
    const search = vi.fn(async () => ({
      results: [
        { providerFeatureId: 'vienna', label: 'Vienna, Austria', center: [16.3725, 48.2084] as const },
        { providerFeatureId: 'virginia', label: 'Vienna, Virginia, United States', center: [-77.26, 38.9] as const },
      ],
      useBoundary: 'provider-response-use-requires-terms-review' as const,
    }));
    const onSelect = vi.fn();
    render(<LocationSearch provider={provider(search)} proximity={[16.3, 48.2]} onSelect={onSelect} />);

    const input = screen.getByRole('combobox', { name: 'Search places and addresses' });
    expect(input).toHaveAttribute('placeholder', 'Place or address…');
    await user.type(input, 'Vienna');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('option', { name: 'Vienna, Austria' })).toBeInTheDocument();
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ query: 'Vienna', limit: 5, proximity: [16.3, 48.2] }));
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith([16.3725, 48.2084], {
      providerFeatureId: 'vienna', label: 'Vienna, Austria', center: [16.3725, 48.2084],
    });
    expect(input).toHaveValue('Vienna, Austria');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('debounces a valid query before searching automatically', async () => {
    vi.useFakeTimers();
    const search = vi.fn(async () => ({
      results: [],
      useBoundary: 'provider-response-use-requires-terms-review' as const,
    }));
    render(<LocationSearch provider={provider(search)} proximity={[0, 0]} onSelect={vi.fn()} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Vienna' } });
    await vi.advanceTimersByTimeAsync(299);
    expect(search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(search).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ query: 'Vienna' }));
    vi.useRealTimers();
  });

  it('keeps provider failures concise and actionable', async () => {
    const user = userEvent.setup();
    const search = vi.fn(async () => { throw new Error('Location search is not configured.'); });
    render(<LocationSearch provider={provider(search)} proximity={[0, 0]} onSelect={vi.fn()} />);

    await user.type(screen.getByRole('combobox'), 'Paris');
    await user.click(screen.getByRole('button', { name: 'Search locations' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Location search is not configured.');
  });

  it('discards an older response when the query changes while it is pending', async () => {
    const user = userEvent.setup();
    let resolveSearch!: (response: Awaited<ReturnType<SearchProvider['search']>>) => void;
    let capturedSignal: AbortSignal | undefined;
    const search = vi.fn((request: Parameters<SearchProvider['search']>[0]) => {
      capturedSignal = request.signal;
      return new Promise<Awaited<ReturnType<SearchProvider['search']>>>((resolve) => { resolveSearch = resolve; });
    });
    render(<LocationSearch provider={provider(search)} proximity={[0, 0]} onSelect={vi.fn()} />);

    const input = screen.getByRole('combobox');
    await user.type(input, 'Vienna{Enter}');
    await user.clear(input);
    await user.type(input, 'Paris');

    expect(capturedSignal?.aborted).toBe(true);
    await act(async () => resolveSearch({
      results: [{ providerFeatureId: 'vienna', label: 'Vienna, Austria', center: [16.37, 48.21] }],
      useBoundary: 'provider-response-use-requires-terms-review',
    }));
    expect(input).toHaveValue('Paris');
    expect(screen.queryByRole('option', { name: 'Vienna, Austria' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search locations' })).toBeEnabled();
  });
});
