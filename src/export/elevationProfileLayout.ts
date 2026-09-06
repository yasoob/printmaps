import type { ElevationProfile } from '../elevation/profile';

const SVG_WIDTH = 900;
const SVG_HEIGHT = 450;
const MINIMUM_TERRAIN_ELEVATION_METERS = -12_000;
const MAXIMUM_TERRAIN_ELEVATION_METERS = 10_000;
const FEET_PER_METER = 3.280839895;
const MILES_PER_METER = 0.000621371192;

export type ElevationProfileUnits = 'metric' | 'imperial';
export type ElevationProfileFontFamily = 'sans' | 'serif' | 'mono';

export type ElevationProfileSummary = Readonly<{
  distance: string;
  elevationRange: string;
  ascent: string;
  descent: string;
}>;

export type ElevationProfileRenderOptions = Readonly<{
  printWidthMm?: number;
  units?: ElevationProfileUnits;
  curveColor?: string;
  fillColor?: string;
  gradientColor?: string;
  fontFamily?: ElevationProfileFontFamily;
  fontSize?: number;
  markerColor?: string;
  showCurve?: boolean;
  showElevationMarkers?: boolean;
  showFill?: boolean;
  showGradient?: boolean;
  showHorizontalGrid?: boolean;
  showVerticalGrid?: boolean;
}>;

export type ResolvedElevationProfileRenderOptions = Readonly<{
  printWidthMm: number;
  units: ElevationProfileUnits;
  curveColor: string;
  fillColor: string;
  gradientColor: string;
  fontFamily: ElevationProfileFontFamily;
  fontSize: number;
  markerColor: string;
  showCurve: boolean;
  showElevationMarkers: boolean;
  showFill: boolean;
  showGradient: boolean;
  showHorizontalGrid: boolean;
  showVerticalGrid: boolean;
}>;

function resolveColor(value: string | undefined, fallback: string, label: string): string {
  const color = value ?? fallback;
  if (!/^#[\da-f]{6}$/i.test(color)) {
    throw new Error(`The elevation profile ${label} color must be a six-digit hexadecimal color.`);
  }
  return color.toLowerCase();
}

function resolveFontSize(fontSize = 40): number {
  if (!Number.isSafeInteger(fontSize) || fontSize < 20 || fontSize > 70) {
    throw new Error('The elevation profile font size must be an integer between 20 and 70.');
  }
  return fontSize;
}

export function elevationProfileFontStack(fontFamily: ElevationProfileFontFamily): string {
  if (fontFamily === 'serif') return 'Georgia,Times New Roman,serif';
  if (fontFamily === 'mono') return 'ui-monospace,SFMono-Regular,Menlo,monospace';
  return 'Inter,Arial,sans-serif';
}

function resolveFontFamily(fontFamily: ElevationProfileFontFamily = 'sans'): ElevationProfileFontFamily {
  if (!['sans', 'serif', 'mono'].includes(fontFamily)) {
    throw new Error('Choose a supported elevation profile font.');
  }
  return fontFamily;
}

function resolvePrintWidth(printWidthMm = 150): number {
  if (!Number.isSafeInteger(printWidthMm) || printWidthMm < 50 || printWidthMm > 300) {
    throw new Error('The elevation profile print width must be an integer between 50 and 300 millimetres.');
  }
  return printWidthMm;
}

export function resolveElevationProfileRenderOptions(options: ElevationProfileRenderOptions): ResolvedElevationProfileRenderOptions {
  return {
    printWidthMm: resolvePrintWidth(options.printWidthMm),
    units: options.units ?? 'metric',
    curveColor: resolveColor(options.curveColor, '#0d79c7', 'curve'),
    fillColor: resolveColor(options.fillColor, '#dceeff', 'fill'),
    gradientColor: resolveColor(options.gradientColor, '#ffffff', 'gradient'),
    fontFamily: resolveFontFamily(options.fontFamily),
    fontSize: resolveFontSize(options.fontSize),
    markerColor: resolveColor(options.markerColor, '#7c3aed', 'marker'),
    showCurve: options.showCurve ?? true,
    showElevationMarkers: options.showElevationMarkers ?? true,
    showFill: options.showFill ?? true,
    showGradient: options.showGradient ?? false,
    showHorizontalGrid: options.showHorizontalGrid ?? true,
    showVerticalGrid: options.showVerticalGrid ?? true,
  };
}

export function formatElevationProfileSummary(
  profile: ElevationProfile,
  units: ElevationProfileUnits,
): ElevationProfileSummary {
  if (units === 'imperial') {
    return {
      distance: `${(profile.totalDistanceMeters * MILES_PER_METER).toFixed(1)} mi`,
      elevationRange: `${Math.round(profile.minimumElevationMeters * FEET_PER_METER)}–${Math.round(profile.maximumElevationMeters * FEET_PER_METER)} ft`,
      ascent: `${Math.round(profile.totalAscentMeters * FEET_PER_METER)} ft`,
      descent: `${Math.round(profile.totalDescentMeters * FEET_PER_METER)} ft`,
    };
  }
  return {
    distance: `${(profile.totalDistanceMeters / 1000).toFixed(1)} km`,
    elevationRange: `${Math.round(profile.minimumElevationMeters)}–${Math.round(profile.maximumElevationMeters)} m`,
    ascent: `${Math.round(profile.totalAscentMeters)} m`,
    descent: `${Math.round(profile.totalDescentMeters)} m`,
  };
}

