import {
  Bike,
  Car,
  CircleOff,
  Footprints,
  Minus,
  Plane,
  ShipWheel,
  Spline,
  TrainFront,
  Undo2,
  type LucideIcon,
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
    <div className="map-authoring-panel">
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
  onLineShapeChange: (shape: RouteLineShape) => void;
  onTravelProfileChange: (profile: RouteTravelProfile) => void;
  onShowTravelModeIconChange: (isShown: boolean) => void;
  onCancel: () => void;
  onUndo: () => void;
  onFinish: () => void;
}>;

const TRAVEL_ICONS: Record<RouteTravelProfile, LucideIcon> = {
  air: Plane,
  rail: TrainFront,
  car: Car,
  walk: Footprints,
  bike: Bike,
  ship: ShipWheel,
};

export function RouteDrawingPanel(props: RouteDrawingPanelProps) {
  const pointLabel = props.pointCount === 1 ? 'point' : 'points';
  const shapeLabel = props.lineShape === 'arc' ? 'Arc' : 'Straight';
  const markerLabel = props.showTravelModeIcon ? ROUTE_TRAVEL_PROFILE_LABELS[props.travelProfile] : 'No marker';
  return (
    <DrawingPanel
      statusLabel="Route drawing status"
      status={`${shapeLabel} route · ${markerLabel} · ${props.pointCount} ${pointLabel}`}
      cancelLabel="Cancel route"
      finishLabel="Finish route"
      finishDisabled={!props.canFinish}
      undoLabel="Undo last route point"
      undoDisabled={props.pointCount === 0}
      onCancel={props.onCancel}
      onUndo={props.onUndo}
      onFinish={props.onFinish}
    >
      <fieldset className="authoring-option-group">
        <legend>Path</legend>
        <div className="authoring-segmented" role="radiogroup" aria-label="Route path" onKeyDown={(event) => didHandleRovingSelection(event, '[role="radio"]')}>
          <button type="button" role="radio" aria-checked={props.lineShape === 'straight'} tabIndex={props.lineShape === 'straight' ? 0 : -1} aria-label="Straight" title="Straight segments" onClick={() => props.onLineShapeChange('straight')}><Minus size={16} /></button>
          <button type="button" role="radio" aria-checked={props.lineShape === 'arc'} tabIndex={props.lineShape === 'arc' ? 0 : -1} aria-label="Arc" title="Curved arcs" onClick={() => props.onLineShapeChange('arc')}><Spline size={16} /></button>
        </div>
      </fieldset>
      <fieldset className="authoring-option-group">
        <legend>Travel marker</legend>
        <div className="authoring-segmented" role="radiogroup" aria-label="Travel mode marker" onKeyDown={(event) => didHandleRovingSelection(event, '[role="radio"]')}>
          <button type="button" role="radio" aria-checked={!props.showTravelModeIcon} tabIndex={props.showTravelModeIcon ? -1 : 0} aria-label="No travel marker" title="No travel marker" onClick={() => props.onShowTravelModeIconChange(false)}><CircleOff size={15} /></button>
          {ROUTE_TRAVEL_PROFILES.map((profile) => {
            const Icon = TRAVEL_ICONS[profile];
            return (
              <button
                key={profile}
                type="button"
                role="radio"
                aria-checked={props.showTravelModeIcon && props.travelProfile === profile}
                tabIndex={props.showTravelModeIcon && props.travelProfile === profile ? 0 : -1}
                aria-label={`${ROUTE_TRAVEL_PROFILE_LABELS[profile]} travel marker`}
                title={ROUTE_TRAVEL_PROFILE_LABELS[profile]}
                onClick={() => { props.onTravelProfileChange(profile); props.onShowTravelModeIconChange(true); }}
              >
                <Icon size={15} />
              </button>
            );
          })}
        </div>
      </fieldset>
    </DrawingPanel>
  );
}
