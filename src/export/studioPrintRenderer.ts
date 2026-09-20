import type { ProjectDocument } from '../domain/project';
import { hasStudioComposition } from '../print/studioComposition';
import type { PreviewPngExporter, PrintTileExportPlan, PrintTileRenderer } from './previewPng';
import { prepareStudioComposition } from './studioComposition';

export async function prepareStudioPrintRenderer(document: ProjectDocument, exporter: PreviewPngExporter, plan: PrintTileExportPlan): Promise<{
  renderTile: PrintTileRenderer; isAttributionIncluded: boolean; dispose: () => void;
}> {
  if (!exporter.createPrintTileRenderer) throw new Error('Wait for the map to load before exporting a poster.');
  if (!hasStudioComposition(document)) {
    return { renderTile: exporter.createPrintTileRenderer(plan), isAttributionIncluded: false, dispose: () => {} };
  }
  const capture = await exporter({ content: 'basemap', signal: plan.signal });
  const project = capture.projectToFrame;
  capture.surface.width = 0; capture.surface.height = 0;
  if (!project) throw new Error('The map projection is not ready for poster export.');
  const native = exporter.createPrintTileRenderer(plan);
  const composition = prepareStudioComposition(document);
  return {
    isAttributionIncluded: true,
    async renderTile(request) {
      const canvas = await native(request);
      try {
        await composition.draw(canvas, project, { signal: request.signal, output: request.output, region: request.region, includeAttribution: true });
        return canvas;
      } catch (error) {
        canvas.width = 0; canvas.height = 0;
        throw error;
      }
    },
    dispose: () => composition.dispose(),
  };
}
