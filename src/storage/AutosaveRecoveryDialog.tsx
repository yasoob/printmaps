import { useLayoutEffect, useRef } from 'react';
import type { AutosaveDraft } from './autosave';

export function AutosaveRecoveryDialog({
  draft,
  busy,
  onRecover,
  onDiscard,
}: {
  draft: AutosaveDraft;
  busy: boolean;
  onRecover: () => void;
  onDiscard: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const recoverRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (busy) dialogRef.current?.focus();
    else recoverRef.current?.focus();
  }, [busy]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.shiftKey && currentIndex <= 0) {
      event.preventDefault();
      buttons.at(-1)?.focus();
    } else if (!event.shiftKey && currentIndex === buttons.length - 1) {
      event.preventDefault();
      buttons[0]?.focus();
    }
  };

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
        aria-labelledby="recovery-title"
        onKeyDown={handleKeyDown}
      >
        <div className="recovery-dialog-header">
          <div><span className="eyebrow">Local autosave</span><h2 id="recovery-title">Recover local draft</h2></div>
        </div>
        <div className="recovery-dialog-body">
          <p><strong>{draft.document.title}</strong> has unsaved local changes from <time dateTime={draft.savedAt}>{new Date(draft.savedAt).toLocaleString()}</time>.</p>
          <p>Recover the draft or discard it and keep the current project. Nothing is uploaded.</p>
        </div>
        <div className="recovery-dialog-actions">
          <button type="button" disabled={busy} onClick={onDiscard}>Discard draft</button>
          <button ref={recoverRef} className="primary-button" type="button" disabled={busy} onClick={onRecover}>Recover draft</button>
        </div>
      </div>
    </div>
  );
}

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
