import {
  Minus,
  Route,
  Spline,
  Undo2,
} from "lucide-react";
import {
  ROAD_TRAVEL_MODES,
  ROAD_TRAVEL_MODE_LABELS,
  ROUTE_TRAVEL_MARKERS,
  ROUTE_TRAVEL_MARKER_LABELS,
  type RoadTravelMode,
  type RouteLineShape,
  type RouteTravelMarker,
} from "../../domain/routeProfiles";
import type { ContentLayer } from "../../domain/project";
import { didHandleRovingSelection } from "./rovingSelection";
import { RoutePointInputs } from "./RoutePointInputs";
import { ToolCardActions, ToolCardHeader } from "./ToolAuthoringCard";
import { RouteDraftPointList } from "./RouteDraftPointList";

export type RouteDrawingPanelProps = Readonly<{
  pointCount: number;
  points: readonly (readonly [number, number])[];
  canFinish: boolean;
  canUndo: boolean;
  closed: boolean;
  finishExplanation: string;
  lineShape: RouteLineShape;
  pathLocked?: boolean;
  title?: string;
  roadTravelMode: RoadTravelMode;
  travelMarker: RouteTravelMarker | null;
  isRouting: boolean;
  error: string | null;
  announcement: string | null;
  initialCoordinate: readonly [number, number];
  pois: readonly ContentLayer[];
  snapEnabled: boolean;
  onLineShapeChange: (shape: RouteLineShape) => void;
  onRoadTravelModeChange: (mode: RoadTravelMode) => void;
  onTravelMarkerChange: (marker: RouteTravelMarker | null) => void;
  onAddPoint: (coordinate: readonly [number, number], label: string) => void;
  onSnapChange: (isEnabled: boolean) => void;
  onCancel: () => void;
  onUndo: () => void;
  onFinish: () => void;
  onFocusPoint: (index: number) => void;
  onMovePointDown: (index: number) => void;
  onMovePointUp: (index: number) => void;
  onPreviewRoad: () => void;
  onRemovePoint: (index: number) => void;
  hasRoadPreview: boolean;
  minimumPointCount: number;
}>;

function RoutePathControl(props: RouteDrawingPanelProps) {
  const isDisabled = props.isRouting || props.pathLocked;
  return (
    <fieldset className="route-path-field">
      <legend className="tool-control-label">Path</legend>
      <div
        className="tool-segmented-control route-path-options"
        role="radiogroup"
        aria-label="Route path"
        onKeyDown={(event) => didHandleRovingSelection(event, '[role="radio"]')}
      >
        <button
          disabled={isDisabled}
          type="button"
          role="radio"
          aria-checked={props.lineShape === "straight"}
          tabIndex={props.lineShape === "straight" ? 0 : -1}
          aria-label="Straight"
          title="Straight segments"
          onClick={() => props.onLineShapeChange("straight")}
        >
          <Minus size={15} />
          <span>Straight</span>
        </button>
        <button
          disabled={isDisabled}
          type="button"
          role="radio"
          aria-checked={props.lineShape === "arc"}
          tabIndex={props.lineShape === "arc" ? 0 : -1}
          aria-label="Arc"
          title="Curved arcs"
          onClick={() => props.onLineShapeChange("arc")}
        >
          <Spline size={15} />
          <span>Arc</span>
        </button>
        <button
          disabled={isDisabled}
          type="button"
          role="radio"
          aria-checked={props.lineShape === "road"}
          tabIndex={props.lineShape === "road" ? 0 : -1}
          aria-label="Road"
          title="Route along roads with Mapbox"
          onClick={() => props.onLineShapeChange("road")}
        >
          <Route size={15} />
          <span>Road</span>
        </button>
      </div>
    </fieldset>
  );
}

function RouteTravelControls(props: RouteDrawingPanelProps) {
  return (
    <>
      {props.lineShape === "road" && (
        <label className="route-marker-field">
          <span className="tool-control-label">Road travel mode</span>
          <select
            aria-label="Road travel mode"
            disabled={props.isRouting}
            value={props.roadTravelMode}
            onChange={(event) =>
              props.onRoadTravelModeChange(event.target.value as RoadTravelMode)
            }
          >
            {ROAD_TRAVEL_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {ROAD_TRAVEL_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="route-marker-field">
        <span className="tool-control-label">Travel marker</span>
        <select
          aria-label="Travel marker"
          disabled={props.isRouting}
          value={props.travelMarker ?? "none"}
          onChange={(event) =>
            props.onTravelMarkerChange(
              event.target.value === "none"
                ? null
                : (event.target.value as RouteTravelMarker),
            )
          }
        >
          <option value="none">None</option>
          {ROUTE_TRAVEL_MARKERS.map((marker) => (
            <option key={marker} value={marker}>
              {ROUTE_TRAVEL_MARKER_LABELS[marker]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function RouteDraftStatus(props: RouteDrawingPanelProps) {
  const pointLabel = props.pointCount === 1 ? "point" : "points";
  let status = `${props.pointCount} ${pointLabel} added · Finish when ready`;
  if (props.isRouting) status = "Finding the road route…";
  else if (props.pointCount === 0) status = "Click the map to add route points";
  return (
    <>
      {props.points.length > 0 && <RouteDraftPointList {...props} />}
      <div className="route-progress">
        <span role="status" aria-label="Route drawing status">
          {status}
        </span>
        <button
          type="button"
          aria-label="Undo last route point"
          disabled={!props.canUndo || props.isRouting}
          onClick={props.onUndo}
        >
          <Undo2 aria-hidden="true" size={14} />
          Undo point
        </button>
      </div>
    </>
  );
}

export function RouteDrawingPanel(props: RouteDrawingPanelProps) {
  const finishExplanationId = "route-finish-explanation";
  return (
    <div className="map-authoring-panel tool-authoring-card route-authoring-panel">
      <ToolCardHeader
        closeLabel="Close Route menu"
        icon={Route}
        onClose={props.onCancel}
        title={props.title ?? "Route"}
      />
      <RoutePathControl {...props} />
      <RouteTravelControls {...props} />
      <details className="route-point-sources">
        <summary>Add by coordinates or existing place</summary>
        <RoutePointInputs
          disabled={props.isRouting}
          initialCoordinate={props.initialCoordinate}
          onAdd={props.onAddPoint}
          onSnapChange={props.onSnapChange}
          pois={props.pois}
          snapEnabled={props.snapEnabled}
        />
      </details>
      <RouteDraftStatus {...props} />
      {props.lineShape === "road" && props.points.length >= 2 && (
        <button
          className="route-preview-button"
          type="button"
          disabled={props.isRouting}
          onClick={props.onPreviewRoad}
        >
          {props.isRouting
            ? "Previewing…"
            : (props.hasRoadPreview ? "Refresh Road Preview" : "Road Preview")}
        </button>
      )}
      {props.announcement && (
        <div role="status" aria-live="polite">
          {props.announcement}
        </div>
      )}
      {props.error && (
        <div className="isochrone-error" role="alert">
          {props.error}
        </div>
      )}
      <small id={finishExplanationId} className="route-finish-explanation">
        {props.finishExplanation}
      </small>
      <ToolCardActions>
        <button
          type="button"
          aria-label="Cancel route"
          onClick={props.onCancel}
        >
          Cancel
        </button>
        <button
          className="primary-button"
          type="button"
          aria-describedby={finishExplanationId}
          disabled={!props.canFinish || props.isRouting}
          onClick={props.onFinish}
        >
          {props.isRouting ? "Routing…" : "Finish route"}
        </button>
      </ToolCardActions>
    </div>
  );
}
