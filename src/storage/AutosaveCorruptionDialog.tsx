import { useLayoutEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { downloadAutosaveRecovery } from './autosaveRecovery';

export function AutosaveCorruptionDialog({ busy, error, recoveryData, onContinue, onDiscard }: {
  busy: boolean;
  error?: string | null;
  recoveryData: { record: unknown } | undefined;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (busy) dialogRef.current?.focus();
    else continueRef.current?.focus();
  }, [busy]);
  const downloadRecovery = () => {
    if (!recoveryData) {
      setDownloadError('Recovery data could not be read. The local draft is still preserved.');
      return;
    }
    try {
      downloadAutosaveRecovery(recoveryData.record);
      setDownloadError(null);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Recovery data could not be downloaded. The local record is still preserved.');
    }
  };

  return (
    <Dialog open>
      <DialogContent
        ref={dialogRef}
        className="recovery-dialog"
        overlayClassName="recovery-backdrop"
        showCloseButton={false}
        initialFocus={busy ? dialogRef : continueRef}
        tabIndex={-1}
        aria-busy={busy}
        aria-labelledby="corrupt-recovery-title"
      >
        <div className="recovery-dialog-header">
          <div><span className="eyebrow">Local autosave</span><h2 id="corrupt-recovery-title">Local draft unavailable</h2></div>
        </div>
        <div className="recovery-dialog-body" role="region" aria-label="Local draft recovery details" tabIndex={0}>
          <p>The local draft is damaged or unsupported and could not be opened. It has not been replaced.</p>
          <p>Download recovery data for inspection before discarding it. This is not a portable project file and may need repair.</p>
          <p>Continue without autosave to leave the local draft intact. New work will not be saved locally; download your project to keep it.</p>
          {!recoveryData && <p>Recovery data could not be read. You can still leave the local draft untouched and continue without autosave.</p>}
          {error && <p role="alert" aria-label="Autosave status">{error}</p>}
          {downloadError && <p role="alert" aria-label="Recovery download status">{downloadError}</p>}
        </div>
        <div className="recovery-dialog-actions">
          <button type="button" disabled={busy || !recoveryData} onClick={downloadRecovery}>Download recovery data</button>
          <button ref={continueRef} className="primary-button" type="button" disabled={busy} onClick={onContinue}>Continue without autosave</button>
          <button type="button" disabled={busy} onClick={onDiscard}>Discard damaged draft</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
