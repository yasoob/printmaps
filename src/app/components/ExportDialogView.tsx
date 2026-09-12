import { ChevronRight, X } from 'lucide-react';
import type React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { StudioDialogActions, StudioDialogBody, StudioDialogButton, StudioDialogHeader, StudioDialogSection } from '@/components/ui/studio-dialog';
import type { ProjectDocument } from '../../domain/project';
import type { LayeredPsdExportPlan } from '../../export/layeredPsdPlan';
import { planExportPreflight, type RasterDelivery } from '../../export/preflight';
import { PDF_PREFLIGHT_GUIDANCE, pdfPreflightErrorMessage } from './exportDialogPdf';

export type ExportFormat = 'png' | 'svg' | 'psd' | 'pdf';

type ExportPreflight = ReturnType<typeof planExportPreflight>;

const EXPORT_FORMATS: ReadonlyArray<Readonly<{
  description: string;
  format: ExportFormat;
  label: string;
}>> = [
  { format: 'png', label: 'PNG', description: 'Native-detail raster' },
  { format: 'svg', label: 'Layered SVG', description: 'Vector content layers' },
  { format: 'psd', label: 'Layered PSD', description: 'SVG Smart Objects' },
  { format: 'pdf', label: 'PDF', description: 'Exact print page' },
];

const DOWNLOAD_LABEL: Record<ExportFormat, string> = {
  png: 'Download PNG',
  svg: 'Download layered SVG',
  psd: 'Download layered PSD',
  pdf: 'Download PDF',
};

function downloadLabel(format: ExportFormat): string {
  return DOWNLOAD_LABEL[format];
}

function exportStatus(status: string, isMapReady: boolean, isBusy: boolean) {
  return isMapReady || isBusy ? status
    : 'The map preview is not ready to export. Wait for recovery, or close this dialog and retry the map.';
}

function canStartExport(isBusy: boolean, isMapReady: boolean, canDownloadSelectedFormat: boolean) {
  return !isBusy && isMapReady && canDownloadSelectedFormat;
}

function cancelLabel(isBusy: boolean, isCancellationAvailable: boolean): string {
  if (!isBusy) return 'Cancel';
  return isCancellationAvailable ? 'Cancel export' : 'Finishing export…';
}

