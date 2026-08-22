import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { startPreviewDownload, type PreviewPngExporter } from '../../export/previewPng';

export type ExportDialogProps = {
  exporter: PreviewPngExporter | null;
  filename: string;
  onClose: () => void;
};

function trapDialogFocus(event: React.KeyboardEvent<HTMLDivElement>, dialog: HTMLDivElement | null) {
  if (event.key !== 'Tab') return;
  const focusable = [...(dialog?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])];
  if (focusable.length === 0) {
    event.preventDefault();
    dialog?.focus();
    return;
  }
  const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
  const isMovingBeforeFirst = event.shiftKey && currentIndex <= 0;
  const isMovingAfterLast = !event.shiftKey && currentIndex === focusable.length - 1;
  if (isMovingBeforeFirst || isMovingAfterLast) {
    event.preventDefault();
    (isMovingBeforeFirst ? focusable.at(-1) : focusable[0])?.focus();
  }
}

export function ExportDialog({ exporter, filename, onClose }: ExportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready to export the current print-frame preview.');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => downloadButtonRef.current?.focus(), []);
  useEffect(() => {
    if (busy) dialogRef.current?.focus();
  }, [busy]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onClose();
      return;
    }
    trapDialogFocus(event, dialogRef.current);
  };

  const download = async () => {
    if (!exporter) {
      setError('The live map preview is not ready yet. Wait for the map to load and try again.');
      return;
    }
    setBusy(true);
    setError(null);
    setStatus('Preparing PNG…');
    try {
      const result = await exporter();
      startPreviewDownload(result.blob, filename);
      setStatus(`Download started for ${result.width} × ${result.height} PNG.`);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'PNG export failed.');
      setStatus('Export failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="export-overlay">
      <div className="export-backdrop" aria-hidden="true" onClick={busy ? undefined : onClose} />
      <div
        ref={dialogRef}
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        aria-busy={busy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="export-dialog-header">
          <div><span className="eyebrow">Export</span><h2 id="export-title">Export map</h2></div>
          <button className="icon-button" type="button" aria-label="Close export" disabled={busy} onClick={onClose}><X size={16} /></button>
        </div>
        <div className="export-dialog-body">
          <strong>PNG preview</strong>
          <p>Downloads the current print-frame preview at the browser’s rendered resolution. High-resolution tiled PNG, PDF, and layered SVG remain upcoming export stages.</p>
          <p role="status">{status}</p>
          {error && <p className="export-error" role="alert">{error}</p>}
        </div>
        <div className="export-dialog-actions">
          <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
          <button ref={downloadButtonRef} className="primary-button" type="button" disabled={busy} onClick={download}>{busy ? 'Preparing…' : 'Download PNG'}</button>
        </div>
      </div>
    </div>
  );
}
