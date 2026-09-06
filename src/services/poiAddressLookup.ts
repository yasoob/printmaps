import { POI_ADDRESS_MATCH_LIMIT, poiAddressQueryError, validPoiAddressCandidates, type PoiAddressReviewRow } from '../domain/poiAddressReview';
import type { SearchProvider, SearchResult } from './mapbox/contracts';

type AddressOutcome = { candidates: readonly SearchResult[]; error: string | null };
type AddressLookupOptions = {
  provider: SearchProvider;
  rows: readonly PoiAddressReviewRow[];
  signal: AbortSignal;
  onStart: (id: number) => void;
  onResult: (id: number, outcome: AddressOutcome) => void;
};

async function resolveAddress(provider: SearchProvider, address: string, signal: AbortSignal): Promise<AddressOutcome> {
  try {
    const error = poiAddressQueryError(address);
    if (error) return { candidates: [], error };
    const response = await provider.search({ autocomplete: false, query: address.trim(), limit: POI_ADDRESS_MATCH_LIMIT, signal });
    signal.throwIfAborted();
    return { candidates: validPoiAddressCandidates(response.results), error: null };
  } catch (error) {
    signal.throwIfAborted();
    return { candidates: [], error: error instanceof Error && error.message.trim() ? error.message : 'Address lookup failed. Try again.' };
  }
}

export async function lookupPoiAddresses(options: AddressLookupOptions): Promise<void> {
  const next = async (index: number): Promise<void> => {
    options.signal.throwIfAborted();
    const row = options.rows[index];
    if (!row) return;
    options.onStart(row.id);
    const outcome = await resolveAddress(options.provider, row.address, options.signal);
    options.signal.throwIfAborted();
    options.onResult(row.id, outcome);
    return next(index + 1);
  };
  return next(0);
}
