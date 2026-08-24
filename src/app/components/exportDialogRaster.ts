import type { ProjectDocument } from '../../domain/project';
import type { planExportPreflight } from '../../export/preflight';
import type { PrintTileExportPlan } from '../../export/previewPng';

export function createPrintTileExportPlan(
  output: PrintTileExportPlan['output'],
  document: ProjectDocument,
  tiles: NonNullable<ReturnType<typeof planExportPreflight>['plan']>['tiles'],
  signal: AbortSignal,
): PrintTileExportPlan {
  const pixelsPerMillimetre = (output.width / document.page.widthMm
    + output.height / document.page.heightMm) / 2;
  return {
    output,
    pixelsPerMillimetre,
    regions: tiles.map((tile) => ({
      x: tile.renderX,
      y: tile.renderY,
      width: tile.renderWidth,
      height: tile.renderHeight,
    })),
    signal,
    symbolsVisible: document.style.visibility.labels,
  };
}
