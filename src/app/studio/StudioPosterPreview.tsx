import { memo, useMemo, type CSSProperties } from 'react';
import { serializeStudioOverlaySvg } from '../../print/studioComposition';
import type { StudioProjector } from '../../print/studioGeometry';
import type { StudioCamera, StudioCompositionDocument } from '../../print/studioLayout';
import './studioComposition.css';

export type StudioPosterPreviewProps = Readonly<{
  document: StudioCompositionDocument; projectToFrame: StudioProjector;
  camera?: StudioCamera; className?: string; style?: CSSProperties;
  referenceLongitude?: number;
}>;

export const StudioPosterPreview = memo(function StudioPosterPreview({ document, projectToFrame, camera, referenceLongitude, className = '', style }: StudioPosterPreviewProps) {
  const scene = useMemo(() => {
    try {
      const svg = serializeStudioOverlaySvg(document, (coordinate) => {
        const point = projectToFrame(coordinate);
        return { x: point.x * document.page.widthMm, y: point.y * document.page.heightMm };
      }, camera, referenceLongitude);
      return { svg, error: '' };
    } catch (error) {
      return { svg: '', error: error instanceof Error ? error.message : 'The poster composition cannot be rendered.' };
    }
  }, [document, projectToFrame, camera, referenceLongitude]);
  if (scene.error) return <div className="studio-poster-preview-error" role="alert" style={style}>{scene.error}</div>;
  return <div className={`studio-poster-preview ${className}`} aria-label="Poster artwork" style={style} dangerouslySetInnerHTML={{ __html: scene.svg }} />;
});
