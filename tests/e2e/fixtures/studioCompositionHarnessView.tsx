import { useProject } from '../../../src/app/projectStoreContext';
import { StudioCompositionControls } from '../../../src/app/studio/StudioCompositionControls';
import { StudioPosterPreview } from '../../../src/app/studio/StudioPosterPreview';
import type { PreviewPngExporter } from '../../../src/export/previewPng';
import type { StudioProjector } from '../../../src/print/studioGeometry';

export function StudioCompositionHarnessView({ exporter, project }: { exporter: PreviewPngExporter; project: StudioProjector }) {
  const document = useProject((state) => state.document);
  return <main style={{ display: 'flex', flexWrap: 'wrap', gap: 20, padding: 12, alignItems: 'start' }}>
    <div style={{ width: 320, maxWidth: '100%' }}><StudioCompositionControls exporter={exporter} /></div>
    <div data-testid="poster-frame" style={{ width: 'min(594px, 95vw)', aspectRatio: '297 / 210', background: '#ccd9d3', position: 'relative' }}>
      <StudioPosterPreview document={document} projectToFrame={project} />
    </div>
  </main>;
}
