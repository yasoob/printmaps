import { useEffect, useMemo, useRef, useState } from 'react';
import { trackEditorAction } from '../../analytics/editorAnalytics';
import type { ProjectDocument } from '../../domain/project';
import { projectPrintAttributions } from '../../domain/projectAttributions';
import { canStreamLargeRasterPng } from '../../export/largeRasterPng';
import { planLayeredPsdExport } from '../../export/layeredPsdPlan';
import { planExportPreflight, type RasterDelivery } from '../../export/preflight';
import type { PreviewPngExporter } from '../../export/previewPng';
import { planPdfExport, runPdfExport } from './exportDialogPdf';
import { runPngExport } from './exportDialogPng';
import { runPsdExport } from './exportDialogPsd';
import { NATIVE_SYMBOL_BUFFER_PX } from './exportDialogRaster';
import type { ExportDialogViewProps, ExportFormat } from './ExportDialogView';
import { runVectorExport } from './exportDialogVector';
import { runLayeredSvgExport } from './exportDialogSvg';
import { useStableEvent } from '../hooks/useStableEvent';

export type PrintExportProps = {
  exporter: PreviewPngExporter | null;
  filename: string;
  document: ProjectDocument;
  onClose: () => void;
  blockedReason?: string;
};

function useExportPreflight(document: ProjectDocument): Readonly<{
  preflight: ReturnType<typeof planExportPreflight>;
  rasterDelivery: RasterDelivery;
}> {
  return useMemo(() => {
    const request = {
      format: 'png' as const,
      page: { widthMm: document.page.widthMm, heightMm: document.page.heightMm },
      dpi: 300,
      attributions: projectPrintAttributions(document),
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

export function usePrintExportController({ exporter, filename, document, onClose, blockedReason }: PrintExportProps): ExportDialogViewProps {
  const dialogRef = useRef<HTMLDivElement>(null);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancellationAvailable, setCancellationAvailable] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png');
  const [basemapMode, setBasemapMode] = useState<'hybrid' | 'vector'>('hybrid');

  const [technicalDetailsExpanded, setTechnicalDetailsExpanded] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hasStarted = useRef(false);
  const { preflight, rasterDelivery } = useExportPreflight(document);
  const psdPlan = useMemo(() => planLayeredPsdExport(document), [document]);
  const pdfPreflight = useMemo(() => planPdfExport(document), [document]);
  const largeRasterSupported = canStreamLargeRasterPng();

  useEffect(() => {
    if (busy) {
      if (cancellationAvailable) cancelButtonRef.current?.focus();
      else dialogRef.current?.focus();
    } else if (hasStarted.current) downloadButtonRef.current?.focus();
  }, [busy, cancellationAvailable]);
  useEffect(() => () => abortControllerRef.current?.abort(), []);
  useEffect(() => { if (blockedReason) abortControllerRef.current?.abort(); }, [blockedReason]);

  const download = () => {
    if (!exporter?.createPrintTileRenderer) {
      trackEditorAction('exportStarted', { format: 'png' });
      trackEditorAction('exportFailed', { format: 'png' });
      setError('The live map preview is not ready yet. Wait for the map to load and try again.');
      return Promise.resolve();
    }
    return runPngExport({ abortControllerRef, document, exporter, filename, preflight, rasterDelivery, setBusy, setError, setStatus });
  };

  const cancelExport = () => {
    abortControllerRef.current?.abort();
    setStatus('Cancelling export…');
  };

  const downloadLayeredSvg = () => runLayeredSvgExport({ abortControllerRef, document, exporter, filename, setBusy, setError, setStatus });

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

  const changeFormat = (format: ExportFormat) => {
    if (!busy && format !== selectedFormat) trackEditorAction('exportFormatSelected', { format });
    selectExportFormat(format, { isBusy: busy, setError, setFormat: setSelectedFormat, setStatus });
  };
  const downloadSelectedFormat = () => {
    if (busy || blockedReason || abortControllerRef.current) return;
    hasStarted.current = true;
    if (basemapMode === 'vector' && (selectedFormat === 'svg' || selectedFormat === 'pdf')) {
      void runVectorExport({ abortControllerRef, document, exporter, filename, format: selectedFormat, setBusy, setError, setStatus });
      return;
    }
    runSelectedExport(selectedFormat, {
    pdf: downloadPdf,
    png: () => void download(),
    psd: downloadPsd,
    svg: () => void downloadLayeredSvg(),
    });
  };

  const onBasemapModeChange = useStableEvent((mode: 'hybrid' | 'vector') => {
    if (busy) return;
    setBasemapMode(mode); setError(null); setStatus('');
  });
  const onCancel = useStableEvent(cancelExport);
  const onDownload = useStableEvent(downloadSelectedFormat);
  const onFormatChange = useStableEvent(changeFormat);
  const onTechnicalDetailsToggle = useStableEvent(() => setTechnicalDetailsExpanded((expanded) => !expanded));
  return {
    basemapMode, vectorAvailable: Boolean(exporter?.captureVectorBasemap), onBasemapModeChange,
    busy, isMapReady: exporter !== null && !blockedReason, cancellationAvailable, cancelButtonRef, dialogRef,
    document, downloadButtonRef, error: blockedReason || error, largeRasterSupported, onCancel, onClose,
    onDownload, onFormatChange, onTechnicalDetailsToggle, preflight, pdfPreflight, psdPlan, rasterDelivery,
    selectedFormat, status, technicalDetailsExpanded,
  };
}
