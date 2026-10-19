import type { ProjectDocument } from '../domain/project';
import { hasStudioComposition } from '../print/studioComposition';
import type { StudioProjector } from '../print/studioGeometry';
import type { PreviewPngExporter, PrintTileExportPlan, PrintTileRenderer } from './previewPng';
import { prepareStudioComposition } from './studioComposition';

const unusedProjection: StudioProjector = () => {
  throw new Error('The map projection is not ready for poster export.');
};

/**
Wraps the native tile renderer so every tile carries the poster composition and the shared map credit.
*/
export async function prepareStudioPrintRenderer(document: ProjectDocument, exporter: PreviewPngExporter, plan: PrintTileExportPlan): Promise<{
  renderTile: PrintTileRenderer; isAttributionIncluded: boolean; dispose: () => void;
}> {
  if (!exporter.createPrintTileRenderer) throw new Error('Wait for the map to load before exporting a poster.');
  let project = unusedProjection;
  let referenceLongitude: number | undefined;
  if (hasStudioComposition(document)) {
    const capture = await exporter({ content: 'basemap', signal: plan.signal });
    capture.surface.width = 0; capture.surface.height = 0;
    if (!capture.projectToFrame) throw new Error('The map projection is not ready for poster export.');
    project = capture.projectToFrame;
    referenceLongitude = capture.referenceLongitude;
  }
  const native = exporter.createPrintTileRenderer(plan);
  const composition = prepareStudioComposition(document);
  return {
    isAttributionIncluded: true,
    async renderTile(request) {
      const canvas = await native(request);
      try {
        await composition.draw(canvas, project, { signal: request.signal, output: request.output, region: request.region, includeAttribution: true, referenceLongitude });
        return canvas;
      } catch (error) {
        canvas.width = 0; canvas.height = 0;
        throw error;
      }
    },
    dispose: () => composition.dispose(),
  };
}
