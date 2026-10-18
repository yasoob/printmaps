import { ArrowDown, ArrowUp } from 'lucide-react';
import { useId, useMemo, useSyncExternalStore } from 'react';
import {
  ELEVATION_SOURCE_LABEL,
  type ElevationProfile,
} from '../../elevation/profile';
import {
  serializeElevationProfileSvg,
  formatElevationProfileSummary,
  type ElevationProfileFontFamily,
} from '../../export/elevationProfile';
import { ElevationProfileRequestControls } from './ElevationProfileRequestControls';
import { ProfileRouteSource } from './ProfileRouteSource';
import type { ElevationProfileSession } from '../elevation/ElevationProfileSession';
import { isProfileInteger, profileChartOptions, type ProfileChartOptions, type ProfileSessionState } from '../elevation/profileSessionTypes';
import { useRouteElevationSession } from '../elevation/profileSessionContext';
import { Checkbox } from './UiControls';
import { PropertyRow } from './PropertyControls';
import { Button } from '../../components/ui/button';
import { ColorField } from '../../components/ui/color-field';
import { Notice } from '../../components/ui/notice';
import { SegmentedControl } from '../../components/ui/segmented-control';

import { InputGroup, InputGroupAddon, InputNumber } from './InputGroup';

const UNIT_OPTIONS = [{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }] as const;

