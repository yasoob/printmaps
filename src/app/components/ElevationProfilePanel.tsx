import { ArrowDown, ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  ELEVATION_SOURCE_LABEL,
  loadElevationProfile,
  type ElevationProfile,
} from '../../elevation/profile';
import {
  createElevationProfileLayout,
  createElevationProfileMarkers,
  createElevationProfilePng,
  elevationProfileFontStack,
  elevationProfileMarkerTextAnchor,
  formatElevationProfileSummary,
  serializeElevationProfileSvg,
  type ElevationProfileFontFamily,
  type ElevationProfileUnits,
} from '../../export/elevationProfile';
import { ElevationProfileRequestControls } from './ElevationProfileRequestControls';
import { ProfileRouteSource, type LocalProfileRoute } from './ProfileRouteSource';
import { Checkbox } from './UiControls';
import { InputGroup, InputGroupAddon, InputNumber } from './InputGroup';

type Position = readonly [number, number];
type ProfileLoader = (
  coordinates: readonly Position[],
  options: { signal: AbortSignal },
) => Promise<ElevationProfile>;

type ElevationProfilePanelProps = Readonly<{
  coordinates: readonly Position[];
  routeName: string;
  routeColor?: string;
  loadProfile?: ProfileLoader;
}>;

type PanelState =
  | Readonly<{ status: 'idle' | 'loading'; profile?: undefined; message?: undefined }>
  | Readonly<{ status: 'ready'; profile: ElevationProfile; message?: undefined }>
  | Readonly<{ status: 'error'; profile?: undefined; message: string }>;