function canDownload(
  format: ExportFormat,
  options: Readonly<{
    canStreamLargePng: boolean;
    delivery: RasterDelivery;
    preflight: ExportPreflight;
    pdfPreflight: ExportPreflight;
    psdPlan: LayeredPsdExportPlan;
  }>,
): boolean {
  if (format === 'psd') return options.psdPlan.preflight.safe;
  if (format === 'pdf') return options.pdfPreflight.safe;
  if (format === 'png') {
    return options.preflight.safe
      && (options.delivery !== 'streaming-png' || options.canStreamLargePng);
  }
  return true;
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function PreflightNotice({ format, preflight }: { format: ExportFormat; preflight: ExportPreflight }) {
  if (format === 'svg' || preflight.errors.length === 0) return null;
  if (format === 'pdf') {
    return <div id="export-preflight-error" className="export-error" role="alert">
      <strong>PDF export blocked</strong>
      <p>{pdfPreflightErrorMessage(preflight)}</p>
      <p>{PDF_PREFLIGHT_GUIDANCE}</p>
    </div>;
  }
  return <div id="export-preflight-error" className="export-error" role="alert">
    <strong>Export blocked</strong>
    <ul>{preflight.errors.map((issue) => <li key={issue.code}>{issue.message}</li>)}</ul>
    <p>Reduce the page dimensions before retrying.</p>
  </div>;
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

function ExportOutputSummary({ document, preflight, psdPlan, selectedFormat }: Readonly<{
  document: ProjectDocument;
  preflight: ExportPreflight;
  psdPlan: LayeredPsdExportPlan;
  selectedFormat: ExportFormat;
}>) {
  const pageLabel = `${document.page.preset} ${document.page.orientation}`;
  if (selectedFormat === 'png') return (
    <StudioDialogSection className="export-output-summary" aria-labelledby="export-output-title">
      <span id="export-output-title">Output</span>
      {preflight.dimensions && <strong>{preflight.dimensions.widthPx} × {preflight.dimensions.heightPx} px — 300 DPI pixel target</strong>}
      {preflight.delivery === 'streaming-png' ? (
        <p>{pageLabel} · Rendered in bounded regions and streamed into one PNG file.</p>
      ) : <p>{pageLabel} · Native-detail PNG</p>}
    </StudioDialogSection>
  );
  if (selectedFormat === 'psd') return (
    <StudioDialogSection className="export-output-summary" aria-labelledby="export-output-title">
      <span id="export-output-title">Output</span>
      {psdPlan.preflight.dimensions && (
        <strong>
          {psdPlan.preflight.dimensions.widthPx} × {psdPlan.preflight.dimensions.heightPx} px — {psdPlan.effectiveDpi} DPI
        </strong>
      )}
      <p>{pageLabel} · Native-detail basemap and named SVG Smart Objects</p>
    </StudioDialogSection>
  );
  return (
    <StudioDialogSection className="export-output-summary" aria-labelledby="export-output-title">
      <span id="export-output-title">Output</span>
      <strong>{pageLabel} · {document.page.widthMm} × {document.page.heightMm} mm</strong>
      <p>{selectedFormat === 'svg' ? 'Raster basemap · named vector overlays' : '300 DPI lossless basemap · named vector overlays'}</p>
    </StudioDialogSection>
  );
}

function StreamingPngNotice({ delivery, canStreamLargePng, selectedFormat }: Readonly<{
  delivery: RasterDelivery;
  canStreamLargePng: boolean;
  selectedFormat: ExportFormat;
}>) {
  if (selectedFormat !== 'png' || delivery !== 'streaming-png') return null;
  if (canStreamLargePng) return null;
  return (
    <div className="export-error" role="alert">
      <strong>Large single PNG unavailable in this browser</strong>
      <p>Use Chrome or Edge with the File System Access API, or reduce the page size.</p>
    </div>
  );
}

function ExportTechnicalDetails({ busy, expanded, onToggle, preflight, psdPlan, selectedFormat }: Readonly<{
  busy: boolean;
  expanded: boolean;
  onToggle: () => void;
  preflight: ExportPreflight;
  psdPlan: LayeredPsdExportPlan;
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
        {(selectedFormat === 'png' || selectedFormat === 'pdf') && preflight.estimates && <p>Estimated peak memory {formatBytes(preflight.estimates.peakBytes)}.</p>}
        {selectedFormat === 'png' ? (
          <>
            <p>PNG embeds 300 DPI physical-resolution metadata.</p>
            <p>The PNG renderer renders bounded map regions at their target pixel dimensions from the live vector map style instead of enlarging the browser preview.</p>
          </>
        ) : (selectedFormat === 'psd' ? (
          <p>Layered PSD keeps the native-detail basemap as raster while every route, POI, shape, and attribution remains an embedded, separately named SVG Smart Object.{psdPlan.compact ? ` Output is reduced to ${psdPlan.effectiveDpi} DPI to stay within reliable browser memory limits.` : ''}</p>
        ) : (
          <p>{selectedFormat === 'svg'
            ? 'Layered SVG embeds a raster basemap while route, POI, and shape remain named vector overlays.'
            : 'The exact-page PDF losslessly embeds bounded native-detail basemap regions at a 300 DPI pixel target while route, POI, and shape remain named vector overlays.'}</p>
        ))}
      </div>
    </section>
  );
}

type ExportDialogViewProps = {
  isMapReady: boolean;
  busy: boolean;
  cancellationAvailable: boolean;
  cancelButtonRef: React.RefObject<HTMLButtonElement | null>;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  document: ProjectDocument;
  downloadButtonRef: React.RefObject<HTMLButtonElement | null>;
  error: string | null;
  largeRasterSupported: boolean;
  onCancel: () => void;
  onClose: () => void;
  onDownload: () => void;
  onFormatChange: (format: ExportFormat) => void;
  onTechnicalDetailsToggle: () => void;
  preflight: ExportPreflight;
  pdfPreflight: ExportPreflight;
  psdPlan: LayeredPsdExportPlan;
  rasterDelivery: RasterDelivery;
  selectedFormat: ExportFormat;
  status: string;
  technicalDetailsExpanded: boolean;
};

export function ExportDialogView(props: ExportDialogViewProps) {
  const { busy, cancellationAvailable, cancelButtonRef, dialogRef, document, downloadButtonRef, error, largeRasterSupported, onCancel, onClose, onDownload, onFormatChange, onTechnicalDetailsToggle, preflight, pdfPreflight, psdPlan, rasterDelivery, selectedFormat, status, technicalDetailsExpanded } = props;
  const canDownloadSelectedFormat = canDownload(selectedFormat, {
    canStreamLargePng: largeRasterSupported,
    delivery: rasterDelivery,
    preflight,
    pdfPreflight,
    psdPlan,
  });
  const selectedPreflight = selectedFormat === 'psd' ? psdPlan.preflight : (selectedFormat === 'pdf' ? pdfPreflight : preflight);
  return (
    <Dialog
      open
      onOpenChange={(open, eventDetails) => {
        if (open) return;
        if (busy) eventDetails.cancel();
        else onClose();
      }}
    >
      <DialogContent
        ref={dialogRef}
        className="export-dialog"
        overlayClassName="export-dialog-backdrop"
        showCloseButton={false}
        initialFocus={canDownloadSelectedFormat && props.isMapReady ? downloadButtonRef : cancelButtonRef}
        aria-labelledby="export-title"
        aria-busy={busy}
        tabIndex={-1}
      >
        <StudioDialogHeader className="export-dialog-header">
          <div><h2 id="export-title">Export map</h2><p>Choose a format for the current print frame.</p></div>
          <button className="icon-button close-button" type="button" aria-label="Close export" disabled={busy} onClick={onClose}><X size={16} /></button>
        </StudioDialogHeader>
        <StudioDialogBody className="export-dialog-body" role="region" aria-label="Export settings" tabIndex={0}>
          <ExportFormatChoice busy={busy} onChange={onFormatChange} selectedFormat={selectedFormat} />
          <StreamingPngNotice canStreamLargePng={largeRasterSupported} delivery={rasterDelivery} selectedFormat={selectedFormat} />
          <ExportOutputSummary document={document} preflight={preflight} psdPlan={psdPlan} selectedFormat={selectedFormat} />
          <PreflightNotice format={selectedFormat} preflight={selectedPreflight} />
          <ExportTechnicalDetails busy={busy} expanded={technicalDetailsExpanded} onToggle={onTechnicalDetailsToggle} preflight={selectedPreflight} psdPlan={psdPlan} selectedFormat={selectedFormat} />

          <p className="export-status" role="status" aria-label="Export status">{exportStatus(status, props.isMapReady, busy)}</p>
          {error && <p className="export-error" role="alert">{error}</p>}
        </StudioDialogBody>
        <StudioDialogActions className="export-dialog-actions">
          <StudioDialogButton ref={cancelButtonRef} disabled={busy && !cancellationAvailable} onClick={busy ? onCancel : onClose}>{cancelLabel(busy, cancellationAvailable)}</StudioDialogButton>
          <StudioDialogButton ref={downloadButtonRef} variant="primary" disabled={!canStartExport(busy, props.isMapReady, canDownloadSelectedFormat)} aria-describedby={selectedFormat !== 'svg' && selectedPreflight.errors.length > 0 ? 'export-preflight-error' : undefined} onClick={onDownload}>{busy ? 'Preparing…' : downloadLabel(selectedFormat)}</StudioDialogButton>
        </StudioDialogActions>
      </DialogContent>
    </Dialog>
  );
}
