import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectDocument } from '../../domain/project';
import { projectAttributions } from '../../domain/projectAttributions';
import { createLayeredSvg, startLayeredSvgDownload } from '../../export/layeredSvg';
import { canStreamLargeRasterPng } from '../../export/largeRasterPng';
import { planExportPreflight, type RasterDelivery } from '../../export/preflight';
import { createPrintPdf, startPrintPdfDownload } from '../../export/printPdf';
import type { PreviewPngExporter } from '../../export/previewPng';
import { runPngExport } from './exportDialogPng';
import { ExportDialogView, type ExportFormat } from './ExportDialogView';

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

function useExportPreflight(document: ProjectDocument): Readonly<{
  preflight: ReturnType<typeof planExportPreflight>;
  rasterDelivery: RasterDelivery;
}> {
  return useMemo(() => {
    const request = {
      format: 'png' as const,
      page: { widthMm: document.page.widthMm, heightMm: document.page.heightMm },
      dpi: 300,
      attributions: projectAttributions(document),
      basemap: 'raster' as const,
      vectorOverlays: true,
      missing: {},
      rasterLayers: [],
      cancellationSupported: true,
    };
    const single = planExportPreflight({ ...request, rasterDelivery: 'single-png' });
    if (single.safe) return { preflight: single, rasterDelivery: 'single-png' };
    const streaming = planExportPreflight({ ...request, rasterDelivery: 'streaming-png' });
    return streaming.safe
      ? { preflight: streaming, rasterDelivery: 'streaming-png' }
      : { preflight: single, rasterDelivery: 'single-png' };
  }, [document]);
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

function handleExportDialogKeyDown(event: React.KeyboardEvent<HTMLDialogElement>, isBusy: boolean, dialog: HTMLDialogElement | null, onClose: () => void) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    if (!isBusy) onClose();
    return;
  }
  trapDialogFocus(event, dialog);
}

function selectExportFormat(format: ExportFormat, options: Readonly<{
  isBusy: boolean;
  setError: (error: string | null) => void;
  setFormat: (format: ExportFormat) => void;
  setStatus: (status: string) => void;
}>) {
  if (options.isBusy) return;
  options.setFormat(format);
  options.setError(null);
  options.setStatus('');
}

function runSelectedExport(format: ExportFormat, png: () => Promise<void>, svg: () => Promise<void>, pdf: () => void) {
  if (format === 'png') void png();
  else if (format === 'svg') void svg();
  else pdf();
}

export function ExportDialog({ exporter, filename, document, onClose }: ExportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png');

  const [technicalDetailsExpanded, setTechnicalDetailsExpanded] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { preflight, rasterDelivery } = useExportPreflight(document);
  const largeRasterSupported = canStreamLargeRasterPng();

  useEffect(() => {
    (preflight.safe ? downloadButtonRef : cancelButtonRef).current?.focus();
  }, [preflight.safe]);
  useEffect(() => {
    if (busy) cancelButtonRef.current?.focus();
  }, [busy]);
  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => handleExportDialogKeyDown(event, busy, dialogRef.current, onClose);

  const download = () => {
    if (!exporter?.createPrintTileRenderer) {
      setError('The live map preview is not ready yet. Wait for the map to load and try again.');
      return Promise.resolve();
    }
    return runPngExport({ abortControllerRef, document, exporter, filename, preflight, rasterDelivery, setBusy, setError, setStatus });
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

  const changeFormat = (format: ExportFormat) => selectExportFormat(format, { isBusy: busy, setError, setFormat: setSelectedFormat, setStatus });
  const downloadSelectedFormat = () => runSelectedExport(selectedFormat, download, downloadLayeredSvg, downloadPdf);

  return <ExportDialogView busy={busy} cancelButtonRef={cancelButtonRef} dialogRef={dialogRef} document={document} downloadButtonRef={downloadButtonRef} error={error} largeRasterSupported={largeRasterSupported} onCancel={cancelExport} onClose={onClose} onDownload={downloadSelectedFormat} onFormatChange={changeFormat} onKeyDown={handleKeyDown} onTechnicalDetailsToggle={() => setTechnicalDetailsExpanded((expanded) => !expanded)} preflight={preflight} rasterDelivery={rasterDelivery} selectedFormat={selectedFormat} status={status} technicalDetailsExpanded={technicalDetailsExpanded} />;
}
