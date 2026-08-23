import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { ProjectDocument } from '../../domain/project';
import { createLayeredSvg, startLayeredSvgDownload } from '../../export/layeredSvg';
import { planExportPreflight } from '../../export/preflight';
import { createPrintPdf, startPrintPdfDownload } from '../../export/printPdf';
import { createPrintSizePng, type PrintSizePngStage } from '../../export/printSizePng';
import {
  startPreviewDownload,
  type PreviewPngExporter,
  type PrintTileExportPlan,
} from '../../export/previewPng';

export type ExportDialogProps = {
  exporter: PreviewPngExporter | null;
  filename: string;
  document: ProjectDocument;
  onClose: () => void;
};

function trapDialogFocus(event: React.KeyboardEvent<HTMLDialogElement>, dialog: HTMLDialogElement | null) {
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

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function useExportPreflight(page: ProjectDocument['page']) {
  return useMemo(() => planExportPreflight({
    format: 'png',
    page: { widthMm: page.widthMm, heightMm: page.heightMm },
    dpi: 300,
    attributions: ['OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors'],
    basemap: 'raster',
    vectorOverlays: true,
    missing: {},
    rasterLayers: [],
    cancellationSupported: true,
  }), [page.heightMm, page.widthMm]);
}

function printPixelDensity(
  output: Readonly<{ width: number; height: number }>,
  page: ProjectDocument['page'],
): number {
  return (output.width / page.widthMm + output.height / page.heightMm) / 2;
}

function createPrintTileExportPlan(
  output: PrintTileExportPlan['output'],
  document: ProjectDocument,
  tiles: NonNullable<ReturnType<typeof planExportPreflight>['plan']>['tiles'],
  signal: AbortSignal,
): PrintTileExportPlan {
  return {
    output,
    pixelsPerMillimetre: printPixelDensity(output, document.page),
    regions: tiles.map((tile) => ({
      x: tile.renderX,
      y: tile.renderY,
      width: tile.renderWidth,
      height: tile.renderHeight,
    })),
    signal,
    symbolsVisible: document.style.visibility.labels,
  };
}

const PNG_STAGE_STATUS: Record<PrintSizePngStage, string> = {
  rendering: 'Rendering native-detail map tiles…',
  composing: 'Composing native-detail map tiles…',
  encoding: 'Encoding PNG…',
};

function reportPngStage(
  stage: PrintSizePngStage | 'downloading',
  setStatus: React.Dispatch<React.SetStateAction<string>>,
): void {
  if (stage !== 'downloading') setStatus(PNG_STAGE_STATUS[stage]);
  window.dispatchEvent(new CustomEvent('printmap:png-export-stage', { detail: { stage } }));
}

type ExportDialogViewProps = {
  busy: boolean;
  cancelButtonRef: React.RefObject<HTMLButtonElement | null>;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  downloadButtonRef: React.RefObject<HTMLButtonElement | null>;
  error: string | null;
  onCancel: () => void;
  onClose: () => void;
  onDownloadLayeredSvg: () => void;
  onDownloadPdf: () => void;
  onDownloadPng: () => void;
  onKeyDown: React.KeyboardEventHandler<HTMLDialogElement>;
  preflight: ReturnType<typeof planExportPreflight>;
  status: string;
};

function ExportDialogView(props: ExportDialogViewProps) {
  const { busy, cancelButtonRef, dialogRef, downloadButtonRef, error, onCancel, onClose, onDownloadLayeredSvg, onDownloadPdf, onDownloadPng, onKeyDown, preflight, status } = props;
  return (
    <div className="export-overlay">
      <div className="export-backdrop" aria-hidden="true" onClick={busy ? undefined : onClose} />
      <dialog ref={dialogRef} className="export-dialog" open aria-modal="true" aria-labelledby="export-title" aria-busy={busy} tabIndex={-1} onKeyDown={onKeyDown}>
        <div className="export-dialog-header">
          <div><span className="eyebrow">Export</span><h2 id="export-title">Export map</h2></div>
          <button className="icon-button" type="button" aria-label="Close export" disabled={busy} onClick={onClose}><X size={16} /></button>
        </div>
        <div className="export-dialog-body">
          <strong>PNG export preflight</strong>
          {preflight.dimensions && (
            <p><strong>{preflight.dimensions.widthPx} × {preflight.dimensions.heightPx} px — 300 DPI pixel target for placement at the selected page size.</strong></p>
          )}
          {preflight.estimates && <p>Estimated peak memory {formatBytes(preflight.estimates.peakBytes)}.</p>}
          <p>PNG physical-resolution metadata is not embedded.</p>
          <p>The PNG renderer renders each map tile at its target pixel dimensions from the live vector map style instead of enlarging the browser preview. Layered SVG and exact-page PDF still embed a raster basemap while route, POI, and shape remain named vector overlays.</p>
          {preflight.errors.length > 0 && (
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
          <button type="button" disabled={busy} onClick={onDownloadPdf}>Download PDF</button>
          <button type="button" disabled={busy} onClick={onDownloadLayeredSvg}>Download layered SVG</button>
          <button ref={downloadButtonRef} className="primary-button" type="button" disabled={busy || !preflight.safe} onClick={onDownloadPng}>{busy ? 'Preparing…' : 'Download PNG'}</button>
        </div>
      </dialog>
    </div>
  );
}

type PdfExportOptions = Pick<ExportDialogProps, 'document' | 'exporter' | 'filename'> & {
  abortControllerRef: React.RefObject<AbortController | null>;
  setBusy: (isBusy: boolean) => void;
  setError: (error: string | null) => void;
  setStatus: (status: string) => void;
};

async function runPdfExport(options: PdfExportOptions): Promise<void> {
  const { abortControllerRef, document, exporter, filename, setBusy, setError, setStatus } = options;
  if (!exporter) {
    setError('The live map preview is not ready yet. Wait for the map to load and try again.');
    return;
  }
  const controller = new AbortController();
  abortControllerRef.current = controller;
  setBusy(true);
  setError(null);
  setStatus('Capturing a raster basemap for PDF…');
  let sourceSurface: HTMLCanvasElement | null = null;
  try {
    const source = await exporter({ content: 'basemap', signal: controller.signal });
    sourceSurface = source.surface;
    if (controller.signal.aborted) throw new DOMException('PDF export was cancelled.', 'AbortError');
    const pdf = await createPrintPdf(document, source, controller.signal);
    if (controller.signal.aborted) throw new DOMException('PDF export was cancelled.', 'AbortError');
    startPrintPdfDownload(pdf, filename);
    setStatus('Download started for PDF.');
  } catch (error_) {
    if (controller.signal.aborted || (error_ instanceof DOMException && error_.name === 'AbortError')) {
      setStatus('Export cancelled.');
    } else {
      setError(error_ instanceof Error ? error_.message : 'PDF export failed.');
      setStatus('Export failed.');
    }
  } finally {
    if (sourceSurface) {
      sourceSurface.width = 0;
      sourceSurface.height = 0;
    }
    if (abortControllerRef.current === controller) abortControllerRef.current = null;
    setBusy(false);
  }
}

export function ExportDialog({ exporter, filename, document, onClose }: ExportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready to export the current print-frame preview.');
  const [error, setError] = useState<string | null>(null);
  const preflight = useExportPreflight(document.page);

  useEffect(() => {
    (preflight.safe ? downloadButtonRef : cancelButtonRef).current?.focus();
  }, [preflight.safe]);
  useEffect(() => {
    if (busy) cancelButtonRef.current?.focus();
  }, [busy]);
  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onClose();
      return;
    }
    trapDialogFocus(event, dialogRef.current);
  };

  const download = async () => {
    if (!exporter?.createPrintTileRenderer) {
      setError('The live map preview is not ready yet. Wait for the map to load and try again.');
      return;
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setBusy(true);
    setError(null);
    setStatus('Rendering native-detail map tiles…');
    try {
      if (!preflight.dimensions || !preflight.plan) throw new Error('Export preflight did not produce a target tile plan.');
      const output = {
        width: preflight.dimensions.widthPx,
        height: preflight.dimensions.heightPx,
      };
      const exportPlan = createPrintTileExportPlan(
        output, document, preflight.plan.tiles, controller.signal,
      );
      const renderTile = exporter.createPrintTileRenderer(exportPlan);
      const result = await createPrintSizePng({
        preflight,
        renderTile: ({ region, signal }) => renderTile({ output, region, signal }),
        signal: controller.signal,
        onStage: (stage) => { reportPngStage(stage, setStatus); },
        onProgress: ({ completedTiles, totalTiles, fraction }) => {
          setStatus(`Composing PNG… ${completedTiles}/${totalTiles} tiles (${Math.round(fraction * 100)}%).`);
        },
      });
      try {
        reportPngStage('downloading', setStatus);
        startPreviewDownload(result.blob, filename);
        setStatus(`Download started for ${result.width} × ${result.height} PNG.`);
      } finally {
        result.surface.width = 0;
        result.surface.height = 0;
      }
    } catch (error_) {
      if (controller.signal.aborted || (error_ instanceof DOMException && error_.name === 'AbortError')) {
        setStatus('Export cancelled.');
      } else {
        setError(error_ instanceof Error ? error_.message : 'PNG export failed.');
        setStatus('Export failed.');
      }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setBusy(false);
    }
  };

  const cancelExport = () => {
    abortControllerRef.current?.abort();
    setStatus('Cancelling export…');
  };

  const downloadLayeredSvg = async () => {
    if (!exporter) {
      setError('The live map preview is not ready yet. Wait for the map to load and try again.');
      return;
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setBusy(true);
    setError(null);
    setStatus('Capturing a raster basemap for layered SVG…');
    let sourceSurface: HTMLCanvasElement | null = null;
    try {
      const source = await exporter({ content: 'basemap', signal: controller.signal });
      sourceSurface = source.surface;
      if (controller.signal.aborted) throw new DOMException('Layered SVG export was cancelled.', 'AbortError');
      const svg = await createLayeredSvg(document, source);
      if (controller.signal.aborted) throw new DOMException('Layered SVG export was cancelled.', 'AbortError');
      startLayeredSvgDownload(svg, filename);
      setStatus('Download started for layered SVG.');
    } catch (error_) {
      if (controller.signal.aborted || (error_ instanceof DOMException && error_.name === 'AbortError')) {
        setStatus('Export cancelled.');
      } else {
        setError(error_ instanceof Error ? error_.message : 'Layered SVG export failed.');
        setStatus('Export failed.');
      }
    } finally {
      if (sourceSurface) {
        sourceSurface.width = 0;
        sourceSurface.height = 0;
      }
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setBusy(false);
    }
  };

  const downloadPdf = () => void runPdfExport({ abortControllerRef, document, exporter, filename, setBusy, setError, setStatus });

  return <ExportDialogView busy={busy} cancelButtonRef={cancelButtonRef} dialogRef={dialogRef} downloadButtonRef={downloadButtonRef} error={error} onCancel={cancelExport} onClose={onClose} onDownloadLayeredSvg={downloadLayeredSvg} onDownloadPdf={downloadPdf} onDownloadPng={download} onKeyDown={handleKeyDown} preflight={preflight} status={status} />;
}
