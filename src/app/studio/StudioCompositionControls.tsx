import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createDefaultLayerAppearance, type ContentLayer } from '../../domain/project';
import { mutationRejected } from '../../domain/projectMutation';
import { validatePhotoFile } from '../../domain/studioPhotoAssets';
import { createSilhouetteApplication } from '../../domain/studioSilhouette';
import { createPosterTemplateApplication } from '../../domain/studioTemplates';
import type { PreviewPngExporter } from '../../export/previewPng';
import { drawStudioComposition } from '../../export/studioComposition';
import { useProject, useProjectActions, useProjectStoreApi } from '../projectStoreContext';
import { StudioCompositionPanel } from './StudioCompositionPanel';
import { WallPreviewDialog } from './WallPreviewDialog';
import type { PhotoUpload } from './PhotoStoryControls';

function encodedCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('The browser could not create the wall preview.'));
  }, 'image/png'));
}

function useWallPreview(exporter: PreviewPngExporter | null, blockedReason?: string) {
  const store = useProjectStoreApi();
  const wall = useProject((state) => state.document.studio.wall);
  const epoch = useProject((state) => state.documentEpoch);
  const [preview, setPreview] = useState<{ epoch: number; url: string } | null>(null);
  const [openEpoch, setOpenEpoch] = useState<number | null>(null);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  const close = () => {
    request.current?.abort();
    setOpenEpoch(null);
    setPreview(null);
  };
  const open = async () => {
    if (blockedReason || !exporter) {
      setError(blockedReason || 'Wait for the map to finish loading before previewing it.');
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const current = store.getState();
    setOpenEpoch(current.documentEpoch);
    const document = current.document, documentEpoch = current.documentEpoch;
    setError('');
    setPreview(null);
    try {
      const capture = await exporter({ content: 'composite', signal: controller.signal });
      try {
        if (!capture.projectToFrame) throw new Error('The map projection is not ready for the wall preview.');
        await drawStudioComposition(capture.surface, document, capture.projectToFrame, { signal: controller.signal, includeAttribution: true, referenceLongitude: capture.referenceLongitude });
        const blob = await encodedCanvas(capture.surface);
        if (controller.signal.aborted || store.getState().documentEpoch !== documentEpoch) return;
        setPreview({ epoch: documentEpoch, url: URL.createObjectURL(blob) });
      } finally {
        capture.surface.width = 0; capture.surface.height = 0;
      }
    } catch (previewError) {
      if (!controller.signal.aborted) setError(previewError instanceof Error ? previewError.message : 'The wall preview could not be created.');
    }
  };
  return { wall, isOpen: openEpoch === epoch, previewUrl: preview?.epoch === epoch ? preview.url : null, error, setError, open, close };
}

function usePhotoUpload(): PhotoUpload {
  const store = useProjectStoreApi();
  return async (file, layerId, expectedDocumentEpoch) => {
    const current = store.getState();
    const center: [number, number] = [...current.document.camera.center];
    const asset = await validatePhotoFile(file);
    const id = `photo-${crypto.randomUUID()}`;
    const poi: ContentLayer | undefined = layerId ? undefined : {
      id: `photo-point-${crypto.randomUUID()}`, name: file.name.replace(/\.[^.]+$/, '').slice(0, 200) || 'Photo stop',
      type: 'poi', visible: true, locked: false, opacity: 100,
      geometry: { type: 'Point', coordinates: center }, appearance: createDefaultLayerAppearance('poi'),
    };
    return store.getState().addPhotoStop({
      asset, expectedDocumentEpoch, presentation: 'map',
      stop: { id, layerId: layerId ?? poi!.id, assetId: asset.id, caption: '' },
      ...(poi && { poi }),
    });
  };
}

export const StudioCompositionControls = memo(function StudioCompositionControls({ exporter, blockedReason }: {
  exporter: PreviewPngExporter | null; blockedReason?: string;
}) {
  const store = useProjectStoreApi(), actions = useProjectActions();
  const poster = useProject((state) => state.document.studio.poster);
  const photos = useProject((state) => state.document.studio.photos);
  const decorations = useProject((state) => state.document.studio.decorations);
  const page = useProject((state) => state.document.page);
  const layers = useProject((state) => state.document.layers);
  const documentEpoch = useProject((state) => state.documentEpoch);
  const cameraLocked = useProject((state) => state.document.camera.locked);
  const isFlat = useProject((state) => state.document.camera.pitch === 0 && !state.document.studio.terrain.enabled);
  const pointLayers = useMemo(() => layers.filter((layer) => layer.type === 'poi' && layer.geometry?.type === 'Point'), [layers]);
  const photoUpload = usePhotoUpload();
  const wallPreview = useWallPreview(exporter, blockedReason);
  return <>
    {blockedReason && <p role="status">{blockedReason}</p>}
    {wallPreview.error && !wallPreview.isOpen && <p className="studio-composition-error" role="alert">{wallPreview.error}</p>}
    <fieldset disabled={Boolean(blockedReason)} className="studio-composition-boundary">
    <StudioCompositionPanel poster={poster} photos={photos} decorations={decorations} pointLayers={pointLayers} documentEpoch={documentEpoch} cameraLocked={cameraLocked} isFlat={isFlat}
      onPosterChange={(value) => actions.setStudioSection('poster', value)}
      onPhotosChange={(value) => actions.setStudioSection('photos', value)}
      onDecorationsChange={(value) => actions.setStudioSection('decorations', value)}
      onApplyTemplate={(id, starter) => {
        if (blockedReason) return mutationRejected(blockedReason);
        try { return actions.applyStudioTemplate(createPosterTemplateApplication(store.getState().document, id, starter)); }
        catch (error) { return mutationRejected(error instanceof Error ? error.message : 'The poster template could not be applied.'); }
      }}
      onCreateSilhouette={(area) => {
        if (blockedReason) return mutationRejected(blockedReason);
        if (!exporter?.captureRenderSnapshot) return mutationRejected('Wait for the map to finish loading before fitting a boundary.');
        try {
          const snapshot = exporter.captureRenderSnapshot({ content: 'basemap' });
          const current = store.getState();
          return actions.applyStudioTemplate({ ...createSilhouetteApplication(current.document, area, snapshot.frame, snapshot.viewport), expectedDocumentEpoch: current.documentEpoch });
        } catch (error) { return mutationRejected(error instanceof Error ? error.message : 'The boundary could not be fitted.'); }
      }}
      onPhotoUpload={photoUpload} onPhotoRemove={actions.removePhotoStop} onOpenWall={() => void wallPreview.open()}
    />
    </fieldset>
    <WallPreviewDialog open={wallPreview.isOpen} onOpenChange={(isOpen) => { if (!isOpen) wallPreview.close(); }} wall={wallPreview.wall} page={page} previewUrl={wallPreview.previewUrl} error={wallPreview.error} epoch={documentEpoch}
      onChange={(value) => {
        const result = actions.setStudioSection('wall', value);
        if (!result.ok) wallPreview.setError(result.error);
        return result;
      }} />
  </>;
});
