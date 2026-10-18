import { useCallback, useEffect, useRef, useState } from 'react';
import type { PreviewPngExporter } from '../../export/previewPng';
import { drawStudioComposition } from '../../export/studioComposition';
import { useProject, useProjectStoreApi } from '../projectStoreContext';

function encodedCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('The browser could not create the wall preview.'));
  }, 'image/png'));
}

export function useWallPreview(readExporter: () => PreviewPngExporter | null, blockedReason?: string) {
  const store = useProjectStoreApi();
  const wall = useProject((state) => state.document.studio.wall);
  const epoch = useProject((state) => state.documentEpoch);
  const [preview, setPreview] = useState<{ epoch: number; url: string } | null>(null);
  const [openEpoch, setOpenEpoch] = useState<number | null>(null);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const previewUrl = useRef<string | null>(null);
  const releasePreview = useCallback(() => {
    const url = previewUrl.current;
    previewUrl.current = null;
    if (url) URL.revokeObjectURL(url);
  }, []);
  useEffect(() => () => {
    request.current?.abort();
    request.current = null;
    releasePreview();
  }, [epoch, blockedReason, releasePreview]);
  const close = useCallback(() => {
    request.current?.abort();
    request.current = null;
    releasePreview();
    setOpenEpoch(null);
    setPreview(null);
  }, [releasePreview]);
  const open = useCallback(async () => {
    request.current?.abort();
    request.current = null;
    releasePreview();
    setPreview(null);
    const current = store.getState();
    setOpenEpoch(current.documentEpoch);
    const exporter = readExporter();
    if (blockedReason || !exporter) {
      setError(blockedReason || 'Wait for the map to finish loading before previewing it.');
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    const document = current.document, documentEpoch = current.documentEpoch;
    const isCurrent = () => !controller.signal.aborted && request.current === controller
      && store.getState().documentEpoch === documentEpoch;
    setError('');
    try {
      const capture = await exporter({ content: 'composite', signal: controller.signal });
      try {
        if (!isCurrent()) return;
        if (!capture.projectToFrame) throw new Error('The map projection is not ready for the wall preview.');
        await drawStudioComposition(capture.surface, document, capture.projectToFrame, {
          signal: controller.signal, includeAttribution: true, referenceLongitude: capture.referenceLongitude,
        });
        const blob = await encodedCanvas(capture.surface);
        if (!isCurrent()) return;
        const url = URL.createObjectURL(blob);
        previewUrl.current = url;
        setPreview({ epoch: documentEpoch, url });
      } finally {
        capture.surface.width = 0;
        capture.surface.height = 0;
      }
    } catch (previewError) {
      if (isCurrent()) setError(previewError instanceof Error ? previewError.message : 'The wall preview could not be created.');
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [blockedReason, readExporter, releasePreview, store]);
  return { wall, isOpen: openEpoch === epoch, previewUrl: preview?.epoch === epoch ? preview.url : null, error, setError, open, close };
}
