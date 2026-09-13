import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { trackEditorAction } from '../../analytics/editorAnalytics';
import type { ProjectDocument } from '../../domain/project';
import { isPristineProjectDocument } from '../../domain/pristineProject';
import { useProjectStoreApi } from '../projectStoreContext';

export type ProjectOpeningIntent = 'open' | 'new';

export function useProjectOpening(documentEpoch: number, onOpened: () => void) {
  const store = useProjectStoreApi();
  const requestId = useRef(0);
  const activeOpening = useRef<{ documentEpoch: number; intent: ProjectOpeningIntent } | null>(null);
  const cancelOpening = useCallback(() => {
    const active = activeOpening.current;
    activeOpening.current = null;
    if (active) trackEditorAction(active.intent === 'new' ? 'newProjectCancelled' : 'projectOpenCancelled');
  }, []);
  useLayoutEffect(() => {
    if (activeOpening.current && activeOpening.current.documentEpoch !== documentEpoch) cancelOpening();
  }, [cancelOpening, documentEpoch]);
  useLayoutEffect(() => cancelOpening, [cancelOpening]);
  const [pending, setPending] = useState<{ documentEpoch: number; document: ProjectDocument; requestId: number; intent: ProjectOpeningIntent } | null>(null);
  const currentRequest = pending?.documentEpoch === documentEpoch ? pending : null;
  const open = useCallback((document: ProjectDocument, intent: ProjectOpeningIntent = 'open') => {
    cancelOpening();
    trackEditorAction(intent === 'new' ? 'newProjectStarted' : 'projectOpenStarted');
    const state = store.getState();
    const nextRequestId = ++requestId.current;
    if (state.hasUnfinishedDrawing || state.canUndo || state.canRedo || !isPristineProjectDocument(state.document)) {
      activeOpening.current = { documentEpoch: state.documentEpoch, intent };
      setPending({ documentEpoch: state.documentEpoch, document, requestId: nextRequestId, intent });
      return;
    }
    setPending(null);
    state.openDocument(document);
    trackEditorAction(intent === 'new' ? 'newProjectCompleted' : 'projectOpenCompleted');
    onOpened();
  }, [cancelOpening, onOpened, store]);
  const keepEditing = useCallback(() => {
    cancelOpening();
    requestId.current += 1;
    setPending(null);
  }, [cancelOpening]);
  const discardAndOpen = useCallback(() => {
    if (!pending || pending.requestId !== requestId.current || pending.documentEpoch !== store.getState().documentEpoch) return;
    activeOpening.current = null;
    store.getState().openDocument(pending.document);
    trackEditorAction(pending.intent === 'new' ? 'newProjectCompleted' : 'projectOpenCompleted');
    setPending(null);
    onOpened();
  }, [onOpened, pending, store]);
  return {
    open, pendingDocument: currentRequest?.document ?? null, pendingRequestId: currentRequest?.requestId,
    pendingIntent: currentRequest?.intent ?? 'open', keepEditing, discardAndOpen,
  };
}
