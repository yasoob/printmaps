import type { Map as MapLibreMap } from 'maplibre-gl';

export type NativeMapOutput = Readonly<{ width: number; height: number }>;
export type NativeMapRegion = Readonly<{ x: number; y: number; width: number; height: number }>;
export type NativeTileRequest = Readonly<{
  output: NativeMapOutput;
  region: NativeMapRegion;
}>;

export type NativeTileCamera = Readonly<{
  bearing: number;
  center: [number, number];
  pitch: number;
  zoom: number;
}>;

function requirePositiveDimensions(values: readonly number[]): void {
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Native map export requires finite positive output and frame dimensions.');
  }
}

export function calculateNativeTileCamera(
  map: MapLibreMap,
  printFrame: HTMLElement,
  request: NativeTileRequest,
): NativeTileCamera {
  const canvasRect = map.getCanvas().getBoundingClientRect();
  const frameRect = printFrame.getBoundingClientRect();
  const { output, region } = request;
  requirePositiveDimensions([
    canvasRect.width,
    canvasRect.height,
    frameRect.width,
    frameRect.height,
    output.width,
    output.height,
    region.width,
    region.height,
  ]);
  if (
    region.x < 0
    || region.y < 0
    || region.x + region.width > output.width
    || region.y + region.height > output.height
  ) {
    throw new Error('Native map export tile region must remain inside the target output.');
  }

  const scaleX = output.width / frameRect.width;
  const scaleY = output.height / frameRect.height;
  if (Math.abs(scaleX - scaleY) / Math.max(scaleX, scaleY) > 0.005) {
    throw new Error('Native map export target aspect ratio must match the print frame.');
  }

  const frameLeft = frameRect.left - canvasRect.left;
  const frameTop = frameRect.top - canvasRect.top;
  const regionCenterX = region.x + region.width / 2;
  const regionCenterY = region.y + region.height / 2;
  const sourcePoint: [number, number] = [
    frameLeft + regionCenterX / output.width * frameRect.width,
    frameTop + regionCenterY / output.height * frameRect.height,
  ];
  const center = map.unproject(sourcePoint);

  return {
    bearing: map.getBearing(),
    center: [center.lng, center.lat],
    pitch: map.getPitch(),
    zoom: map.getZoom() + Math.log2((scaleX + scaleY) / 2),
  };
}
