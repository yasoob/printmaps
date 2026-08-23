import { ChevronRight, X } from 'lucide-react';
import type React from 'react';
import type { ProjectDocument } from '../../domain/project';
import { planExportPreflight } from '../../export/preflight';

export type ExportFormat = 'png' | 'svg' | 'pdf';

type ExportPreflight = ReturnType<typeof planExportPreflight>;

const EXPORT_FORMATS: ReadonlyArray<Readonly<{
  description: string;
  format: ExportFormat;
  label: string;
}>> = [
  { format: 'png', label: 'PNG', description: 'Native-detail raster' },
  { format: 'svg', label: 'Layered SVG', description: 'Vector content layers' },
  { format: 'pdf', label: 'PDF', description: 'Exact print page' },
];

const DOWNLOAD_LABEL: Record<ExportFormat, string> = {
  png: 'Download PNG',
  svg: 'Download layered SVG',
  pdf: 'Download PDF',
};

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function nextFormatIndex(key: string, currentIndex: number): number {
  if (key === 'Home') return 0;
  if (key === 'End') return EXPORT_FORMATS.length - 1;
  const offset = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
  return (currentIndex + offset + EXPORT_FORMATS.length) % EXPORT_FORMATS.length;
}

function ExportFormatChoice({ busy, onChange, selectedFormat }: Readonly<{
  busy: boolean;
  onChange: (format: ExportFormat) => void;
  selectedFormat: ExportFormat;
}>) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, format: ExportFormat) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const radios = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])];
    const currentIndex = EXPORT_FORMATS.findIndex((option) => option.format === format);
    const nextIndex = nextFormatIndex(event.key, currentIndex);
    const nextFormat = EXPORT_FORMATS[nextIndex]?.format;
    if (!nextFormat) return;
    onChange(nextFormat);
    radios[nextIndex]?.focus();
  };

  return (
    <div className="export-format-group" role="radiogroup" aria-label="Export format">
      {EXPORT_FORMATS.map(({ description, format, label }) => (
        <button
          key={format}
          className="export-format-option"
          type="button"
          role="radio"
          aria-checked={selectedFormat === format}
          disabled={busy}
          tabIndex={selectedFormat === format ? 0 : -1}
          onClick={() => onChange(format)}
          onKeyDown={(event) => handleKeyDown(event, format)}
        >
          <span>{label}</span>
          <small>{description}</small>
        </button>
      ))}
    </div>
  );
}

function ExportOutputSummary({ document, preflight, selectedFormat }: Readonly<{
  document: ProjectDocument;
  preflight: ExportPreflight;
  selectedFormat: ExportFormat;
}>) {
  const pageLabel = `${document.page.preset} ${document.page.orientation}`;
  if (selectedFormat === 'png') return (
    <section className="export-output-summary" aria-labelledby="export-output-title">
      <span id="export-output-title">Output</span>
      {preflight.dimensions && <strong>{preflight.dimensions.widthPx} × {preflight.dimensions.heightPx} px — 300 DPI pixel target</strong>}
      <p>{pageLabel} · Native-detail PNG</p>
    </section>
  );
  return (
    <section className="export-output-summary" aria-labelledby="export-output-title">
      <span id="export-output-title">Output</span>
      <strong>{pageLabel} · {document.page.widthMm} × {document.page.heightMm} mm</strong>
      <p>{selectedFormat === 'svg' ? 'Raster basemap · named vector overlays' : 'Exact-page PDF · named vector overlays'}</p>
    </section>
  );
}