function ProfileChart({ profile, routeName, options }: {
  profile: ElevationProfile;
  routeName: string;
  options: ProfileChartOptions;
}) {
  const instance = useId();
  const id = `elevation-profile-${instance.replaceAll(/[^\w-]/g, '')}`;
  const svg = useMemo(() => serializeElevationProfileSvg(profile, routeName, options, id), [profile, routeName, options, id]);
  return (
    <div className="elevation-profile-preview">
      <small>SVG / PNG preview</small>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
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
  model,
  state,
}: {
  profile: ElevationProfile;
  model: ElevationProfileSession;
  state: ProfileSessionState;
}) {
  const { exporting, exportError } = state;
  const { units, fillColor, gradientColor, markerColor, fontFamily, fontSizeDraft, printWidthDraft, showCurve, showElevationMarkers, showFill, showGradient, showHorizontalGrid, showVerticalGrid } = state.settings;
  const routeName = state.localRoute?.name ?? state.route.name;
  const renderOptions = profileChartOptions(state);
  const { curveColor } = renderOptions;
  const isFontSizeInvalid = !isProfileInteger(fontSizeDraft, 20, 70);
  const isPrintWidthInvalid = !isProfileInteger(printWidthDraft, 50, 300);
  const summary = formatElevationProfileSummary(profile, units);
  const cannotExport = exporting || state.readingFilename !== null || isFontSizeInvalid || isPrintWidthInvalid;

  return (
    <div className="elevation-profile-ready" aria-busy={exporting}>
      <fieldset className="elevation-settings">
        <legend>Profile settings</legend>
        <PropertyRow label="Print width"><InputGroup><InputNumber min="50" max="300" step="1" aria-label="Profile print width" aria-describedby="profile-print-width-range" aria-invalid={isPrintWidthInvalid || undefined} value={printWidthDraft} onChange={(event) => {
          model.setNumberDraft('printWidthMm', event.currentTarget.value);
        }} /><InputGroupAddon align="inline-end" enableScrubbing sensitivity={4}>mm</InputGroupAddon></InputGroup></PropertyRow>
        <small id="profile-print-width-range" className={isPrintWidthInvalid ? 'coordinate-validation' : 'sr-only'}>Use 50–300 mm.</small>
        <PropertyRow label="Units"><SegmentedControl label="Elevation units" value={units} options={UNIT_OPTIONS} onValueChange={(value) => model.setSetting('units', value)} /></PropertyRow>
        <PropertyRow label="Curve"><ColorField label="Profile curve color" value={curveColor} disabled={!showCurve} onChange={(value) => model.setSetting('customCurveColor', value)} /></PropertyRow>
        <PropertyRow label="Fill"><ColorField label="Profile fill color" value={fillColor} onChange={(value) => model.setSetting('fillColor', value)} /></PropertyRow>
        <PropertyRow label="Gradient"><ColorField label="Profile gradient color" value={gradientColor} disabled={!showGradient} onChange={(value) => model.setSetting('gradientColor', value)} /></PropertyRow>
        <PropertyRow label="Markers"><ColorField label="Elevation marker color" value={markerColor} onChange={(value) => model.setSetting('markerColor', value)} /></PropertyRow>
        <PropertyRow label="Font"><select aria-label="Profile font" value={fontFamily} onChange={(event) => model.setSetting('fontFamily', event.currentTarget.value as ElevationProfileFontFamily)}><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="mono">Monospace</option></select></PropertyRow>
        <PropertyRow label="Font size"><InputGroup><InputNumber min="20" max="70" step="1" aria-label="Profile font size" aria-describedby="profile-font-size-range" aria-invalid={isFontSizeInvalid || undefined} value={fontSizeDraft} onChange={(event) => {
          model.setNumberDraft('fontSize', event.currentTarget.value);
        }} /><InputGroupAddon align="inline-end" enableScrubbing sensitivity={4}>px</InputGroupAddon></InputGroup></PropertyRow>
        <small id="profile-font-size-range" className={isFontSizeInvalid ? 'coordinate-validation' : 'sr-only'}>Use 20–70 px.</small>
        <div className="elevation-option-grid">
          <Checkbox isChecked={showCurve} label="Curve stroke" onCheckedChange={(value) => model.setSetting('showCurve', value)} />
          <Checkbox isChecked={showFill} label="Fill below curve" onCheckedChange={(value) => model.setSetting('showFill', value)} />
          <Checkbox isChecked={showGradient} label="Gradient fill" onCheckedChange={(value) => model.setSetting('showGradient', value)} />
          <Checkbox isChecked={showElevationMarkers} label="Elevation markers" onCheckedChange={(value) => model.setSetting('showElevationMarkers', value)} />
          <Checkbox isChecked={showHorizontalGrid} label="Horizontal grid" onCheckedChange={(value) => model.setSetting('showHorizontalGrid', value)} />
          <Checkbox isChecked={showVerticalGrid} label="Vertical grid" onCheckedChange={(value) => model.setSetting('showVerticalGrid', value)} />
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
        <Button variant="secondary" disabled={cannotExport} aria-label="Download elevation SVG" onClick={() => void model.export('svg')}>SVG</Button>
        <Button variant="secondary" disabled={cannotExport} aria-label="Download elevation PNG" onClick={() => void model.export('png')}>PNG</Button>
        <Button variant="secondary" disabled={cannotExport} aria-label="Download elevation PDF" onClick={() => void model.export('pdf')}>PDF</Button>
      </div>
      {exportError && <Notice tone="error">{exportError}</Notice>}
    </div>
  );
}

export function ElevationProfilePanel({ model }: { model: ElevationProfileSession }) {
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  return (
    <div className="elevation-profile-panel">
      <ProfileRouteSource model={model} state={state} />
      <ElevationProfileRequestControls isReadingRoute={state.readingFilename !== null} onCancel={model.cancelTerrain} onGenerate={() => void model.generate()} state={state} />
      {state.notice && <p role="status">{state.notice}</p>}
      {state.profile && state.status !== 'ready' && <small>Showing the last generated profile for this source.</small>}
      {state.profile && <ElevationProfileReady profile={state.profile} model={model} state={state} />}
      <small>Profile data, file choices and settings stay only in this editor session. Download profiles separately; they are not saved in project files or recovered after reload.</small>
      <small>Up to 100 sampled route coordinates are sent to Open-Meteo only when you generate a profile.</small>
      <a href="https://open-meteo.com/en/docs/elevation-api" target="_blank" rel="noreferrer">{ELEVATION_SOURCE_LABEL}</a>
    </div>
  );
}

export function RouteElevationProfilePanel({ routeId, documentEpoch }: { routeId: string; documentEpoch: number }) {
  const model = useRouteElevationSession(routeId, documentEpoch);
  return model ? <ElevationProfilePanel model={model} /> : null;
}
