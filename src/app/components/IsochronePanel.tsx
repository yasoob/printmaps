import { Bike, Car, Footprints } from 'lucide-react';
import type { ProviderTravelProfile } from '../../services/mapbox/contracts';
import type { IsochroneCenter } from '../hooks/useIsochroneAuthoring';
import { didHandleRovingSelection } from './rovingSelection';

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
      <p className="isochrone-hint">Click the map or choose a search result to set the center.</p>
      <div className="isochrone-center" aria-live="polite">
        <span>Center</span>
        <strong>{props.center?.label ?? 'Not selected'}</strong>
        {props.center && <small>{props.center.coordinate.map((value) => value.toFixed(5)).join(', ')}</small>}
      </div>
      <div className="isochrone-profiles" role="radiogroup" aria-label="Travel mode" onKeyDown={handleProfileKeyDown}>
        {profiles.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="radio" aria-checked={props.profile === id} tabIndex={props.profile === id ? 0 : -1} onClick={() => props.onProfileChange(id)}>
            <Icon aria-hidden="true" size={15} /> {label}
          </button>
        ))}
      </div>
      <label className="isochrone-duration">
        <span>Travel time</span>
        <input type="number" aria-label="Travel time in minutes" aria-describedby={isInvalidMinutes ? 'isochrone-duration-limit isochrone-duration-error' : 'isochrone-duration-limit'} aria-invalid={isInvalidMinutes} min={5} max={60} step={5} value={props.minutes} onChange={(event) => {
          const minutes = event.currentTarget.valueAsNumber;
          props.onMinutesChange(Number.isFinite(minutes) ? minutes : 0);
        }} />
        <span>min</span>
      </label>
      <p id="isochrone-duration-limit" className="isochrone-limit-note">Mapbox supports up to 60 minutes. 61–180 minute areas are unavailable with this provider.</p>
      {isInvalidMinutes && <div id="isochrone-duration-error" className="isochrone-error" role="alert">Use a whole number from 5 to 60 minutes.</div>}
      {props.error && <div className="isochrone-error" role="alert">{props.error}</div>}
      <div className="isochrone-actions">
        <button type="button" onClick={props.onCancel}>Cancel area</button>
        <button className="primary-button" type="button" disabled={!props.center || props.isGenerating || isInvalidMinutes} onClick={props.onGenerate}>
          {props.isGenerating ? 'Generating…' : 'Generate area'}
        </button>
      </div>
    </div>
  );
}
