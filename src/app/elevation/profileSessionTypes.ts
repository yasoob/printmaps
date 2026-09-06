import type { ElevationProfile } from '../../elevation/profile';
import type { ElevationProfileFontFamily, ElevationProfileUnits } from '../../export/elevationProfile';

export type ProfilePosition = readonly [number, number];
export type ProfileLoader = (coordinates: readonly ProfilePosition[], options: { signal: AbortSignal }) => Promise<ElevationProfile>;
export type LocalProfileRoute = Readonly<{ coordinates: readonly ProfilePosition[]; filename: string; name: string }>;
export type ProfileRouteBinding = Readonly<{
  coordinates: readonly ProfilePosition[] | null;
  kind: string;
  name: string;
  color: string;
}>;
export type ProfileSettings = {
  units: ElevationProfileUnits;
  customCurveColor: string | null;
  fillColor: string;
  gradientColor: string;
  markerColor: string;
  fontFamily: ElevationProfileFontFamily;
  fontSize: number;
  fontSizeDraft: string;
  printWidthMm: number;
  printWidthDraft: string;
  showCurve: boolean;
  showElevationMarkers: boolean;
  showFill: boolean;
  showGradient: boolean;
  showHorizontalGrid: boolean;
  showVerticalGrid: boolean;
};
export type ProfileChartOptions = Omit<ProfileSettings, 'customCurveColor' | 'fontSizeDraft' | 'printWidthDraft'> & { curveColor: string };
export type ProfileSessionState = Readonly<{
  route: ProfileRouteBinding;
  localRoute: LocalProfileRoute | null;
  settings: Readonly<ProfileSettings>;
  profile: ElevationProfile | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  message?: string;
  readingFilename: string | null;
  fileError: string | null;
  exporting: boolean;
  exportError: string | null;
  notice: string | null;
}>;

export function createProfileSettings(): ProfileSettings {
  return {
    units: 'metric', customCurveColor: null, fillColor: '#dceeff', gradientColor: '#ffffff',
    markerColor: '#7c3aed', fontFamily: 'sans', fontSize: 40, fontSizeDraft: '40',
    printWidthMm: 150, printWidthDraft: '150', showCurve: true, showElevationMarkers: true,
    showFill: true, showGradient: false, showHorizontalGrid: true, showVerticalGrid: true,
  };
}

export function profileChartOptions(state: ProfileSessionState): ProfileChartOptions {
  const s = state.settings;
  return {
    printWidthMm: s.printWidthMm, units: s.units, curveColor: s.customCurveColor ?? state.route.color,
    fillColor: s.fillColor, gradientColor: s.gradientColor, markerColor: s.markerColor,
    fontFamily: s.fontFamily, fontSize: s.fontSize, showCurve: s.showCurve,
    showElevationMarkers: s.showElevationMarkers, showFill: s.showFill, showGradient: s.showGradient,
    showHorizontalGrid: s.showHorizontalGrid, showVerticalGrid: s.showVerticalGrid,
  };
}

export function isProfileInteger(value: string, minimum: number, maximum: number) {
  const parsed = Number(value);
  return value.trim() !== '' && Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum;
}

export function profileError(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
