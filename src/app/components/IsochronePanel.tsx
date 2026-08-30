import { Bike, Car, Footprints, MapPin } from 'lucide-react';
import type { ProviderTravelProfile } from '../../services/mapbox/contracts';
import type { IsochroneCenter } from '../hooks/useIsochroneAuthoring';
import { didHandleRovingSelection } from './rovingSelection';
import { ToolCardActions } from './ToolAuthoringCard';

const profiles = [
  { id: 'walking' as const, label: 'Walking', icon: Footprints },
  { id: 'cycling' as const, label: 'Cycling', icon: Bike },
  { id: 'driving' as const, label: 'Driving', icon: Car },
];

function handleProfileKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
  didHandleRovingSelection(event, '[role="radio"]');
}

type IsochronePanelProps = {
  center: IsochroneCenter | null;
  error: string | null;
  isGenerating: boolean;
  minutes: number;
  profile: ProviderTravelProfile;
  onCancel: () => void;
  onGenerate: () => void;
  onMinutesChange: (minutes: number) => void;
  onProfileChange: (profile: ProviderTravelProfile) => void;
};

export function IsochronePanel(props: IsochronePanelProps) {
  const isInvalidMinutes = !Number.isSafeInteger(props.minutes) || props.minutes < 5 || props.minutes > 60;
  return (
    <div className="isochrone-panel">
      <div className="isochrone-field">
        <span className="shape-control-label">Starting point</span>
        <div className="isochrone-center" aria-live="polite">
          <MapPin aria-hidden="true" size={16} />
          <span>
            <strong>{props.center?.label ?? 'Choose a point on the map'}</strong>
            <small>{props.center ? props.center.coordinate.map((value) => value.toFixed(5)).join(', ') : 'Click the map or choose a search result'}</small>
          </span>
        </div>
      </div>
      <fieldset className="isochrone-travel-mode">
        <legend className="shape-control-label">Travel mode</legend>
        <div className="isochrone-profiles" role="radiogroup" aria-label="Travel mode" onKeyDown={handleProfileKeyDown}>
          {profiles.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="radio" aria-checked={props.profile === id} tabIndex={props.profile === id ? 0 : -1} onClick={() => props.onProfileChange(id)}>
              <Icon aria-hidden="true" size={16} /> <span>{label}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="isochrone-duration-row">
        <div className="isochrone-duration-heading">
          <span className="shape-control-label">Travel time</span>
          <strong>{props.minutes} min</strong>
        </div>
        <input type="range" aria-label="Travel time in minutes" aria-describedby={isInvalidMinutes ? 'isochrone-duration-limit isochrone-duration-error' : 'isochrone-duration-limit'} aria-invalid={isInvalidMinutes} aria-valuetext={`${props.minutes} minutes`} min={5} max={60} step={1} value={props.minutes} onChange={(event) => props.onMinutesChange(event.currentTarget.valueAsNumber)} />
        <div className="isochrone-duration-limits" aria-hidden="true"><span>5 min</span><span>60 min</span></div>
      </div>
      <span id="isochrone-duration-limit" className="sr-only">Use a whole number from 5 to 60 minutes.</span>
      {isInvalidMinutes && <div id="isochrone-duration-error" className="isochrone-error" role="alert">Use a whole number from 5 to 60 minutes.</div>}
      {props.error && <div className="isochrone-error" role="alert">{props.error}</div>}
      <ToolCardActions>
        <button type="button" aria-label="Cancel area" onClick={props.onCancel}>Cancel</button>
        <button className="primary-button" type="button" disabled={!props.center || props.isGenerating || isInvalidMinutes} onClick={props.onGenerate}>
          {props.isGenerating ? 'Generating…' : 'Generate area'}
        </button>
      </ToolCardActions>
    </div>
  );
}
