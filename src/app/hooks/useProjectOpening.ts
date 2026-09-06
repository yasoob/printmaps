import { useCallback, useRef, useState } from 'react';
import type { ProjectDocument } from '../../domain/project';
import { isPristineProjectDocument } from '../../domain/pristineProject';
import { useProjectStoreApi } from '../projectStoreContext';

export type ProjectOpeningIntent = 'open' | 'new';

export function useProjectOpening(documentEpoch: number, onOpened: () => void) {
  const store = useProjectStoreApi();
  const requestId = useRef(0);
  const [pending, setPending] = useState<{ documentEpoch: number; document: ProjectDocument; requestId: number; intent: ProjectOpeningIntent } | null>(null);
  const currentRequest = pending?.documentEpoch === documentEpoch ? pending : null;
  const open = useCallback((document: ProjectDocument, intent: ProjectOpeningIntent = 'open') => {
    const state = store.getState();
    const nextRequestId = ++requestId.current;
    if (state.hasUnfinishedDrawing || state.canUndo || state.canRedo || !isPristineProjectDocument(state.document)) {
      setPending({ documentEpoch: state.documentEpoch, document, requestId: nextRequestId, intent });
      return;
    }
    setPending(null);
    state.openDocument(document);
    onOpened();
  }, [onOpened, store]);
  const keepEditing = useCallback(() => {
    requestId.current += 1;
    setPending(null);
  }, []);
  const discardAndOpen = useCallback(() => {
    if (!pending || pending.requestId !== requestId.current || pending.documentEpoch !== store.getState().documentEpoch) return;
    store.getState().openDocument(pending.document);
    setPending(null);
    onOpened();
  }, [onOpened, pending, store]);
  return {
    open, pendingDocument: currentRequest?.document ?? null, pendingRequestId: currentRequest?.requestId,
    pendingIntent: currentRequest?.intent ?? 'open', keepEditing, discardAndOpen,
  };
}
