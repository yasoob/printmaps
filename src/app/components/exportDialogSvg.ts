import type { RefObject } from 'react';
import { trackEditorAction } from '../../analytics/editorAnalytics';
import type { ProjectDocument } from '../../domain/project';
import type { PreviewPngExporter } from '../../export/previewPng';

export async function runLayeredSvgExport(options: {
  abortControllerRef: RefObject<AbortController | null>;
  document: ProjectDocument;
  exporter: PreviewPngExporter | null;
  filename: string;
  setBusy: (isBusy: boolean) => void;
  setError: (error: string | null) => void;
  setStatus: (status: string) => void;
}) {
  const { abortControllerRef, document, exporter, filename, setBusy, setError, setStatus } = options;
  trackEditorAction('exportStarted', { format: 'svg' });
  if (!exporter) {
    trackEditorAction('exportFailed', { format: 'svg' });
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
    trackEditorAction('exportCompleted', { format: 'svg' });
    setStatus('Download started for layered SVG.');
  } catch (error) {
    if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      trackEditorAction('exportCancelled', { format: 'svg' });
      setStatus('Export cancelled.');
    } else {
      trackEditorAction('exportFailed', { format: 'svg' });
      setError(error instanceof Error ? error.message : 'Layered SVG export failed.');
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
