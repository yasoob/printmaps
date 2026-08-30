import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectDocument } from '../../domain/project';
import { projectAttributions } from '../../domain/projectAttributions';
import { canStreamLargeRasterPng } from '../../export/largeRasterPng';
import { planLayeredPsdExport } from '../../export/layeredPsdPlan';
import { planExportPreflight, type RasterDelivery } from '../../export/preflight';
import type { PreviewPngExporter } from '../../export/previewPng';
import { runPdfExport } from './exportDialogPdf';
import { runPngExport } from './exportDialogPng';
import { runPsdExport } from './exportDialogPsd';
import { NATIVE_SYMBOL_BUFFER_PX } from './exportDialogRaster';
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
    const limits = document.style.visibility.labels ? { tileOverlapPx: NATIVE_SYMBOL_BUFFER_PX } : {};
    const single = planExportPreflight({ ...request, rasterDelivery: 'single-png' }, limits);
    if (single.safe) return { preflight: single, rasterDelivery: 'single-png' };
    const streaming = planExportPreflight({ ...request, rasterDelivery: 'streaming-png' }, limits);
    return streaming.safe
      ? { preflight: streaming, rasterDelivery: 'streaming-png' }
      : { preflight: single, rasterDelivery: 'single-png' };
  }, [document]);
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

function runSelectedExport(
  format: ExportFormat,
  exports: Readonly<Record<ExportFormat, () => void>>,
) {
  exports[format]();
}

export function ExportDialog({ exporter, filename, document, onClose }: ExportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancellationAvailable, setCancellationAvailable] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png');

  const [technicalDetailsExpanded, setTechnicalDetailsExpanded] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { preflight, rasterDelivery } = useExportPreflight(document);
  const psdPlan = useMemo(() => planLayeredPsdExport(document), [document]);
  const largeRasterSupported = canStreamLargeRasterPng();

  useEffect(() => {
    (preflight.safe ? downloadButtonRef : cancelButtonRef).current?.focus();
  }, [preflight.safe]);
  useEffect(() => {
    if (!busy) return;
    if (cancellationAvailable) cancelButtonRef.current?.focus();
    else dialogRef.current?.focus();
  }, [busy, cancellationAvailable]);
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
      const { createLayeredSvg, startLayeredSvgDownload } = await import('../../export/layeredSvg');
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
  const downloadPsd = () => void runPsdExport({
    abortControllerRef,
    document,
    exporter,
    filename,
    setBusy,
    setCancellationAvailable,
    setError,
    setStatus,
  });

  const changeFormat = (format: ExportFormat) => selectExportFormat(format, { isBusy: busy, setError, setFormat: setSelectedFormat, setStatus });
  const downloadSelectedFormat = () => runSelectedExport(selectedFormat, {
    pdf: downloadPdf,
    png: () => void download(),
    psd: downloadPsd,
    svg: () => void downloadLayeredSvg(),
  });

  return <ExportDialogView busy={busy} cancellationAvailable={cancellationAvailable} cancelButtonRef={cancelButtonRef} dialogRef={dialogRef} document={document} downloadButtonRef={downloadButtonRef} error={error} largeRasterSupported={largeRasterSupported} onCancel={cancelExport} onClose={onClose} onDownload={downloadSelectedFormat} onFormatChange={changeFormat} onKeyDown={handleKeyDown} onTechnicalDetailsToggle={() => setTechnicalDetailsExpanded((expanded) => !expanded)} preflight={preflight} psdPlan={psdPlan} rasterDelivery={rasterDelivery} selectedFormat={selectedFormat} status={status} technicalDetailsExpanded={technicalDetailsExpanded} />;
}
