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
  serializeElevationProfileSvg,
} from '../../export/elevationProfile';

type Position = readonly [number, number];
type ProfileLoader = (
  coordinates: readonly Position[],
  options: { signal: AbortSignal },
) => Promise<ElevationProfile>;

type ElevationProfilePanelProps = Readonly<{
  coordinates: readonly Position[];
  routeName: string;
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

function ProfileChart({ profile, routeName }: { profile: ElevationProfile; routeName: string }) {
  const layout = createElevationProfileLayout(profile);
  const linePath = layout.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${layout.plot.left + layout.plot.width} ${layout.plot.top + layout.plot.height} L ${layout.plot.left} ${layout.plot.top + layout.plot.height} Z`;
  return (
    <svg className="elevation-chart" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`${routeName} elevation profile`}>
      <rect width={layout.width} height={layout.height} />
      <g className="elevation-grid">
        {layout.distanceTicks.map((tick) => <line key={`distance-${tick.x}`} x1={tick.x} y1={layout.plot.top} x2={tick.x} y2={layout.plot.top + layout.plot.height} />)}
        {layout.elevationTicks.map((tick) => <line key={`elevation-${tick.y}`} x1={layout.plot.left} y1={tick.y} x2={layout.plot.left + layout.plot.width} y2={tick.y} />)}
      </g>
      <path className="elevation-area" d={areaPath} />
      <path className="elevation-line" d={linePath} />
    </svg>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'The elevation profile could not be generated. Try again.';
}

export function ElevationProfilePanel({
  coordinates,
  routeName,
  loadProfile = loadElevationProfile,
}: ElevationProfilePanelProps) {
  const [state, setState] = useState<PanelState>({ status: 'idle' });
  const [exporting, setExporting] = useState(false);
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

  const runExport = async (format: 'svg' | 'png' | 'pdf') => {
    if (state.status !== 'ready') return;
    setExporting(true);
    try {
      let blob: Blob;
      if (format === 'svg') {
        blob = new Blob([serializeElevationProfileSvg(state.profile, routeName)], { type: 'image/svg+xml' });
      } else if (format === 'png') {
        blob = await createElevationProfilePng(state.profile, routeName);
      } else {
        blob = await createElevationProfilePdf(state.profile, routeName);
      }
      downloadBlob(blob, `${filenameBase(routeName)}.elevation.${format}`);
    } catch (error) {
      setState({ status: 'error', message: errorMessage(error) });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="elevation-profile-panel" aria-busy={state.status === 'loading' || exporting}>
      {(state.status === 'idle' || state.status === 'error') && (
        <button className="quiet-button" type="button" onClick={() => void generate()}>Generate elevation profile</button>
      )}
      {state.status === 'loading' && (
        <button className="quiet-button" type="button" aria-label="Cancel elevation profile request" onClick={cancelRequest}>Cancel terrain request</button>
      )}
      {state.status === 'loading' && <span role="status">Sampling up to 100 route points from the terrain model.</span>}
      {state.status === 'error' && <p role="alert">{state.message}</p>}
      {state.status === 'ready' && (
        <>
          <ProfileChart profile={state.profile} routeName={routeName} />
          <div className="elevation-metrics" role="group" aria-label="Elevation summary">
            <strong>{(state.profile.totalDistanceMeters / 1000).toFixed(1)} km</strong>
            <span>{Math.round(state.profile.minimumElevationMeters)}–{Math.round(state.profile.maximumElevationMeters)} m</span>
            <span aria-label={`Total ascent ${Math.round(state.profile.totalAscentMeters)} metres`}>↑ {Math.round(state.profile.totalAscentMeters)} m</span>
            <span aria-label={`Total descent ${Math.round(state.profile.totalDescentMeters)} metres`}>↓ {Math.round(state.profile.totalDescentMeters)} m</span>
          </div>
          <div className="elevation-downloads">
            <button type="button" disabled={exporting} aria-label="Download elevation SVG" onClick={() => void runExport('svg')}>SVG</button>
            <button type="button" disabled={exporting} aria-label="Download elevation PNG" onClick={() => void runExport('png')}>PNG</button>
            <button type="button" disabled={exporting} aria-label="Download elevation PDF" onClick={() => void runExport('pdf')}>PDF</button>
          </div>
        </>
      )}
      <small>Up to 100 sampled route coordinates are sent to Open-Meteo only when you generate a profile.</small>
      <a href="https://open-meteo.com/en/docs/elevation-api" target="_blank" rel="noreferrer">{ELEVATION_SOURCE_LABEL}</a>
    </div>
  );
}
