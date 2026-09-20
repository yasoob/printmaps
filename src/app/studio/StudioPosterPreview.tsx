import { memo, useId, useMemo, type CSSProperties } from 'react';
import { deriveStudioComposition } from '../../print/studioComposition';
import type { StudioProjector } from '../../print/studioGeometry';
import type { StudioCamera, StudioCompositionDocument } from '../../print/studioLayout';
import './studioComposition.css';
import { studioPrimitiveElements } from './StudioPrimitiveSvg';
import type { StudioPrimitive } from '../../print/studioPrimitives';

export type StudioPosterPreviewProps = Readonly<{
  document: StudioCompositionDocument; projectToFrame: StudioProjector;
  camera?: StudioCamera; className?: string; style?: CSSProperties;
  referenceLongitude?: number;
}>;

export const StudioPosterPreview = memo(function StudioPosterPreview({ document, projectToFrame, camera, referenceLongitude, className = '', style }: StudioPosterPreviewProps) {
  const prefix = useId();
  const scene = useMemo(() => {
    try {
      const primitives = deriveStudioComposition(document, (coordinate) => {
        const point = projectToFrame(coordinate);
        return { x: point.x * document.page.widthMm, y: point.y * document.page.heightMm };
      }, camera, referenceLongitude);
      return { primitives, error: '' };
    } catch (error) {
      return { primitives: [] as StudioPrimitive[], error: error instanceof Error ? error.message : 'The poster composition cannot be rendered.' };
    }
  }, [document, projectToFrame, camera, referenceLongitude]);
  if (scene.error) return <div className="studio-poster-preview-error" role="alert" style={style}>{scene.error}</div>;
  const { widthMm, heightMm } = document.page;
  return <div className={`studio-poster-preview ${className}`} aria-label="Poster artwork" style={style}>
    <svg xmlns="http://www.w3.org/2000/svg" width={`${widthMm}mm`} height={`${heightMm}mm`} viewBox={`0 0 ${widthMm} ${heightMm}`}>
      <defs><clipPath id={`${prefix}-page`}><rect width={widthMm} height={heightMm} /></clipPath></defs>
      <g data-scene-role="composition" data-layer-name="Poster composition" clipPath={`url(#${prefix}-page)`}>
        <title>Poster composition</title>{studioPrimitiveElements(scene.primitives, prefix)}
      </g>
    </svg>
  </div>;
});
