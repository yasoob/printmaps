import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useProject, useProjectStoreApi } from '../app/projectStoreContext';
import { downloadProjectDocument } from '../app/components/projectDownload';
import { useAutosaveErrorState } from './projectAutosaveContext';

export function AutosaveConflictDialog({ returnFocusRef }: { returnFocusRef: RefObject<HTMLButtonElement | null> }) {
  const autosave = useAutosaveErrorState();
  const store = useProjectStoreApi();
  const hasUnfinishedDrawing = useProject((state) => state.hasUnfinishedDrawing);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  useLayoutEffect(() => {
    if (autosave?.conflictPending) keepEditingRef.current?.focus();
  }, [autosave?.conflictPending]);
  if (!autosave?.conflictOpen) return null;
  const downloadCurrent = () => {
    try {
      downloadProjectDocument(store.getState().document);
      setDownloadStarted(true);
      setDownloadError(null);
    } catch (error) {
      setDownloadStarted(false);
      setDownloadError(error instanceof Error ? error.message : 'This tab’s version could not be downloaded. Your work is still here.');
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) autosave.keepEditingConflict(); }}>
      <DialogContent
        className="recovery-dialog autosave-conflict-dialog"
        overlayClassName="recovery-backdrop"
        showCloseButton={false}
        initialFocus={keepEditingRef}
        finalFocus={returnFocusRef}
      >
        <div className="recovery-dialog-header"><DialogTitle>Keep this tab’s version?</DialogTitle></div>
        <div className="recovery-dialog-body" role="region" aria-label="Autosave conflict details" tabIndex={0}>
          <DialogDescription>Another tab changed the saved project. This tab’s changes are not saved locally. Autosave is paused to protect both versions.</DialogDescription>
          <p>Download this tab’s completed project and confirm that you have saved the file before replacing this version. Starting a browser download does not confirm that a file was saved.</p>
          <p>“Discard this tab and load saved version” replaces this tab’s project with the version currently in browser storage and clears its Undo history. It does not overwrite the other tab.</p>
          {hasUnfinishedDrawing && <p>Unfinished drawings and unadded point inputs are not saved or included in downloads. Unadded POI lists and lookup suggestions are excluded too. Loading the saved version discards them.</p>}
          <p>Keep editing to preserve this tab’s project and unfinished work. Autosave stays paused; download future changes too. Browsers may not warn before closing.</p>
          {downloadStarted && <p role="status" aria-label="Conflict download status">Download started. Check your browser’s downloads; this tab has not been replaced.</p>}
          {downloadError && <p role="alert" aria-label="Conflict download error">{downloadError}</p>}
          {autosave.conflictError && <p role="alert" aria-label="Conflict recovery error">{autosave.conflictError}</p>}
          {autosave.conflictPending && <p role="status">Reading the saved version… Keep editing cancels replacement.</p>}
        </div>
        <div className="recovery-dialog-actions">
          <button type="button" disabled={autosave.conflictPending} onClick={downloadCurrent}>Download this tab’s version</button>
          <button ref={keepEditingRef} className="primary-button" type="button" onClick={autosave.keepEditingConflict}>Keep editing</button>
          <button type="button" disabled={autosave.conflictPending} onClick={() => { void autosave.loadSavedVersion(); }}>Discard this tab and load saved version</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
