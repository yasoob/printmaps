import { useCallback, useEffect, useReducer, useRef } from 'react';
import { trackEditorAction } from '../../analytics/editorAnalytics';
import type { SearchProvider, SearchResult } from '../../services/mapbox/contracts';
import { useLatestValue } from './useLatestValue';

type SearchState = {
  query: string;
  results: readonly SearchResult[];
  activeIndex: number;
  phase: 'idle' | 'searching';
  error: string | null;
};
type SearchAction =
  | { type: 'query'; query: string }
  | { type: 'start' }
  | { type: 'success'; results: readonly SearchResult[] }
  | { type: 'error'; message: string }
  | { type: 'close' }
  | { type: 'choose'; result: SearchResult }
  | { type: 'move'; direction: -1 | 1 };

const INITIAL: SearchState = { query: '', results: [], activeIndex: -1, phase: 'idle', error: null };

function reduceSearch(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'query': { return { ...INITIAL, query: action.query };
    }
    case 'start': { return { ...INITIAL, query: state.query, phase: 'searching' };
    }
    case 'success': { return { ...state, phase: 'idle', results: action.results, activeIndex: -1, error: action.results.length > 0 ? null : 'No matching places found.' };
    }
    case 'error': { return { ...INITIAL, query: state.query, error: action.message };
    }
    case 'close': { return { ...INITIAL, query: state.query };
    }
    case 'choose': { return { ...INITIAL, query: action.result.label };
    }
    case 'move': {
      if (state.results.length === 0) return state;
      const activeIndex = state.activeIndex < 0
        ? (action.direction === 1 ? 0 : state.results.length - 1)
        : (state.activeIndex + action.direction + state.results.length) % state.results.length;
      return { ...state, activeIndex };
    }
  }
}

export function useLocationSearch(provider: SearchProvider, proximity: readonly [number, number]) {
  const [state, dispatch] = useReducer(reduceSearch, INITIAL);
  const getOptions = useLatestValue({ provider, proximity });
  const getState = useLatestValue(state);
  const request = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const cancelPending = useCallback(() => {
    if (timer.current !== null) globalThis.clearTimeout(timer.current);
    timer.current = null;
    if (request.current) trackEditorAction('locationSearchCancelled');
    request.current?.abort();
    request.current = null;
  }, []);
  useEffect(() => cancelPending, [cancelPending]);

  const search = useCallback(async (query: string) => {
    cancelPending();
    const normalized = query.trim();
    if (normalized.length < 2) {
      dispatch({ type: 'error', message: 'Enter at least two characters.' });
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    trackEditorAction('locationSearchStarted');
    dispatch({ type: 'start' });
    const options = getOptions();
    try {
      const response = await options.provider.search({
        query: normalized, limit: 5, proximity: options.proximity, signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        trackEditorAction('locationSearchCompleted');
        dispatch({ type: 'success', results: response.results });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        trackEditorAction('locationSearchFailed');
        dispatch({ type: 'error', message: error instanceof Error ? error.message : 'Location search failed. Try again.' });
      }
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [cancelPending, getOptions]);
  const changeQuery = useCallback((query: string) => {
    cancelPending();
    dispatch({ type: 'query', query });
    if (query.trim().length >= 2) {
      timer.current = globalThis.setTimeout(() => { void search(query); }, 300);
    }
  }, [cancelPending, search]);
  const close = useCallback(() => {
    cancelPending();
    const current = getState();
    if (current.results.length > 0 || current.error || current.phase === 'searching') dispatch({ type: 'close' });
  }, [cancelPending, getState]);
  const choose = useCallback((result: SearchResult) => {
    cancelPending();
    trackEditorAction('locationSelected', { source: 'search' });
    dispatch({ type: 'choose', result });
  }, [cancelPending]);
  const move = useCallback((direction: -1 | 1) => dispatch({ type: 'move', direction }), []);

  return { ...state, changeQuery, search, close, choose, move };
}