function ExportTechnicalDetails({ busy, expanded, onToggle, preflight, selectedFormat }: Readonly<{
  busy: boolean;
  expanded: boolean;
  onToggle: () => void;
  preflight: ExportPreflight;
  selectedFormat: ExportFormat;
}>) {
  return (
    <section className="export-technical-details">
      <h3>
        <button type="button" aria-expanded={expanded} aria-controls="export-technical-content" disabled={busy} onClick={onToggle}>
          <ChevronRight className="export-technical-chevron" size={16} aria-hidden="true" />
          Technical details
        </button>
      </h3>
      <div id="export-technical-content" hidden={!expanded}>
        {selectedFormat === 'png' ? (
          <>
            {preflight.estimates && <p>Estimated peak memory {formatBytes(preflight.estimates.peakBytes)}.</p>}
            <p>PNG physical-resolution metadata is not embedded.</p>
            <p>The PNG renderer renders each map tile at its target pixel dimensions from the live vector map style instead of enlarging the browser preview.</p>
          </>
        ) : (
          <p>{selectedFormat === 'svg' ? 'Layered SVG' : 'The exact-page PDF'} embeds a raster basemap while route, POI, and shape remain named vector overlays.</p>
        )}
      </div>
    </section>
  );
}

type ExportDialogViewProps = {
  busy: boolean;
  cancelButtonRef: React.RefObject<HTMLButtonElement | null>;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  document: ProjectDocument;
  downloadButtonRef: React.RefObject<HTMLButtonElement | null>;
  error: string | null;
  onCancel: () => void;
  onClose: () => void;
  onDownload: () => void;
  onFormatChange: (format: ExportFormat) => void;
  onKeyDown: React.KeyboardEventHandler<HTMLDialogElement>;
  onTechnicalDetailsToggle: () => void;
  preflight: ExportPreflight;
  selectedFormat: ExportFormat;
  status: string;
  technicalDetailsExpanded: boolean;
};

export function ExportDialogView(props: ExportDialogViewProps) {
  const { busy, cancelButtonRef, dialogRef, document, downloadButtonRef, error, onCancel, onClose, onDownload, onFormatChange, onKeyDown, onTechnicalDetailsToggle, preflight, selectedFormat, status, technicalDetailsExpanded } = props;
  const selectedFormatIsSafe = selectedFormat !== 'png' || preflight.safe;
  return (
    <div className="export-overlay">
      <div className="export-backdrop" aria-hidden="true" onClick={busy ? undefined : onClose} />
      <dialog ref={dialogRef} className="export-dialog" open aria-modal="true" aria-labelledby="export-title" aria-busy={busy} tabIndex={-1} onKeyDown={onKeyDown}>
        <div className="export-dialog-header">
          <div><h2 id="export-title">Export map</h2><p>Choose a format for the current print frame.</p></div>
          <button className="icon-button" type="button" aria-label="Close export" disabled={busy} onClick={onClose}><X size={16} /></button>
        </div>
        <div className="export-dialog-body">
          <ExportFormatChoice busy={busy} onChange={onFormatChange} selectedFormat={selectedFormat} />
          <ExportOutputSummary document={document} preflight={preflight} selectedFormat={selectedFormat} />
          <ExportTechnicalDetails busy={busy} expanded={technicalDetailsExpanded} onToggle={onTechnicalDetailsToggle} preflight={preflight} selectedFormat={selectedFormat} />
          {selectedFormat === 'png' && preflight.errors.length > 0 && (
            <div className="export-error" role="alert">
              <strong>Export blocked</strong>
              <ul>{preflight.errors.map((issue) => <li key={issue.code}>{issue.message}</li>)}</ul>
              <p>Reduce the page dimensions before retrying.</p>
            </div>
          )}
          <p role="status">{status}</p>
          {error && <p className="export-error" role="alert">{error}</p>}
        </div>
        <div className="export-dialog-actions">
          <button ref={cancelButtonRef} type="button" onClick={busy ? onCancel : onClose}>{busy ? 'Cancel export' : 'Cancel'}</button>
          <button ref={downloadButtonRef} className="primary-button" type="button" disabled={busy || !selectedFormatIsSafe} onClick={onDownload}>{busy ? 'Preparing…' : DOWNLOAD_LABEL[selectedFormat]}</button>
        </div>
      </dialog>
    </div>
  );
}
