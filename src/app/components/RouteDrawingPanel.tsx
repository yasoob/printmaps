import type { ReactNode } from 'react';
import {
  ROUTE_TRAVEL_PROFILES,
  ROUTE_TRAVEL_PROFILE_LABELS,
  type RouteLineShape,
  type RouteTravelProfile,
} from '../../domain/routeProfiles';
import { Checkbox } from './UiControls';

type DrawingPanelProps = {
  children?: ReactNode;
  statusLabel: string;
  status: string;
  cancelLabel: string;
  finishLabel: string;
  finishDisabled: boolean;
  onCancel: () => void;
  onFinish: () => void;
};

export function DrawingPanel(props: DrawingPanelProps) {
  return (
    <div className="map-authoring-panel">
      {props.children}
      <span role="status" aria-label={props.statusLabel}>{props.status}</span>
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
  onLineShapeChange: (shape: RouteLineShape) => void;
  onTravelProfileChange: (profile: RouteTravelProfile) => void;
  onShowTravelModeIconChange: (isShown: boolean) => void;
  onCancel: () => void;
  onFinish: () => void;
}>;

export function RouteDrawingPanel(props: RouteDrawingPanelProps) {
  const pointLabel = props.pointCount === 1 ? 'point' : 'points';
  const shapeLabel = props.lineShape === 'arc' ? 'Arc' : 'Straight';
  return (
    <DrawingPanel statusLabel="Route drawing status" status={`${shapeLabel} route · ${ROUTE_TRAVEL_PROFILE_LABELS[props.travelProfile]} · ${props.pointCount} ${pointLabel}`} cancelLabel="Cancel route" finishLabel="Finish route" finishDisabled={!props.canFinish} onCancel={props.onCancel} onFinish={props.onFinish}>
      <label>Line <select aria-label="Route line shape" value={props.lineShape} onChange={(event) => props.onLineShapeChange(event.target.value as RouteLineShape)}><option value="straight">Straight</option><option value="arc">Arc</option></select></label>
      <label>Profile <select aria-label="Route travel profile" value={props.travelProfile} onChange={(event) => props.onTravelProfileChange(event.target.value as RouteTravelProfile)}>{ROUTE_TRAVEL_PROFILES.map((profile) => <option key={profile} value={profile}>{ROUTE_TRAVEL_PROFILE_LABELS[profile]}</option>)}</select></label>
      <Checkbox aria-label="Show travel-mode marker" isChecked={props.showTravelModeIcon} label="Marker" onCheckedChange={props.onShowTravelModeIconChange} />
    </DrawingPanel>
  );
}
