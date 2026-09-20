import { memo, useCallback, useMemo, useState, type ComponentProps } from 'react';
import { MapCanvas } from '../../map/MapCanvas';
import type { MapFrameProjection } from '../../map/MapFrameProjection';
import { hasStudioComposition } from '../../print/studioComposition';
import type { StudioCompositionDocument } from '../../print/studioLayout';
import { StudioPosterPreview } from './StudioPosterPreview';

export type StudioCompositionContent = Omit<StudioCompositionDocument, 'camera'>;
export type StudioMapCanvasProps = ComponentProps<typeof MapCanvas> & {
  composition?: StudioCompositionContent;
};
const StableMapCanvas = memo(MapCanvas);

export const StudioMapCanvas = memo(function StudioMapCanvas({ composition, ...mapProps }: StudioMapCanvasProps) {
  const [projection, setProjection] = useState<MapFrameProjection | null>(null);
  const { camera, onFrameProjectionChange } = mapProps;
  const document = useMemo(
    () => composition && camera ? { ...composition, camera } : null,
    [camera, composition],
  );
  const isComposed = document !== null && hasStudioComposition(document);
  const receiveProjection = useCallback((value: MapFrameProjection | null) => {
    setProjection(value);
    onFrameProjectionChange?.(value);
  }, [onFrameProjectionChange]);
  return <>
    <StableMapCanvas {...mapProps}
      onFrameProjectionChange={isComposed ? receiveProjection : onFrameProjectionChange} />
    {isComposed && projection && <StudioPosterPreview document={document}
      projectToFrame={projection.projectToFrame} camera={projection.camera}
      style={{ inset: 'auto', left: projection.frame.x, top: projection.frame.y,
        width: projection.frame.width, height: projection.frame.height }} />}
  </>;
});
