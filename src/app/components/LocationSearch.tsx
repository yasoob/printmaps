import { CornerDownLeft, Search } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { IconTooltip } from './IconTooltip';
import { memo, useEffect, useRef } from 'react';
import { useStableEvent } from '../hooks/useStableEvent';
import type { SearchProvider, SearchResult } from '../../services/mapbox/contracts';
import { createMapboxSearchProvider } from '../../services/mapbox/search';
import { useLocationSearch } from '../hooks/useLocationSearch';
import { LocationSearchFeedback, type SearchSelectionFeedback } from './LocationSearchFeedback';

type LocationSearchProps = {
  onSelect: (coordinate: [number, number], result: SearchResult) => void;
  proximity: readonly [number, number];
  provider?: SearchProvider;
  feedback?: SearchSelectionFeedback | null;
  onClearFeedback?: () => void;
};

// The map search floats over the canvas, so it uses the map-control surface rather than a field fill.
const SEARCH_FIELD_CLASS = 'h-[2.375rem] rounded-lg border-line-strong bg-surface pr-0.5 hover:border-line-strong touch:h-[calc(var(--spacing-touch)+2px)]';

const defaultProvider = createMapboxSearchProvider({
  token: import.meta.env.VITE_MAPBOX_PUBLIC_ACCESS,
});

const LocationSearchResults = memo(function LocationSearchResults({ activeIndex, onChoose, results }: {
  activeIndex: number;
  onChoose: (result: SearchResult) => void;
  results: readonly SearchResult[];
}) {
  if (results.length === 0) return null;
  return (
    <div id="location-search-results" className="location-search-results" role="listbox" aria-label="Location results">
      {results.map((result, index) => (
        <button id={`location-result-${index}`} key={result.providerFeatureId} type="button" role="option" tabIndex={-1} aria-selected={index === activeIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => onChoose(result)}>
          {result.label}
        </button>
      ))}
    </div>
  );
});

export function LocationSearch({ onSelect, proximity, provider = defaultProvider, feedback, onClearFeedback }: LocationSearchProps) {
  const search = useLocationSearch(provider, proximity);
  const { query, results, activeIndex, phase, error, close } = search;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) close();
    };
    document.addEventListener('pointerdown', dismissOutside, {capture: true});
    return () => document.removeEventListener('pointerdown', dismissOutside, true);
  }, [close]);
  const choose = useStableEvent((result: SearchResult) => {
    const focused = document.activeElement;
    const wasOptionFocused = focused instanceof HTMLElement && focused.getAttribute('role') === 'option';
    search.choose(result);
    onSelect([result.center[0], result.center[1]], result);
    if (wasOptionFocused && (document.activeElement === focused || document.activeElement === document.body)) {
      inputRef.current?.focus();
    }
  });
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || results.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      search.move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const result = results[Math.max(activeIndex, 0)];
      if (result) choose(result);
    }
  };
  const status = phase === 'searching' ? 'Searching places...' : (feedback?.message ?? (results.length > 0 ? `${results.length} places found.` : ''));

  return (
    <div
      ref={rootRef}
      className="location-search"
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) close();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        close();
        onClearFeedback?.();
        inputRef.current?.focus();
      }}
    >
      <form
        className="location-search-form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (phase === 'searching') return;
          inputRef.current?.focus();
          onClearFeedback?.();
          void search.search(query);
        }}
      >
        <InputGroup className={SEARCH_FIELD_CLASS}>
          <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            role="combobox"
            aria-label="Search places and addresses"
            aria-autocomplete="list"
            aria-busy={phase === 'searching'}
            aria-expanded={results.length > 0}
            aria-controls={results.length > 0 ? 'location-search-results' : undefined}
            aria-activedescendant={activeIndex >= 0 ? `location-result-${activeIndex}` : undefined}
            autoComplete="off"
            placeholder="Place or address…"
            value={query}
            onChange={(event) => {
              onClearFeedback?.();
              search.changeQuery(event.currentTarget.value);
            }}
            onKeyDown={handleKeyDown}
          />
          <InputGroupAddon align="inline-end">
            <IconTooltip label="Search" shortcut="Enter">
              <InputGroupButton type="submit" size="icon-sm" className="touch:size-touch" aria-label="Search locations" disabled={phase === 'searching'}>
                <CornerDownLeft aria-hidden="true" />
              </InputGroupButton>
            </IconTooltip>
          </InputGroupAddon>
        </InputGroup>
      </form>
      {results.length > 0 && <LocationSearchResults activeIndex={activeIndex} onChoose={choose} results={results} />}
      <span className="sr-only" role="status" aria-label="Place search status">{status}</span>
      {phase === 'searching' && <div className="location-search-status" aria-hidden="true">Searching places...</div>}
      {error && <div className="location-search-status is-error" role="alert">{error}</div>}
      {feedback && <LocationSearchFeedback feedback={feedback} />}
    </div>
  );
}