export type ElevationChartPoint = Readonly<{ x: number; y: number }>;
export type ElevationProfileMarker = Readonly<{
  index: number;
  label: string;
  point: ElevationChartPoint;
}>;
export type ElevationProfileLayout = Readonly<{
  width: number;
  height: number;
  plot: Readonly<{ left: number; top: number; width: number; height: number }>;
  points: readonly ElevationChartPoint[];
  distanceTicks: readonly Readonly<{ x: number; label: string }>[];
  elevationTicks: readonly Readonly<{ y: number; label: string }>[];
}>;

export function formatElevationProfileNumber(value: number): string {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function validateProfile(profile: ElevationProfile): void {
  const summaryValues = [
    profile.totalDistanceMeters,
    profile.minimumElevationMeters,
    profile.maximumElevationMeters,
    profile.totalAscentMeters,
    profile.totalDescentMeters,
  ];
  if (
    profile.samples.length < 2
    || summaryValues.some((value) => !Number.isFinite(value))
    || profile.totalDistanceMeters <= 0
    || profile.minimumElevationMeters < MINIMUM_TERRAIN_ELEVATION_METERS
    || profile.maximumElevationMeters > MAXIMUM_TERRAIN_ELEVATION_METERS
    || profile.minimumElevationMeters > profile.maximumElevationMeters
    || profile.totalAscentMeters < 0
    || profile.totalDescentMeters < 0
    || profile.samples.some((sample) => (
      !Number.isFinite(sample.distanceMeters)
      || !Number.isFinite(sample.elevationMeters)
      || sample.distanceMeters < 0
      || sample.distanceMeters > profile.totalDistanceMeters
      || sample.elevationMeters < MINIMUM_TERRAIN_ELEVATION_METERS
      || sample.elevationMeters > MAXIMUM_TERRAIN_ELEVATION_METERS
    ))
  ) {
    throw new Error('The elevation profile does not contain valid route measurements.');
  }
}

export function createElevationProfileLayout(
  profile: ElevationProfile,
  width = SVG_WIDTH,
  height = SVG_HEIGHT,
  options: ElevationProfileRenderOptions & Readonly<{ plotBounds?: ElevationProfileLayout['plot'] }> = {},
): ElevationProfileLayout {
  validateProfile(profile);
  const units = options.units ?? 'metric';
  const plot = options.plotBounds ?? {
    left: width * 0.09,
    top: height * 0.16,
    width: width * 0.85,
    height: height * 0.65,
  };
  const measuredRange = profile.maximumElevationMeters - profile.minimumElevationMeters;
  const padding = Math.max(10, measuredRange * 0.1);
  const minimum = profile.minimumElevationMeters - padding;
  const maximum = profile.maximumElevationMeters + padding;
  const range = maximum - minimum;
  const points = profile.samples.map((sample) => ({
    x: plot.left + sample.distanceMeters / profile.totalDistanceMeters * plot.width,
    y: plot.top + (maximum - sample.elevationMeters) / range * plot.height,
  }));
  if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error('The elevation profile does not contain valid route measurements.');
  }
  const distanceTicks = Array.from({ length: 5 }, (_, index) => ({
    x: plot.left + index / 4 * plot.width,
    label: units === 'imperial'
      ? `${(profile.totalDistanceMeters * MILES_PER_METER * index / 4).toFixed(1)} mi`
      : `${(profile.totalDistanceMeters / 1000 * index / 4).toFixed(1)} km`,
  }));
  const elevationTicks = Array.from({ length: 5 }, (_, index) => {
    const value = maximum - index / 4 * range;
    return {
      y: plot.top + index / 4 * plot.height,
      label: units === 'imperial'
        ? `${Math.round(value * FEET_PER_METER)} ft`
        : `${Math.round(value)} m`,
    };
  });
  return { width, height, plot, points, distanceTicks, elevationTicks };
}

export function createElevationProfileMarkers(
  profile: ElevationProfile,
  layout: ElevationProfileLayout,
  units: ElevationProfileUnits,
): readonly ElevationProfileMarker[] {
  const minimumIndex = profile.samples.findIndex((sample) => sample.elevationMeters === profile.minimumElevationMeters);
  const maximumIndex = profile.samples.findIndex((sample) => sample.elevationMeters === profile.maximumElevationMeters);
  const markers: ElevationProfileMarker[] = [];
  const markerIndices = new Set([minimumIndex, maximumIndex]);
  for (const index of markerIndices) {
    if (index < 0) continue;
    markers.push({
      index,
      point: layout.points[index],
      label: units === 'imperial'
        ? `${Math.round(profile.samples[index].elevationMeters * FEET_PER_METER)} ft`
        : `${Math.round(profile.samples[index].elevationMeters)} m`,
    });
  }
  return markers;
}

export function elevationProfileMarkerLabelY(pointY: number, fontSize: number, plotTop: number, gap: number): number {
  const aboveBaseline = pointY - gap;
  return aboveBaseline - fontSize < plotTop
    ? pointY + fontSize + gap
    : aboveBaseline;
}

export function elevationProfileMarkerTextAnchor({
  pointX,
  label,
  fontSize,
  plot,
}: Readonly<{
  pointX: number;
  label: string;
  fontSize: number;
  plot: Readonly<{ left: number; width: number }>;
}>): 'start' | 'middle' | 'end' {
  const estimatedHalfWidth = label.length * fontSize * 0.3;
  if (pointX - estimatedHalfWidth < plot.left) return 'start';
  if (pointX + estimatedHalfWidth > plot.left + plot.width) return 'end';
  return 'middle';
}
