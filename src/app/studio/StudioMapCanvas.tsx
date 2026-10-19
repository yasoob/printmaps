import { memo, useCallback, useMemo, useState, type ComponentProps } from 'react';
import { MapCanvas } from '../../map/MapCanvas';
import type { MapFrameProjection } from '../../map/MapFrameProjection';
import { hasStudioComposition } from '../../print/studioComposition';
import type { StudioCompositionDocument } from '../../print/studioLayout';
import { StudioCreditPreview, StudioPosterPreview } from './StudioPosterPreview';

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
  // Without poster artwork the credit strip does not follow the camera, so it lives in the print frame.
  const creditPreview = useMemo(
    () => composition && !isComposed ? <StudioCreditPreview document={composition} /> : undefined,
    [composition, isComposed],
  );
  const frameStyle = useMemo(() => projection ? {
    inset: 'auto', left: projection.frame.x, top: projection.frame.y,
    width: projection.frame.width, height: projection.frame.height,
  } : undefined, [projection]);
  const receiveProjection = useCallback((value: MapFrameProjection | null) => {
    setProjection(value);
    onFrameProjectionChange?.(value);
  }, [onFrameProjectionChange]);
  return <>
    <StableMapCanvas {...mapProps} printFrameContent={creditPreview}
      onFrameProjectionChange={isComposed ? receiveProjection : onFrameProjectionChange} />
    {isComposed && projection && <StudioPosterPreview document={document} showCredit
      projectToFrame={projection.projectToFrame} camera={projection.camera} referenceLongitude={projection.referenceLongitude}
      style={frameStyle} />}
  </>;
});
