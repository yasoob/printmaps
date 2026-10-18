import { Bike, Car, Footprints, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/segmented-control';
import type { ProviderTravelProfile } from '../../services/mapbox/contracts';
import type { IsochroneCenter } from '../hooks/useIsochroneAuthoring';
import { PropertySubheading } from './PropertyControls';
import { ToolCardActions } from './ToolAuthoringCard';

const PROFILE_OPTIONS = [
  { value: 'walking', label: 'Walking', icon: Footprints },
  { value: 'cycling', label: 'Cycling', icon: Bike },
  { value: 'driving', label: 'Driving', icon: Car },
] as const satisfies readonly SegmentedControlOption<ProviderTravelProfile>[];

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
        <PropertySubheading>Starting point</PropertySubheading>
        <div className="isochrone-center" aria-live="polite">
          <MapPin aria-hidden="true" size={16} strokeWidth={1.75} />
          <span>
            <strong>{props.center?.label ?? 'Choose a point on the map'}</strong>
            <small>{props.center ? props.center.coordinate.map((value) => value.toFixed(5)).join(', ') : 'Click the map or choose a search result'}</small>
          </span>
        </div>
      </div>
      <div className="isochrone-field">
        <PropertySubheading>Travel mode</PropertySubheading>
        <SegmentedControl label="Travel mode" value={props.profile} options={PROFILE_OPTIONS} onValueChange={props.onProfileChange} />
      </div>
      <div className="isochrone-duration-row">
        <PropertySubheading action={<strong className="isochrone-duration-value">{props.minutes} min</strong>}>Duration</PropertySubheading>
        <input type="range" aria-label="Travel time in minutes" aria-describedby={isInvalidMinutes ? 'isochrone-duration-limit isochrone-duration-error' : 'isochrone-duration-limit'} aria-invalid={isInvalidMinutes} aria-valuetext={`${props.minutes} minutes`} min={5} max={60} step={1} value={props.minutes} onChange={(event) => props.onMinutesChange(event.currentTarget.valueAsNumber)} />
        <div className="isochrone-duration-limits" aria-hidden="true"><span>5 min</span><span>60 min</span></div>
      </div>
      <span id="isochrone-duration-limit" className="sr-only">Use a whole number from 5 to 60 minutes.</span>
      {isInvalidMinutes && <Notice id="isochrone-duration-error" tone="error">Use a whole number from 5 to 60 minutes.</Notice>}
      {props.error && <Notice tone="error">{props.error}</Notice>}
      <ToolCardActions>
        <Button variant="ghost" aria-label="Cancel area" onClick={props.onCancel}>Cancel</Button>
        <Button variant="primary" disabled={!props.center || props.isGenerating || isInvalidMinutes} onClick={props.onGenerate}>
          {props.isGenerating ? 'Generating…' : 'Generate area'}
        </Button>
      </ToolCardActions>
    </div>
  );
}
