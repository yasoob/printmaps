import {
  ChevronDown,
  Minus,
  Plus,
  Route,
  Spline,
  Undo2,
} from "lucide-react";
import {
  type RoadTravelMode,
  type RouteLineShape,
  type RouteTravelMarker,
} from "../../domain/routeProfiles";
import type { ContentLayer } from "../../domain/project";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/ui/select";
import { ROAD_TRAVEL_MODE_OPTIONS, TRAVEL_MARKER_OPTIONS } from "./routeSelectOptions";
import { Notice } from "@/components/ui/notice";
import { ToolSettingsButton } from "./ToolSettingsButton";
import { useAuthoringPanelDisclosure } from "../hooks/useAuthoringPanelDisclosure";
import { RoutePointInputs } from "./RoutePointInputs";
import { ToolCardActions, ToolCardHeader } from "./ToolAuthoringCard";
import { RouteDraftPointList } from "./RouteDraftPointList";
import { PropertyRow } from "./PropertyControls";
import type { RoutePointInput } from "../hooks/useRoutePointInput";

export type RouteDrawingPanelProps = Readonly<{
  isCompactViewport: boolean;
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
  pointInput: RoutePointInput;
  pois: readonly ContentLayer[];
  snapEnabled: boolean;
  onLineShapeChange: (shape: RouteLineShape) => void;
  onRoadTravelModeChange: (mode: RoadTravelMode) => void;
  onTravelMarkerChange: (marker: RouteTravelMarker | null) => void;
  onAddPoint: (coordinate: readonly [number, number], label: string) => boolean;
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
  showRoadPreview: boolean;
  minimumPointCount: number;
}>;

const ROUTE_PATH_OPTIONS = [
  { value: "straight", label: "Straight", icon: Minus },
  { value: "arc", label: "Arc", icon: Spline },
  { value: "road", label: "Road", icon: Route },
] as const satisfies readonly SegmentedControlOption<RouteLineShape>[];

function RoutePathControl(props: RouteDrawingPanelProps) {
  return (
    <SegmentedControl
      label="Route path"
      value={props.lineShape}
      options={ROUTE_PATH_OPTIONS}
      disabled={props.isRouting || props.pathLocked}
      onValueChange={props.onLineShapeChange}
    />
  );
}

function RouteTravelControls(props: RouteDrawingPanelProps) {
  return (
    <>
      {props.lineShape === "road" && (
        <PropertyRow label="Travel mode">
          <SimpleSelect
            label="Road travel mode"
            disabled={props.isRouting}
            value={props.roadTravelMode}
            options={ROAD_TRAVEL_MODE_OPTIONS}
            onValueChange={props.onRoadTravelModeChange}
          />
        </PropertyRow>
      )}
      <PropertyRow label="Travel marker">
        <SimpleSelect
          label="Travel marker"
          disabled={props.isRouting}
          value={props.travelMarker ?? "none"}
          options={TRAVEL_MARKER_OPTIONS}
          onValueChange={(marker) => props.onTravelMarkerChange(marker === "none" ? null : marker)}
        />
      </PropertyRow>
    </>
  );
}

function RouteDraftStatus(props: RouteDrawingPanelProps) {
  const pointLabel = props.pointCount === 1 ? "point" : "points";
  let status = `${props.pointCount} ${pointLabel} added · Finish when ready`;
  if (props.isRouting) status = "Finding the road route…";
  else if (props.pointCount === 0) status = "Click the map to add route points";
  return (
    <div className="route-progress">
      <span role="status" aria-label="Route drawing status">{status}</span>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Undo last route point"
        disabled={!props.canUndo || props.isRouting}
        onClick={props.onUndo}
      >
        <Undo2 aria-hidden="true" size={16} strokeWidth={1.75} />
        <span>Undo point</span>
      </Button>
    </div>
  );
}

function RouteDrawingActions({
  finishExplanationId,
  props,
}: Readonly<{
  finishExplanationId: string;
  props: RouteDrawingPanelProps;
}>) {
  const finishLabel = props.isRouting ? "Routing…" : "Finish route";
  const compactFinishLabel = props.isRouting ? "Routing…" : "Finish";
  return (
    <ToolCardActions>
      <Button variant="ghost" aria-label="Cancel route" onClick={props.onCancel}>
        Cancel
      </Button>
      <Button
        variant="primary"
        aria-label="Finish route"
        aria-describedby={finishExplanationId}
        disabled={!props.canFinish || props.isRouting}
        onClick={props.onFinish}
      >
        <span className="route-finish-full" aria-hidden="true">
          {finishLabel}
        </span>
        <span className="route-finish-compact" aria-hidden="true">
          {compactFinishLabel}
        </span>
      </Button>
    </ToolCardActions>
  );
}

function compactRouteSummary(pointCount: number) {
  if (pointCount === 0) return "Add route points";
  return `${pointCount} ${pointCount === 1 ? "point" : "points"}`;
}

export function RouteDrawingPanel(props: RouteDrawingPanelProps) {
  const finishExplanationId = "route-finish-explanation";
  const disclosure = useAuthoringPanelDisclosure(props.pointCount, props.isCompactViewport);
  const compactSummary = compactRouteSummary(props.pointCount);

  return (
    <div
      className="map-authoring-panel tool-authoring-card route-authoring-panel"
      data-settings-expanded={disclosure.settingsOpen}
    >
      <ToolCardHeader
        closeLabel="Close Route menu"
        collapse={{ label: "Hide route settings", onCollapse: disclosure.closeSettings }}
        icon={Route}
        onClose={props.onCancel}
        title={props.title ?? "Route"}
      />
      {!disclosure.settingsOpen && (
        <>
          <p className="tool-compact-summary" aria-hidden="true">{compactSummary}</p>
          <ToolSettingsButton buttonRef={disclosure.settingsButtonRef} label="Show route settings" onOpen={disclosure.openSettings} />
        </>
      )}
      <div className="route-authoring-settings">
        <RoutePathControl {...props} />
        <RouteTravelControls {...props} />
        <details className="route-point-sources">
          <summary>
            <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
            <span>Add by coordinates or place</span>
            <ChevronDown className="route-disclosure-chevron" aria-hidden="true" size={14} strokeWidth={1.8} />
          </summary>
          <RoutePointInputs
            disabled={props.isRouting}
            pointInput={props.pointInput}
            onAdd={props.onAddPoint}
            onSnapChange={props.onSnapChange}
            pois={props.pois}
            snapEnabled={props.snapEnabled}
          />
        </details>
        {props.points.length > 0 && <RouteDraftPointList {...props} />}
        {props.showRoadPreview && props.lineShape === "road" && props.points.length >= 2 && (
          <Button
            className="route-preview-button"
            variant="secondary"
            busy={props.isRouting}
            onClick={props.onPreviewRoad}
          >
            {props.isRouting
              ? "Previewing…"
              : (props.hasRoadPreview ? "Refresh road preview" : "Preview road")}
          </Button>
        )}
      </div>
      <RouteDraftStatus {...props} />
      {props.announcement && (
        <div className="route-announcement" role="status" aria-live="polite">
          {props.announcement}
        </div>
      )}
      {props.error && <Notice tone="error">{props.error}</Notice>}
      <small id={finishExplanationId} className="route-finish-explanation">
        {props.finishExplanation}
      </small>
      <RouteDrawingActions
        finishExplanationId={finishExplanationId}
        props={props}
      />
    </div>
  );
}
