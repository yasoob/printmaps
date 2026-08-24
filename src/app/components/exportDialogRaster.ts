import type { ProjectDocument } from '../../domain/project';
import type { PrintTileExportPlan } from '../../export/previewPng';

export function createPrintRegionExportPlan(
  output: PrintTileExportPlan['output'],
  document: ProjectDocument,
  regions: PrintTileExportPlan['regions'],
  signal: AbortSignal,
): PrintTileExportPlan {
  const pixelsPerMillimetre = (output.width / document.page.widthMm
    + output.height / document.page.heightMm) / 2;
  return {
    output,
    pixelsPerMillimetre,
    regions,
    signal,
    symbolsVisible: document.style.visibility.labels,
  };
}
