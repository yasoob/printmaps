import type { Map as MapLibreMap } from 'maplibre-gl';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';
import type { ContentLayer } from '../domain/project';
import type { PrintTileExportPlan, PrintTileRenderer } from '../export/previewPng';
import { createNativePrintTileExport } from './NativeMapExport';

export function createNativePrintTileRenderer(
  sourceMap: MapLibreMap,
  options: Readonly<{
    isSourceReady: () => boolean;
    resolveAssets: () => Record<string, CustomMarkerAsset>;
    resolveLayers: () => ContentLayer[];
    resolvePrintFrame: () => HTMLElement | null | undefined;
    resolveStyle?: (content: NonNullable<PrintTileExportPlan['content']>) => ReturnType<MapLibreMap['getStyle']>;
  }>,
): (plan: PrintTileExportPlan) => PrintTileRenderer {
  return (plan) => createNativePrintTileExport({
    isReady: options.isSourceReady,
    map: sourceMap,
    resolveAssets: options.resolveAssets,
    resolveLayers: options.resolveLayers,
    resolvePrintFrame: options.resolvePrintFrame,
    resolveStyle: options.resolveStyle,
  }, plan);
}
