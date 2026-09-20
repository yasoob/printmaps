import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { ProjectDocument } from '../domain/project';
import { MapCanvas } from '../map/MapCanvas';
import type { MapFrameProjection } from '../map/MapFrameProjection';
import { StudioPosterPreview } from '../app/studio/StudioPosterPreview';
import { hasStudioComposition } from '../print/studioComposition';

type ProjectionReceiver = ((projection: MapFrameProjection | null) => void) | null;
const ignoreSelection = () => {};

function SharedCompositionOverlay({ document, receiverRef }: {
  document: ProjectDocument;
  receiverRef: RefObject<ProjectionReceiver>;
}) {
  const [projection, setProjection] = useState<MapFrameProjection | null>(null);
  useLayoutEffect(() => {
    receiverRef.current = setProjection;
    return () => { receiverRef.current = null; };
  }, [receiverRef]);
  if (!projection) return <p className="shared-artwork-status" role="status">Preparing shared artwork…</p>;
  return <StudioPosterPreview document={document} camera={projection.camera} projectToFrame={projection.projectToFrame}
    style={{
      left: projection.frame.x, top: projection.frame.y,
      width: projection.frame.width, height: projection.frame.height,
    }} />;
}

export const SharedMapPreview = memo(function SharedMapPreview({ document, canNavigate }: {
  document: ProjectDocument;
  canNavigate: boolean;
}) {
  const receiverRef = useRef<ProjectionReceiver>(null);
  const onProjection = useCallback((projection: MapFrameProjection | null) => {
    receiverRef.current?.(projection);
  }, []);
  const camera = useMemo(() => ({ ...document.camera, locked: !canNavigate }), [document.camera, canNavigate]);
  const getCanonicalCamera = useCallback(() => document.camera, [document.camera]);
  const hasComposition = hasStudioComposition(document);
  return <section className="shared-map canvas-region" aria-label="Read-only map preview">
    <MapCanvas
      assets={document.assets}
      layers={document.layers}
      camera={camera}
      getCanonicalCamera={getCanonicalCamera}
      stylePreset={document.style.preset}
      styleCustomization={document.style.customization}
      language={document.style.language}
      textScalePercent={document.style.textScalePercent}
      featureVisibility={document.style.visibility}
      terrain={document.studio.terrain}
      basemapVisible={document.layers.find((layer) => layer.type === 'basemap')?.visible ?? true}
      page={document.page}
      orientation={document.page.orientation}
      selectedId={null}
      previewedId={null}
      onLayerSelect={ignoreSelection}
      onBackgroundClick={ignoreSelection}
      interactionMode="readonly"
      onFrameProjectionChange={hasComposition ? onProjection : undefined}
    />
    {hasComposition && <SharedCompositionOverlay document={document} receiverRef={receiverRef} />}
  </section>;
});
