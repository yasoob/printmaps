import { memo, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { createDefaultLayerAppearance, type ContentLayer } from '../../domain/project';
import { mutationRejected } from '../../domain/projectMutation';
import { validatePhotoFile } from '../../domain/studioPhotoAssets';
import { createSilhouetteApplication } from '../../domain/studioSilhouette';
import type { PreviewPngExporter } from '../../export/previewPng';
import { useProject, useProjectActions, useProjectStoreApi } from '../projectStoreContext';
import { StudioCompositionPanel, type StudioCompositionPanelProps } from './StudioCompositionPanel';
import type { PhotoUpload } from './PhotoStoryControls';
import { useReadMapExporter } from '../mapExporterContext';
import { currentLayoutApplication } from './templateProjects';
import { PageProperties } from './PageProperties';
import { editablePoster } from './posterEditing';

function usePhotoUpload(): PhotoUpload {
  const store = useProjectStoreApi();
  return useCallback(async (file, layerId, expectedDocumentEpoch) => {
    const current = store.getState();
    const center: [number, number] = [...current.document.camera.center];
    const asset = await validatePhotoFile(file);
    const id = `photo-${crypto.randomUUID()}`;
    const poi: ContentLayer | undefined = layerId ? undefined : {
      id: `photo-point-${crypto.randomUUID()}`, name: file.name.replace(/\.[^.]+$/, '').slice(0, 200) || 'Photo stop',
      type: 'poi', visible: true, locked: false, opacity: 100,
      geometry: { type: 'Point', coordinates: center }, appearance: createDefaultLayerAppearance('poi'),
    };
    const result = store.getState().addPhotoStop({
      asset, expectedDocumentEpoch, presentation: 'map',
      stop: { id, layerId: layerId ?? poi!.id, assetId: asset.id, caption: '' },
      ...(poi && { poi }),
    });
    if (poi && result.ok) store.getState().selectLayer(null);
    return result;
  }, [store]);
}

export const StudioCompositionControls = memo(function StudioCompositionControls({ exporter, blockedReason }: {
  exporter?: PreviewPngExporter | null; blockedReason?: string;
}) {
  const readExporter = useReadMapExporter(exporter);
  const store = useProjectStoreApi(), actions = useProjectActions();
  const poster = useProject((state) => state.document.studio.poster);
  const effectivePoster = useMemo(() => editablePoster(poster), [poster]);
  const photos = useProject((state) => state.document.studio.photos);
  const decorations = useProject((state) => state.document.studio.decorations);
  const silhouette = useProject((state) => state.document.layers.find(({ id }) => id === state.document.studio.poster.silhouetteLayerId) ?? null);
  const pointNames = useProject(useShallow((state) => Object.fromEntries(
    state.document.layers.filter((layer) => layer.type === 'poi' && layer.geometry?.type === 'Point')
      .map((layer) => [layer.id, layer.name]),
  )));
  const documentEpoch = useProject((state) => state.documentEpoch);
  const cameraLocked = useProject((state) => state.document.camera.locked);
  const isFlat = useProject((state) => state.document.camera.pitch === 0 && !state.document.studio.terrain.enabled);
  const pointLayers = useMemo(() => Object.entries(pointNames).map(([id, name]) => ({ id, name })), [pointNames]);
  const photoUpload = usePhotoUpload();
  const { setStudioSection, applyStudioTemplate, selectLayer, toggleLayerVisibility } = actions;
  const onPosterChange = useCallback<StudioCompositionPanelProps['onPosterChange']>((value) => setStudioSection('poster', { ...value, enabled: true }), [setStudioSection]);
  const onPhotosChange = useCallback<StudioCompositionPanelProps['onPhotosChange']>((value) => setStudioSection('photos', value), [setStudioSection]);
  const onDecorationsChange = useCallback<StudioCompositionPanelProps['onDecorationsChange']>((value) => setStudioSection('decorations', value), [setStudioSection]);
  const onApplyTemplate = useCallback<StudioCompositionPanelProps['onApplyTemplate']>((id) => {
    if (blockedReason) return mutationRejected(blockedReason);
    try { return applyStudioTemplate(currentLayoutApplication(store.getState().document, id)); }
    catch (error) { return mutationRejected(error instanceof Error ? error.message : 'The layout could not be applied.'); }
  }, [applyStudioTemplate, blockedReason, store]);
  const onCreateSilhouette = useCallback<StudioCompositionPanelProps['onCreateSilhouette']>((area) => {
    if (blockedReason) return mutationRejected(blockedReason);
    const exporter = readExporter();
    if (!exporter?.captureRenderSnapshot) return mutationRejected('Wait for the map to finish loading before fitting a boundary.');
    try {
      const snapshot = exporter.captureRenderSnapshot({ content: 'basemap' });
      const current = store.getState();
      const result = applyStudioTemplate({ ...createSilhouetteApplication(current.document, area, snapshot.frame, { ...snapshot.viewport, preserveLayout: true }), expectedDocumentEpoch: current.documentEpoch });
      if (result.ok) selectLayer(null);
      return result;
    } catch (error) { return mutationRejected(error instanceof Error ? error.message : 'The boundary could not be fitted.'); }
  }, [applyStudioTemplate, blockedReason, readExporter, selectLayer, store]);
  const onRectangle = useCallback(() => {
    if (blockedReason) return mutationRejected(blockedReason);
    const current = store.getState().document;
    const mask = current.layers.find(({ id }) => id === current.studio.poster.silhouetteLayerId);
    return mask?.visible ? toggleLayerVisibility(mask.id) : { ok: true as const };
  }, [blockedReason, store, toggleLayerVisibility]);
  return <>
    {blockedReason && <p className="inspector-notice" role="status">{blockedReason}</p>}
      <StudioCompositionPanel key={documentEpoch} poster={effectivePoster} photos={photos} decorations={decorations} pointLayers={pointLayers}
        documentEpoch={documentEpoch} cameraLocked={cameraLocked} isFlat={isFlat}
        silhouetteName={silhouette?.visible ? silhouette.name : null} isDisabled={Boolean(blockedReason)}
        pageControls={<PageProperties isAppearanceDisabled={Boolean(blockedReason)} />}
        onPosterChange={onPosterChange} onPhotosChange={onPhotosChange} onDecorationsChange={onDecorationsChange}
        onApplyTemplate={onApplyTemplate} onCreateSilhouette={onCreateSilhouette} onRectangle={onRectangle}
        onPhotoUpload={photoUpload} onPhotoRemove={actions.removePhotoStop}
      />
  </>;
});
