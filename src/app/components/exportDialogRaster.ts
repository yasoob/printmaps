import type { ProjectDocument } from '../../domain/project';
import type { PrintTileExportPlan } from '../../export/previewPng';

export const NATIVE_SYMBOL_BUFFER_PX = 256;

type Options = Readonly<{
  content?: NonNullable<PrintTileExportPlan['content']>;
  document: ProjectDocument;
  output: PrintTileExportPlan['output'];
  regions: PrintTileExportPlan['regions'];
  signal: AbortSignal;
  symbolBufferPx?: number;
}>;

export function createPrintRegionExportPlan(options: Options): PrintTileExportPlan {
  const { content = 'composite', document, output, regions, signal, symbolBufferPx = 0 } = options;
  const pixelsPerMillimetre = (output.width / document.page.widthMm
    + output.height / document.page.heightMm) / 2;
  return {
    content,
    output,
    pixelsPerMillimetre,
    regions,
    signal,
    symbolBufferPx,
    symbolsVisible: document.style.visibility.labels,
  };
}
