import {
  Minus,
  Route,
  Spline,
  Undo2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  ROUTE_TRAVEL_PROFILES,
  ROUTE_TRAVEL_PROFILE_LABELS,
  type RouteLineShape,
  type RouteTravelProfile,
} from '../../domain/routeProfiles';
import { didHandleRovingSelection } from './rovingSelection';

type DrawingPanelProps = {
  children?: ReactNode;
  className?: string;
  statusLabel: string;
  status: string;
  cancelLabel: string;
  finishLabel: string;
  finishDisabled: boolean;
  undoLabel?: string;
  undoDisabled?: boolean;
  onCancel: () => void;
  onUndo?: () => void;
  onFinish: () => void;
};

export function DrawingPanel(props: DrawingPanelProps) {
  return (
    <div className={`map-authoring-panel${props.className ? ` ${props.className}` : ''}`}>
      {props.children}
      <span role="status" aria-label={props.statusLabel}>{props.status}</span>
      {props.onUndo && <button type="button" aria-label={props.undoLabel} disabled={props.undoDisabled} onClick={props.onUndo}><Undo2 aria-hidden="true" size={14} /> Undo point</button>}
      <button type="button" onClick={props.onCancel}>{props.cancelLabel}</button>
      <button className="primary-button" type="button" disabled={props.finishDisabled} onClick={props.onFinish}>{props.finishLabel}</button>
    </div>
  );
}

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
    : (props.pointCount === 0 ? 'Click the map to add route points' : `${props.pointCount} ${pointLabel} added`);
  const changeMarker = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === 'none') return props.onShowTravelModeIconChange(false);
    props.onTravelProfileChange(value as RouteTravelProfile);
    props.onShowTravelModeIconChange(true);
  };
  return (
    <DrawingPanel
      className="route-authoring-panel"
      statusLabel="Route drawing status"
      status={status}
      cancelLabel="Cancel route"
      finishLabel={props.isRouting ? 'Routing…' : 'Finish route'}
      finishDisabled={!props.canFinish || props.isRouting}
      undoLabel="Undo last route point"
      undoDisabled={props.pointCount === 0 || props.isRouting}
      onCancel={props.onCancel}
      onUndo={props.onUndo}
      onFinish={props.onFinish}
    >
      <div className="authoring-segmented route-path-options" role="radiogroup" aria-label="Route path" onKeyDown={(event) => didHandleRovingSelection(event, '[role="radio"]')}>
        <button disabled={props.isRouting} type="button" role="radio" aria-checked={props.lineShape === 'straight'} tabIndex={props.lineShape === 'straight' ? 0 : -1} aria-label="Straight" title="Straight segments" onClick={() => props.onLineShapeChange('straight')}><Minus size={15} /><span>Straight</span></button>
        <button disabled={props.isRouting} type="button" role="radio" aria-checked={props.lineShape === 'arc'} tabIndex={props.lineShape === 'arc' ? 0 : -1} aria-label="Arc" title="Curved arcs" onClick={() => props.onLineShapeChange('arc')}><Spline size={15} /><span>Arc</span></button>
        <button disabled={props.isRouting} type="button" role="radio" aria-checked={props.lineShape === 'road'} tabIndex={props.lineShape === 'road' ? 0 : -1} aria-label="Road" title="Route along roads with Mapbox" onClick={() => props.onLineShapeChange('road')}><Route size={15} /><span>Road</span></button>
      </div>
      <label className="route-marker-field"><span>Marker</span><select aria-label="Travel marker" disabled={props.isRouting} value={markerValue} onChange={changeMarker}>
        <option value="none">None</option>
        {ROUTE_TRAVEL_PROFILES.map((profile) => <option key={profile} value={profile}>{ROUTE_TRAVEL_PROFILE_LABELS[profile]}</option>)}
      </select></label>
      {props.error && <div className="isochrone-error" role="alert">{props.error}</div>}
    </DrawingPanel>
  );
}
