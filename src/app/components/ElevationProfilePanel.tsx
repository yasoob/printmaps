import { useEffect, useRef, useState } from 'react';
import {
  ELEVATION_SOURCE_LABEL,
  loadElevationProfile,
  type ElevationProfile,
} from '../../elevation/profile';
import {
  createElevationProfileLayout,
  createElevationProfilePdf,
  createElevationProfilePng,
  formatElevationProfileSummary,
  serializeElevationProfileSvg,
  type ElevationProfileUnits,
} from '../../export/elevationProfile';

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

function ProfileChart({
  profile,
  routeName,
  units,
  curveColor,
  showFill,
  showHorizontalGrid,
  showVerticalGrid,
}: {
  profile: ElevationProfile;
  routeName: string;
  units: ElevationProfileUnits;
  curveColor: string;
  showFill: boolean;
  showHorizontalGrid: boolean;
  showVerticalGrid: boolean;
}) {
  const layout = createElevationProfileLayout(profile, undefined, undefined, { units });
  const linePath = layout.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${layout.plot.left + layout.plot.width} ${layout.plot.top + layout.plot.height} L ${layout.plot.left} ${layout.plot.top + layout.plot.height} Z`;
  return (
    <svg className="elevation-chart" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`${routeName} elevation profile`}>
      <rect width={layout.width} height={layout.height} />
      {showVerticalGrid && <g className="elevation-grid elevation-grid-vertical">{layout.distanceTicks.map((tick) => <line key={`distance-${tick.x}`} x1={tick.x} y1={layout.plot.top} x2={tick.x} y2={layout.plot.top + layout.plot.height} />)}</g>}
      {showHorizontalGrid && <g className="elevation-grid elevation-grid-horizontal">{layout.elevationTicks.map((tick) => <line key={`elevation-${tick.y}`} x1={layout.plot.left} y1={tick.y} x2={layout.plot.left + layout.plot.width} y2={tick.y} />)}</g>}
      {showFill && <path className="elevation-area" d={areaPath} />}
      <path className="elevation-line" d={linePath} style={{ stroke: curveColor }} />
    </svg>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'The elevation profile could not be generated. Try again.';
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
  const [showFill, setShowFill] = useState(true);
  const [showHorizontalGrid, setShowHorizontalGrid] = useState(true);
  const [showVerticalGrid, setShowVerticalGrid] = useState(true);
  const [exportError, setExportError] = useState<string | null>(null);
  const summary = formatElevationProfileSummary(profile, units);
  const runExport = async (format: 'svg' | 'png' | 'pdf') => {
    setExporting(true);
    setExportError(null);
    try {
      const renderOptions = { units, curveColor, showFill, showHorizontalGrid, showVerticalGrid } as const;
      let blob: Blob;
      if (format === 'svg') {
        blob = new Blob([serializeElevationProfileSvg(profile, routeName, renderOptions)], { type: 'image/svg+xml' });
      } else if (format === 'png') {
        blob = await createElevationProfilePng(profile, routeName, renderOptions);
      } else {
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
        <div className="elevation-setting-row"><span>Units</span><label><input type="radio" name="elevation-units" checked={units === 'metric'} onChange={() => setUnits('metric')} /> Metric</label><label><input type="radio" name="elevation-units" checked={units === 'imperial'} onChange={() => setUnits('imperial')} /> Imperial</label></div>
        <label className="elevation-color-row"><span>Curve</span><input type="color" aria-label="Profile curve color" value={curveColor} onInput={(event) => setCustomCurveColor(event.currentTarget.value)} /></label>
        <div className="elevation-option-grid">
          <label><input type="checkbox" checked={showFill} onChange={(event) => setShowFill(event.currentTarget.checked)} /> Fill below curve</label>
          <label><input type="checkbox" checked={showHorizontalGrid} onChange={(event) => setShowHorizontalGrid(event.currentTarget.checked)} /> Horizontal grid</label>
          <label><input type="checkbox" checked={showVerticalGrid} onChange={(event) => setShowVerticalGrid(event.currentTarget.checked)} /> Vertical grid</label>
        </div>
      </fieldset>
      <ProfileChart profile={profile} routeName={routeName} units={units} curveColor={curveColor} showFill={showFill} showHorizontalGrid={showHorizontalGrid} showVerticalGrid={showVerticalGrid} />
      <div className="elevation-metrics" role="group" aria-label="Elevation summary">
        <strong>{summary.distance}</strong>
        <span>{summary.elevationRange}</span>
        <span aria-label={`Total ascent ${summary.ascent}`}>↑ {summary.ascent}</span>
        <span aria-label={`Total descent ${summary.descent}`}>↓ {summary.descent}</span>
      </div>
      <div className="elevation-downloads">
        <button type="button" disabled={exporting} aria-label="Download elevation SVG" onClick={() => void runExport('svg')}>SVG</button>
        <button type="button" disabled={exporting} aria-label="Download elevation PNG" onClick={() => void runExport('png')}>PNG</button>
        <button type="button" disabled={exporting} aria-label="Download elevation PDF" onClick={() => void runExport('pdf')}>PDF</button>
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
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  const generate = async () => {
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setState({ status: 'loading' });
    try {
      const profile = await loadProfile(coordinates, { signal: controller.signal });
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
      {(state.status === 'idle' || state.status === 'error') && (
        <button className="quiet-button" type="button" onClick={() => void generate()}>Generate elevation profile</button>
      )}
      {state.status === 'loading' && (
        <button className="quiet-button" type="button" aria-label="Cancel elevation profile request" onClick={cancelRequest}>Cancel terrain request</button>
      )}
      {state.status === 'loading' && <span role="status">Sampling up to 100 route points from the terrain model.</span>}
      {state.status === 'error' && <p role="alert">{state.message}</p>}
      {state.status === 'ready' && <ElevationProfileReady profile={state.profile} routeName={routeName} routeColor={routeColor} />}
      <small>Up to 100 sampled route coordinates are sent to Open-Meteo only when you generate a profile.</small>
      <a href="https://open-meteo.com/en/docs/elevation-api" target="_blank" rel="noreferrer">{ELEVATION_SOURCE_LABEL}</a>
    </div>
  );
}
