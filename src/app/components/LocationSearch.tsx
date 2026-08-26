import { LocateFixed, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { SearchProvider, SearchResult } from '../../services/mapbox/contracts';
import { createMapboxSearchProvider } from '../../services/mapbox/search';

type LocationSearchProps = {
  onSelect: (coordinate: [number, number], result: SearchResult) => void;
  proximity: readonly [number, number];
  provider?: SearchProvider;
};

const defaultProvider = createMapboxSearchProvider({
  token: import.meta.env.VITE_MAPBOX_PUBLIC_ACCESS,
});

const SEARCH_DEBOUNCE_MS = 300;

function cancelSearch(controller: { current: AbortController | null }) {
  controller.current?.abort();
  controller.current = null;
}

function LocationSearchResults({ activeIndex, onChoose, results }: {
  activeIndex: number;
  onChoose: (result: SearchResult) => void;
  results: readonly SearchResult[];
}) {
  if (results.length === 0) return null;
  return (
    <div id="location-search-results" className="location-search-results" role="listbox" aria-label="Location results">
      {results.map((result, index) => (
        <button id={`location-result-${index}`} key={result.providerFeatureId} type="button" role="option" aria-selected={index === activeIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => onChoose(result)}>
          {result.label}
        </button>
      ))}
    </div>
  );
}

export function LocationSearch({ onSelect, proximity, provider = defaultProvider }: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [phase, setPhase] = useState<'idle' | 'searching'>('idle');
  const [error, setError] = useState<string | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const debounceTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  const clearDebounce = () => {
    if (debounceTimer.current !== null) globalThis.clearTimeout(debounceTimer.current);
    debounceTimer.current = null;
  };
  useEffect(() => () => {
    clearDebounce();
    cancelSearch(requestController);
  }, []);

  const handleQueryChange = (nextQuery: string) => {
    clearDebounce();
    cancelSearch(requestController);
    setPhase('idle'); setQuery(nextQuery);
    setError(null); setResults([]);
    if (nextQuery.trim().length >= 2) {
      debounceTimer.current = globalThis.setTimeout(() => { void runSearch(nextQuery.trim()); }, SEARCH_DEBOUNCE_MS);
    }
  };

  const choose = (result: SearchResult) => {
    clearDebounce();
    setQuery(result.label);
    setResults([]);
    setActiveIndex(-1);
    setError(null);
    onSelect([result.center[0], result.center[1]], result);
  };

  const runSearch = async (requestedQuery = query) => {
    const normalizedQuery = requestedQuery.trim();
    if (normalizedQuery.length < 2) {
      setError('Enter at least two characters.');
      setResults([]);
      return;
    }
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setPhase('searching');
    setError(null);
    try {
      const response = await provider.search({
        query: normalizedQuery,
        limit: 5,
        proximity,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setResults(response.results);
      setActiveIndex(-1);
      if (response.results.length === 0) setError('No matching places found.');
    } catch (searchError) {
      if (controller.signal.aborted) return;
      setResults([]);
      setError(searchError instanceof Error ? searchError.message : 'Location search failed. Try again.');
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setPhase('idle');
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setResults([]);
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + direction + results.length) % results.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const result = results[Math.max(activeIndex, 0)];
      if (result) choose(result);
    }
  };

  return (
    <div className="location-search">
      <form
        className="location-search-form"
        role="search"
        onSubmit={(event) => { event.preventDefault(); clearDebounce(); void runSearch(); }}
      >
        <Search aria-hidden="true" size={15} />
        <input
          role="combobox"
          aria-label="Search places and addresses"
          aria-autocomplete="list"
          aria-expanded={results.length > 0}
          aria-controls={results.length > 0 ? 'location-search-results' : undefined}
          aria-activedescendant={activeIndex >= 0 ? `location-result-${activeIndex}` : undefined}
          autoComplete="off"
          placeholder="Place or address…"
          value={query}
          onChange={(event) => handleQueryChange(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" aria-label="Search locations" disabled={phase === 'searching'}>
          <LocateFixed aria-hidden="true" size={15} />
        </button>
      </form>
      <LocationSearchResults activeIndex={activeIndex} onChoose={choose} results={results} />
      {error && <div className="location-search-status is-error" role="alert">{error}</div>}
    </div>
  );
}
