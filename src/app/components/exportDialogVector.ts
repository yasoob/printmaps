import type React from 'react';
import { trackEditorAction } from '../../analytics/editorAnalytics';
import type { ProjectDocument } from '../../domain/project';
import type { PreviewPngExporter } from '../../export/previewPng';

function isCancelled(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof DOMException && error.name === 'AbortError');
}

export async function runVectorExport(options: Readonly<{
  abortControllerRef: React.RefObject<AbortController | null>;
  document: ProjectDocument;
  exporter: PreviewPngExporter | null;
  filename: string;
  format: 'svg' | 'pdf';
  setBusy: (isBusy: boolean) => void;
  setError: (error: string | null) => void;
  setStatus: (status: string) => void;
}>): Promise<void> {
  const { format, exporter, setBusy, setError, setStatus } = options;
  trackEditorAction('exportStarted', { format });
  if (!exporter?.captureVectorBasemap) {
    setError('True vector capture is not ready. Wait for the map or choose Hybrid mode.');
    trackEditorAction('exportFailed', { format });
    return;
  }
  const document = structuredClone(options.document);
  const controller = new AbortController();
  options.abortControllerRef.current = controller;
  setBusy(true);
  setError(null);
  setStatus('Capturing vector tiles and laying out editable labels…');
  try {
    const capture = await exporter.captureVectorBasemap({ signal: controller.signal });
    if (controller.signal.aborted) throw new DOMException('Export cancelled.', 'AbortError');
    setStatus('Serializing true vector artwork…');
    if (format === 'svg') {
      const { createVectorSvg, startLayeredSvgDownload } = await import('../../export/layeredSvg');
      if (controller.signal.aborted) throw new DOMException('Export cancelled.', 'AbortError');
      const blob = createVectorSvg(document, capture);
      startLayeredSvgDownload(blob, options.filename);
    } else {
      const [{ createVectorPrintPdf }, { startPrintPdfDownload }] = await Promise.all([
        import('../../export/printPdf'), import('../../export/printPdfDownload'),
      ]);
      const blob = await createVectorPrintPdf(document, capture, controller.signal);
      if (controller.signal.aborted) throw new DOMException('Export cancelled.', 'AbortError');
      startPrintPdfDownload(blob, options.filename);
    }
    trackEditorAction('exportCompleted', { format });
    setStatus('Download started for true vector artwork.');
  } catch (error) {
    if (isCancelled(error, controller.signal)) {
      trackEditorAction('exportCancelled', { format });
      setStatus('Export cancelled.');
    } else {
      trackEditorAction('exportFailed', { format });
      setError(error instanceof Error ? error.message : 'True vector export failed. Choose Hybrid mode for compatibility.');
      setStatus('Export failed. No hybrid fallback was downloaded.');
    }
  } finally {
    if (options.abortControllerRef.current === controller) options.abortControllerRef.current = null;
    setBusy(false);
  }
}
