import { useCallback, useState } from 'react';

// Tracks whether the active tool holds geometry that would differ from committed export content.
export function usePendingDraftState(documentEpoch: number) {
  const [state, setState] = useState({ documentEpoch: 0, hasPendingDraft: false });
  const handlePendingDraftChange = useCallback((nextDocumentEpoch: number, hasPendingDraft: boolean) => {
    setState((current) => (
      current.documentEpoch === nextDocumentEpoch && current.hasPendingDraft === hasPendingDraft
        ? current : { documentEpoch: nextDocumentEpoch, hasPendingDraft }
    ));
  }, []);
  return {
    hasPendingDraft: state.documentEpoch === documentEpoch && state.hasPendingDraft,
    handlePendingDraftChange,
  };
}
