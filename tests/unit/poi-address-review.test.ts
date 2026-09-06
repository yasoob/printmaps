import { createPoiAddressReview, poiAddressCommitError, poiAddressEntries, validPoiAddressCandidates } from '../../src/domain/poiAddressReview';
import { lookupPoiAddresses } from '../../src/services/poiAddressLookup';
import type { SearchProvider, SearchResponse } from '../../src/services/mapbox/contracts';

const match = (label = 'Springfield, Illinois, United States') => ({
  providerFeatureId: 'address.springfield', label, center: [-89.65, 39.78] as const,
});
const response = (results: SearchResponse['results']): SearchResponse => ({ results, useBoundary: 'provider-response-use-requires-terms-review' });

describe('POI address review boundaries', () => {
  it('keeps the user name separate from the returned matched locality', () => {
    const [row] = createPoiAddressReview([{ name: 'Our café', address: 'Main Street' }]);
    const reviewed = { ...row, status: 'found' as const, candidates: [match()], selected: 0 };
    expect(poiAddressEntries([reviewed])).toEqual([{
      name: 'Our café', coordinates: [-89.65, 39.78], providerFeatureId: 'address.springfield',
    }]);
  });

  it.each(['changed', 'queued', 'loading', 'missing', 'error', 'stopped'] as const)('rejects an included %s row instead of manufacturing coordinates', (status) => {
    const [row] = createPoiAddressReview([{ name: 'Our café', address: 'Main Street' }]);
    expect(poiAddressCommitError([{ ...row, status }])).toContain('Row 1: choose a matched location');
    expect(() => poiAddressEntries([{ ...row, status }])).toThrow('Row 1');
  });

  it('requires an explicit candidate choice and excludes unwanted rows', () => {
    const rows = createPoiAddressReview([{ name: 'Ours', address: 'Springfield' }, { name: 'Missing', address: 'Unknown' }]);
    const ambiguous = { ...rows[0], status: 'found' as const, candidates: [match(), match('Springfield, Massachusetts')] };
    expect(poiAddressCommitError([ambiguous])).toContain('choose a matched location');
    expect(poiAddressEntries([{ ...ambiguous, selected: 1 }, { ...rows[1], included: false }])).toHaveLength(1);
    expect(() => poiAddressEntries(rows.map((row) => ({ ...row, included: false })))).toThrow('Select at least one row');
  });

  it('caps suggestions and rejects unusable coordinates or missing labels', () => {
    expect(validPoiAddressCandidates(Array.from({ length: 10 }, () => match()))).toHaveLength(5);
    expect(() => validPoiAddressCandidates([{ ...match(), center: [181, 40] }])).toThrow('unusable');
    expect(() => validPoiAddressCandidates([{ ...match(), label: '' }])).toThrow('unusable');
  });

  it('keeps partial failures local and calls the provider sequentially with a bounded candidate limit', async () => {
    const search = vi.fn<SearchProvider['search']>()
      .mockResolvedValueOnce(response([match()]))
      .mockRejectedValueOnce(new Error('Provider unavailable'))
      .mockResolvedValueOnce(response([]));
    const rows = createPoiAddressReview(['A', 'B', 'C'].map((name) => ({ name, address: `${name} address` })));
    const onResult = vi.fn();
    await lookupPoiAddresses({ provider: { search }, rows, signal: new AbortController().signal, onStart: vi.fn(), onResult });
    expect(search.mock.calls.map(([request]) => [request.query, request.limit, request.autocomplete])).toEqual([
      ['A address', 5, false], ['B address', 5, false], ['C address', 5, false],
    ]);
    expect(onResult.mock.calls[1][1]).toEqual({ candidates: [], error: 'Provider unavailable' });
    expect(onResult.mock.calls[2][1]).toEqual({ candidates: [], error: null });
  });

  it('does not publish or request another row after cancellation, even if the provider ignores the signal', async () => {
    let resolve!: (result: SearchResponse) => void;
    const search = vi.fn<SearchProvider['search']>(() => new Promise((done) => { resolve = done; }));
    const controller = new AbortController();
    const onResult = vi.fn();
    const waiting = lookupPoiAddresses({
      provider: { search }, rows: createPoiAddressReview([{ name: 'A', address: 'A' }, { name: 'B', address: 'B' }]),
      signal: controller.signal, onStart: vi.fn(), onResult,
    });
    controller.abort();
    resolve(response([match()]));
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    expect(search).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();
  });
});