function filenameBase(value: string): string {
  return value
    .replaceAll(/[^a-z0-9._-]+/gi, '-')
    .replaceAll(/^[-.]+|[-.]+$/g, '') || 'route';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

type ProfileChartOptions = Readonly<{
  printWidthMm: number;
  units: ElevationProfileUnits;
  curveColor: string;
  fillColor: string;
  gradientColor: string;
  markerColor: string;
  fontFamily: ElevationProfileFontFamily;
  fontSize: number;
  showCurve: boolean;
  showElevationMarkers: boolean;
  showFill: boolean;
  showGradient: boolean;
  showHorizontalGrid: boolean;
  showVerticalGrid: boolean;
}>;

function ProfileChart({ profile, routeName, options }: {
  profile: ElevationProfile;
  routeName: string;
  options: ProfileChartOptions;
}) {
  const { printWidthMm, units, curveColor, fillColor, gradientColor, markerColor, fontFamily, fontSize, showCurve, showElevationMarkers, showFill, showGradient, showHorizontalGrid, showVerticalGrid } = options;
  const layout = createElevationProfileLayout(profile, undefined, undefined, { units });
  const linePath = layout.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${layout.plot.left + layout.plot.width} ${layout.plot.top + layout.plot.height} L ${layout.plot.left} ${layout.plot.top + layout.plot.height} Z`;
  const markers = createElevationProfileMarkers(profile, layout, units);
  return (
    <svg className="elevation-chart" data-print-width-mm={printWidthMm} style={{ fontFamily: elevationProfileFontStack(fontFamily) }} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`${routeName} elevation profile`}>
      {showGradient && <defs><linearGradient className="elevation-fill-gradient" id="elevation-fill-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={fillColor} /><stop offset="1" stopColor={gradientColor} /></linearGradient></defs>}
      <rect width={layout.width} height={layout.height} />
      {showVerticalGrid && <g className="elevation-grid elevation-grid-vertical">{layout.distanceTicks.map((tick) => <line key={`distance-${tick.x}`} x1={tick.x} y1={layout.plot.top} x2={tick.x} y2={layout.plot.top + layout.plot.height} />)}</g>}
      {showHorizontalGrid && <g className="elevation-grid elevation-grid-horizontal">{layout.elevationTicks.map((tick) => <line key={`elevation-${tick.y}`} x1={layout.plot.left} y1={tick.y} x2={layout.plot.left + layout.plot.width} y2={tick.y} />)}</g>}
      {showFill && <path className="elevation-area" d={areaPath} style={{ fill: showGradient ? 'url(#elevation-fill-gradient)' : fillColor }} />}
      {showCurve && <path className="elevation-line" d={linePath} style={{ stroke: curveColor }} />}
      {showElevationMarkers && (
        <g className="elevation-markers">
          {markers.map((marker) => {
            const { point } = marker;
            return (
              <g key={marker.index}>
                <circle cx={point.x} cy={point.y} r="8" style={{ fill: markerColor }} />
                <text className="elevation-marker-label" x={point.x} y={point.y - 14} textAnchor={elevationProfileMarkerTextAnchor({ pointX: point.x, label: marker.label, fontSize, plot: layout.plot })} style={{ fill: markerColor, fontFamily: elevationProfileFontStack(fontFamily), fontSize: `${fontSize}px` }}>{marker.label}</text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'The elevation profile could not be generated. Try again.';
}

function isBoundedInteger(value: number, minimum: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function formatTravelTime(distanceMeters: number, speedKilometersPerHour: number): string {
  const exactMinutes = (distanceMeters / 1000 / speedKilometersPerHour) * 60;
  const totalMinutes = Math.round(exactMinutes);
  if (totalMinutes === 0 && exactMinutes > 0) return '<1 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return [hours > 0 ? `${hours} h` : '', hours === 0 || minutes > 0 ? `${minutes} min` : ''].filter(Boolean).join(' ');
}

function ElevationProfileReady({
  profile,
  routeName,
  routeColor,
}: {
  profile: ElevationProfile;
  routeName: string;
  routeColor: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [units, setUnits] = useState<ElevationProfileUnits>('metric');
  const [customCurveColor, setCustomCurveColor] = useState<string | null>(null);
  const curveColor = customCurveColor ?? routeColor;
  const [fillColor, setFillColor] = useState('#dceeff');
  const [gradientColor, setGradientColor] = useState('#ffffff');
  const [markerColor, setMarkerColor] = useState('#7c3aed');
  const [fontFamily, setFontFamily] = useState<ElevationProfileFontFamily>('sans');
  const [fontSize, setFontSize] = useState(40);
  const [fontSizeDraft, setFontSizeDraft] = useState('40');
  const [printWidthMm, setPrintWidthMm] = useState(150);
  const [printWidthDraft, setPrintWidthDraft] = useState('150');
  const [showCurve, setShowCurve] = useState(true);
  const [showElevationMarkers, setShowElevationMarkers] = useState(true);
  const [showFill, setShowFill] = useState(true);
  const [showGradient, setShowGradient] = useState(false);
  const [showHorizontalGrid, setShowHorizontalGrid] = useState(true);
  const [showVerticalGrid, setShowVerticalGrid] = useState(true);
  const [exportError, setExportError] = useState<string | null>(null);
  const parsedFontSize = Number(fontSizeDraft);
  const isFontSizeInvalid = !isBoundedInteger(parsedFontSize, 20, 70);
  const parsedPrintWidth = Number(printWidthDraft);
  const isPrintWidthInvalid = !isBoundedInteger(parsedPrintWidth, 50, 300);
  const summary = formatElevationProfileSummary(profile, units);
  const renderOptions = { printWidthMm, units, curveColor, fillColor, gradientColor, markerColor, fontFamily, fontSize, showCurve, showElevationMarkers, showFill, showGradient, showHorizontalGrid, showVerticalGrid } as const;
  const runExport = async (format: 'svg' | 'png' | 'pdf') => {
    setExporting(true);
    setExportError(null);
    try {
      let blob: Blob;
      if (format === 'svg') {
        blob = new Blob([serializeElevationProfileSvg(profile, routeName, renderOptions)], { type: 'image/svg+xml' });
      } else if (format === 'png') {
        blob = await createElevationProfilePng(profile, routeName, renderOptions);
      } else {
        const { createElevationProfilePdf } = await import('../../export/elevationProfilePdf');
        blob = await createElevationProfilePdf(profile, routeName, renderOptions);
      }
      downloadBlob(blob, `${filenameBase(routeName)}.elevation.${format}`);
    } catch (error) {
      setExportError(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="elevation-profile-ready" aria-busy={exporting}>
      <fieldset className="elevation-settings">
        <legend>Profile settings</legend>
        <label className="elevation-number-row"><span>Print width</span><InputGroup><InputNumber min="50" max="300" step="1" aria-label="Profile print width" aria-describedby="profile-print-width-range" aria-invalid={isPrintWidthInvalid || undefined} value={printWidthDraft} onChange={(event) => {
          const value = event.currentTarget.value;
          const parsed = Number(value);
          setPrintWidthDraft(value);
          if (isBoundedInteger(parsed, 50, 300)) setPrintWidthMm(parsed);
        }} /><InputGroupAddon align="inline-end" enableScrubbing sensitivity={4}>mm</InputGroupAddon></InputGroup><small id="profile-print-width-range">50–300 mm</small></label>
        <div className="elevation-setting-row"><span>Units</span><label><input type="radio" name="elevation-units" checked={units === 'metric'} onChange={() => setUnits('metric')} /> Metric</label><label><input type="radio" name="elevation-units" checked={units === 'imperial'} onChange={() => setUnits('imperial')} /> Imperial</label></div>
        <label className="elevation-color-row"><span>Curve</span><input type="color" aria-label="Profile curve color" value={curveColor} disabled={!showCurve} onInput={(event) => setCustomCurveColor(event.currentTarget.value)} /></label>
        <label className="elevation-color-row"><span>Fill</span><input type="color" aria-label="Profile fill color" value={fillColor} onInput={(event) => setFillColor(event.currentTarget.value)} /></label>
        <label className="elevation-color-row"><span>Gradient</span><input type="color" aria-label="Profile gradient color" value={gradientColor} disabled={!showGradient} onInput={(event) => setGradientColor(event.currentTarget.value)} /></label>
        <label className="elevation-color-row"><span>Markers</span><input type="color" aria-label="Elevation marker color" value={markerColor} onInput={(event) => setMarkerColor(event.currentTarget.value)} /></label>
        <label className="elevation-select-row"><span>Font</span><select aria-label="Profile font" value={fontFamily} onChange={(event) => setFontFamily(event.currentTarget.value as ElevationProfileFontFamily)}><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="mono">Monospace</option></select></label>
        <label className="elevation-number-row"><span>Font size</span><InputGroup><InputNumber min="20" max="70" step="1" aria-label="Profile font size" aria-describedby="profile-font-size-range" aria-invalid={isFontSizeInvalid || undefined} value={fontSizeDraft} onChange={(event) => {
          const value = event.currentTarget.value;
          const parsed = Number(value);
          setFontSizeDraft(value);
          if (isBoundedInteger(parsed, 20, 70)) setFontSize(parsed);
        }} /><InputGroupAddon align="inline-end" enableScrubbing sensitivity={4}>px</InputGroupAddon></InputGroup><small id="profile-font-size-range">20–70</small></label>
        <div className="elevation-option-grid">
          <Checkbox isChecked={showCurve} label="Curve stroke" onCheckedChange={setShowCurve} />
          <Checkbox isChecked={showFill} label="Fill below curve" onCheckedChange={setShowFill} />
          <Checkbox isChecked={showGradient} label="Gradient fill" onCheckedChange={setShowGradient} />
          <Checkbox isChecked={showElevationMarkers} label="Elevation markers" onCheckedChange={setShowElevationMarkers} />
          <Checkbox isChecked={showHorizontalGrid} label="Horizontal grid" onCheckedChange={setShowHorizontalGrid} />
          <Checkbox isChecked={showVerticalGrid} label="Vertical grid" onCheckedChange={setShowVerticalGrid} />
        </div>
      </fieldset>
      <ProfileChart profile={profile} routeName={routeName} options={renderOptions} />
      <div className="elevation-metrics" role="group" aria-label="Elevation summary">
        <strong>{summary.distance}</strong>
        <span>{summary.elevationRange}</span>
        <span aria-label={`Total ascent ${summary.ascent}`}><ArrowUp aria-hidden="true" size={16} strokeWidth={1.75} />{summary.ascent}</span>
        <span aria-label={`Total descent ${summary.descent}`}><ArrowDown aria-hidden="true" size={16} strokeWidth={1.75} />{summary.descent}</span>
      </div>
      <div className="elevation-travel-times" role="group" aria-label="Travel time estimates">
        <strong>Travel estimates</strong>
        <div><span>Walking · 5 km/h</span><b>{formatTravelTime(profile.totalDistanceMeters, 5)}</b></div>
        <div><span>Cycling · 15 km/h</span><b>{formatTravelTime(profile.totalDistanceMeters, 15)}</b></div>
        <small>Distance-only estimates; terrain, stops, and conditions are not included.</small>
      </div>
      <div className="elevation-downloads">
        <button type="button" disabled={exporting || isFontSizeInvalid || isPrintWidthInvalid} aria-label="Download elevation SVG" onClick={() => void runExport('svg')}>SVG</button>
        <button type="button" disabled={exporting || isFontSizeInvalid || isPrintWidthInvalid} aria-label="Download elevation PNG" onClick={() => void runExport('png')}>PNG</button>
        <button type="button" disabled={exporting || isFontSizeInvalid || isPrintWidthInvalid} aria-label="Download elevation PDF" onClick={() => void runExport('pdf')}>PDF</button>
      </div>
      {exportError && <p role="alert">{exportError}</p>}
    </div>
  );
}

export function ElevationProfilePanel({
  coordinates,
  routeName,
  routeColor = '#0d79c7',
  loadProfile = loadElevationProfile,
}: ElevationProfilePanelProps) {
  const [state, setState] = useState<PanelState>({ status: 'idle' });
  const [localRoute, setLocalRoute] = useState<LocalProfileRoute | null>(null);
  const [isReadingRoute, setIsReadingRoute] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const activeCoordinates = localRoute?.coordinates ?? coordinates;
  const activeRouteName = localRoute?.name ?? routeName;

  useEffect(() => () => requestRef.current?.abort(), []);

  const resetProfile = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setState({ status: 'idle' });
  };

  const changeProfileSource = (route: LocalProfileRoute | null) => {
    resetProfile();
    setLocalRoute(route);
  };

  const generate = async () => {
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setState({ status: 'loading' });
    try {
      const profile = await loadProfile(activeCoordinates, { signal: controller.signal });
      if (!controller.signal.aborted) setState({ status: 'ready', profile });
    } catch (error) {
      if (!controller.signal.aborted) setState({ status: 'error', message: errorMessage(error) });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  const cancelRequest = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setState({ status: 'idle' });
  };

  return (
    <div className="elevation-profile-panel" aria-busy={state.status === 'loading'}>
      <ProfileRouteSource localRoute={localRoute} onReadingChange={setIsReadingRoute} onReadingStart={resetProfile} onSourceChange={changeProfileSource} />
      <ElevationProfileRequestControls isReadingRoute={isReadingRoute} onCancel={cancelRequest} onGenerate={() => void generate()} state={state} />
      {state.status === 'ready' && <ElevationProfileReady profile={state.profile} routeName={activeRouteName} routeColor={routeColor} />}
      <small>Up to 100 sampled route coordinates are sent to Open-Meteo only when you generate a profile.</small>
      <a href="https://open-meteo.com/en/docs/elevation-api" target="_blank" rel="noreferrer">{ELEVATION_SOURCE_LABEL}</a>
    </div>
  );
}
