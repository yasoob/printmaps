import { useLayoutEffect, useRef } from 'react';

export function AutosaveCorruptionDialog({ busy, onDiscard }: { busy: boolean; onDiscard: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const discardRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (busy) dialogRef.current?.focus();
    else discardRef.current?.focus();
  }, [busy]);

  return (
    <div className="recovery-overlay">
      <div className="recovery-backdrop" aria-hidden="true" />
      <div
        ref={dialogRef}
        className="recovery-dialog"
        role="dialog"
        tabIndex={-1}
        aria-busy={busy}
        aria-modal="true"
        aria-labelledby="corrupt-recovery-title"
        onKeyDown={(event) => {
          if (!(event.key === 'Escape' || event.key === 'Tab')) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          discardRef.current?.focus();
        }}
      >
        <div className="recovery-dialog-header">
          <div><span className="eyebrow">Local autosave</span><h2 id="corrupt-recovery-title">Local draft unavailable</h2></div>
        </div>
        <div className="recovery-dialog-body">
          <p>The local draft is damaged or unsupported and cannot be recovered safely.</p>
          <p>Discard only this damaged browser draft to continue. Portable project files are not affected.</p>
        </div>
        <div className="recovery-dialog-actions">
          <button ref={discardRef} className="primary-button" type="button" disabled={busy} onClick={onDiscard}>Discard damaged draft</button>
        </div>
      </div>
    </div>
  );
}
