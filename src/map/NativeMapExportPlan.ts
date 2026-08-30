import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';
import type { PrintTileExportPlan } from '../export/previewPng';
import {
  hasVisibleBasemapSymbolLayers,
  scaleNativeMapStyle,
  withoutBasemapSymbolLayers,
  withoutStudioContentLayers,
} from './NativeMapStyle';

export type NativePrintExportSource = Readonly<{
  isReady: () => boolean;
  map: MapLibreMap;
  resolveAssets: () => Record<string, CustomMarkerAsset>;
  resolveLayers: () => ContentLayer[];
  resolvePrintFrame: () => HTMLElement | null | undefined;
  resolveStyle?: (content: NonNullable<PrintTileExportPlan['content']>) => ReturnType<MapLibreMap['getStyle']>;
}>;

function requirePrintFrame(source: NativePrintExportSource): HTMLElement {
  if (!source.isReady()) throw new Error('The native export source map changed before rendering began.');
  const printFrame = source.resolvePrintFrame();
  if (!printFrame) throw new Error('The print frame is not ready for native export.');
  return printFrame;
}

function validatePixelDensity(plan: PrintTileExportPlan): void {
  if (!Number.isFinite(plan.pixelsPerMillimetre) || plan.pixelsPerMillimetre <= 0) {
    throw new Error('Native map export requires a finite positive print pixel density.');
  }
}

function validateMultiRegionCamera(source: NativePrintExportSource, plan: PrintTileExportPlan): void {
  if (plan.regions.length > 1 && Math.abs(source.map.getPitch()) > 0.000001) {
    throw new Error('Multi-region native export does not support map pitch. Set Pitch to 0° or reduce the page dimensions and retry.');
  }
}

function validateSymbolBuffer(
  style: ReturnType<MapLibreMap['getStyle']>,
  plan: PrintTileExportPlan,
): void {
  if (
    plan.regions.length > 1
    && plan.symbolsVisible
    && hasVisibleBasemapSymbolLayers(style)
    && (plan.symbolBufferPx ?? 0) < 128
  ) {
    throw new Error('Multi-region native export cannot place labels seamlessly. Turn off Show labels or reduce the page dimensions and retry.');
  }
}

export function prepareNativePrintExport(
  source: NativePrintExportSource,
  plan: PrintTileExportPlan,
  pixelRatio: number,
): Readonly<{
  assets: Record<string, CustomMarkerAsset>;
  layers: ContentLayer[];
  printFrame: HTMLElement;
  style: ReturnType<MapLibreMap['getStyle']>;
}> {
  const printFrame = requirePrintFrame(source);
  validatePixelDensity(plan);
  validateMultiRegionCamera(source, plan);
  const content = plan.content ?? 'composite';
  const resolvedStyle = source.resolveStyle?.(content) ?? source.map.getStyle();
  const currentStyle = content === 'basemap'
    ? withoutStudioContentLayers(resolvedStyle)
    : structuredClone(resolvedStyle);
  validateSymbolBuffer(currentStyle, plan);
  const symbolSafeStyle = plan.symbolsVisible ? currentStyle : withoutBasemapSymbolLayers(currentStyle);
  return {
    assets: plan.content === 'basemap' ? {} : structuredClone(source.resolveAssets()),
    layers: plan.content === 'basemap' ? [] : structuredClone(source.resolveLayers()),
    printFrame,
    style: scaleNativeMapStyle(
      symbolSafeStyle,
      plan.pixelsPerMillimetre * 0.3 / pixelRatio,
    ),
  };
}
