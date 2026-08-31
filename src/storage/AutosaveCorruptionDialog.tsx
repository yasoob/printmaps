import { useLayoutEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function AutosaveCorruptionDialog({ busy, error, onDiscard }: { busy: boolean; error?: string | null; onDiscard: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const discardRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (busy) dialogRef.current?.focus();
    else discardRef.current?.focus();
  }, [busy]);

  return (
    <Dialog open>
      <DialogContent
        ref={dialogRef}
        className="recovery-dialog"
        overlayClassName="recovery-backdrop"
        showCloseButton={false}
        initialFocus={busy ? dialogRef : discardRef}
        tabIndex={-1}
        aria-busy={busy}
        aria-labelledby="corrupt-recovery-title"
      >
        <div className="recovery-dialog-header">
          <div><span className="eyebrow">Local autosave</span><h2 id="corrupt-recovery-title">Local draft unavailable</h2></div>
        </div>
        <div className="recovery-dialog-body">
          <p>The local draft is damaged or unsupported and cannot be recovered safely.</p>
          <p>Discard only this damaged browser draft to continue. Portable project files are not affected.</p>
          {error && <p role="alert" aria-label="Autosave status">{error}</p>}
        </div>
        <div className="recovery-dialog-actions">
          <button ref={discardRef} className="primary-button" type="button" disabled={busy} onClick={onDiscard}>Discard damaged draft</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
