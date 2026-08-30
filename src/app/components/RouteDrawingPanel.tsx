import {
  Minus,
  Route,
  Spline,
  Undo2,
} from 'lucide-react';
import {
  ROUTE_TRAVEL_PROFILES,
  ROUTE_TRAVEL_PROFILE_LABELS,
  type RouteLineShape,
  type RouteTravelProfile,
} from '../../domain/routeProfiles';
import { didHandleRovingSelection } from './rovingSelection';
import { ToolCardActions, ToolCardHeader } from './ToolAuthoringCard';

type RouteDrawingPanelProps = Readonly<{
  pointCount: number;
  canFinish: boolean;
  lineShape: RouteLineShape;
  travelProfile: RouteTravelProfile;
  showTravelModeIcon: boolean;
  isRouting: boolean;
  error: string | null;
  onLineShapeChange: (shape: RouteLineShape) => void;
  onTravelProfileChange: (profile: RouteTravelProfile) => void;
  onShowTravelModeIconChange: (isShown: boolean) => void;
  onCancel: () => void;
  onUndo: () => void;
  onFinish: () => void;
}>;

export function RouteDrawingPanel(props: RouteDrawingPanelProps) {
  const pointLabel = props.pointCount === 1 ? 'point' : 'points';
  const markerValue = props.showTravelModeIcon ? props.travelProfile : 'none';
  const status = props.isRouting
    ? 'Finding the road route…'
    : (props.pointCount === 0 ? 'Click the map to add route points' : `${props.pointCount} ${pointLabel} added · Finish when ready`);
  const changeMarker = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === 'none') return props.onShowTravelModeIconChange(false);
    props.onTravelProfileChange(value as RouteTravelProfile);
    props.onShowTravelModeIconChange(true);
  };
  return (
    <div className="map-authoring-panel tool-authoring-card route-authoring-panel">
      <ToolCardHeader closeLabel="Close Route menu" icon={Route} onClose={props.onCancel} title="Route" />
      <fieldset className="route-path-field">
        <legend className="tool-control-label">Path</legend>
        <div className="tool-segmented-control route-path-options" role="radiogroup" aria-label="Route path" onKeyDown={(event) => didHandleRovingSelection(event, '[role="radio"]')}>
          <button disabled={props.isRouting} type="button" role="radio" aria-checked={props.lineShape === 'straight'} tabIndex={props.lineShape === 'straight' ? 0 : -1} aria-label="Straight" title="Straight segments" onClick={() => props.onLineShapeChange('straight')}><Minus size={15} /><span>Straight</span></button>
          <button disabled={props.isRouting} type="button" role="radio" aria-checked={props.lineShape === 'arc'} tabIndex={props.lineShape === 'arc' ? 0 : -1} aria-label="Arc" title="Curved arcs" onClick={() => props.onLineShapeChange('arc')}><Spline size={15} /><span>Arc</span></button>
          <button disabled={props.isRouting} type="button" role="radio" aria-checked={props.lineShape === 'road'} tabIndex={props.lineShape === 'road' ? 0 : -1} aria-label="Road" title="Route along roads with Mapbox" onClick={() => props.onLineShapeChange('road')}><Route size={15} /><span>Road</span></button>
        </div>
      </fieldset>
      <label className="route-marker-field">
        <span className="tool-control-label">Travel marker</span>
        <select aria-label="Travel marker" disabled={props.isRouting} value={markerValue} onChange={changeMarker}>
          <option value="none">None</option>
          {ROUTE_TRAVEL_PROFILES.map((profile) => <option key={profile} value={profile}>{ROUTE_TRAVEL_PROFILE_LABELS[profile]}</option>)}
        </select>
      </label>
      <div className="route-progress">
        <span role="status" aria-label="Route drawing status">{status}</span>
        <button type="button" aria-label="Undo last route point" disabled={props.pointCount === 0 || props.isRouting} onClick={props.onUndo}>
          <Undo2 aria-hidden="true" size={14} />Undo point
        </button>
      </div>
      {props.error && <div className="isochrone-error" role="alert">{props.error}</div>}
      <ToolCardActions>
        <button type="button" aria-label="Cancel route" onClick={props.onCancel}>Cancel</button>
        <button className="primary-button" type="button" disabled={!props.canFinish || props.isRouting} onClick={props.onFinish}>
          {props.isRouting ? 'Routing…' : 'Finish route'}
        </button>
      </ToolCardActions>
    </div>
  );
}
