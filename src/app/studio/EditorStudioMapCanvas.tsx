import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProject } from '../projectStoreContext';
import { StudioMapCanvas, type StudioMapCanvasProps } from './StudioMapCanvas';

export const EditorStudioMapCanvas = memo(function EditorStudioMapCanvas(props: StudioMapCanvasProps) {
  const poster = useProject((state) => state.document.studio.poster);
  const photos = useProject((state) => state.document.studio.photos);
  const decorations = useProject((state) => state.document.studio.decorations);
  const enabled = useProject((state) => state.document.studio.terrain.enabled);
  const contours = useProject((state) => state.document.studio.terrain.contours.enabled);
  const page = useProject((state) => state.document.page);
  const layers = useProject(useShallow((state) => {
    const ids = new Set([
      ...(poster.enabled && poster.silhouetteLayerId ? [poster.silhouetteLayerId] : []),
      ...(photos.map.enabled || photos.strip.enabled ? photos.stops.map((stop) => stop.layerId) : []),
      ...(decorations.qr.enabled && decorations.qr.layerId ? [decorations.qr.layerId] : []),
    ]);
    return state.document.layers.filter((layer) => ids.has(layer.id));
  }));
  const composition = useMemo(() => ({
    page, layers, studio: { poster, photos, decorations, terrain: { enabled, contours: { enabled: contours } } },
  }), [page, layers, poster, photos, decorations, enabled, contours]);
  return <StudioMapCanvas {...props} composition={composition} />;
});
