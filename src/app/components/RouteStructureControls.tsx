import type { ContentLayer, RouteKind } from "../../domain/project";
import { semanticRoutePoints } from "../../domain/routeModel";
import {
  ROAD_TRAVEL_MODES,
  ROAD_TRAVEL_MODE_LABELS,
} from "../../domain/routeProfiles";
import type { DirectionsProvider } from "../../services/mapbox/contracts";
import { useRouteTransformOperations } from "../hooks/useRouteTransformOperations";
import type { ProjectState } from "../store";

const ROUTE_KIND_LABELS: Record<RouteKind, string> = {
  straight: "Straight",
  arc: "Arc",
  road: "Road",
};

type RouteStructureControlsProps = {
  directionsProvider?: DirectionsProvider;
  documentEpoch: number;
  layer: ContentLayer;
  onTransformRoute: ProjectState["transformRoute"];
};
type RouteOperation = ReturnType<typeof useRouteTransformOperations>;
type ActiveOperation = NonNullable<RouteOperation["state"]>["operation"];

function operationLabel(layer: ContentLayer, operation: ActiveOperation): string {
  if (operation.type === "convert") {
    return `convert to ${ROUTE_KIND_LABELS[operation.targetKind]}`;
  }
  if (operation.type === "close") return "close this loop";
  if (operation.type === "open") return "open this loop";
  return layer.route?.kind === "road" ? "reverse this Road route" : "reverse this route";
}

function RouteConversionFields({
  isDisabled,
  operation,
}: {
  isDisabled: boolean;
  operation: RouteOperation;
}) {
  return (
    <>
      <label>
        <span>Convert to</span>
        <select
          aria-label="Convert route to"
          disabled={isDisabled}
          value={operation.targetKind}
          onChange={(event) => operation.setTargetKind(event.target.value as RouteKind)}
        >
          {Object.entries(ROUTE_KIND_LABELS).map(([kind, label]) => (
            <option key={kind} value={kind}>{label}</option>
          ))}
        </select>
      </label>
      {operation.targetKind === "road" ? (
        <label>
          <span>Road travel mode</span>
          <select
            aria-label="Road conversion travel mode"
            disabled={isDisabled}
            value={operation.roadTravelMode}
            onChange={(event) =>
              operation.setRoadTravelMode(
                event.target.value as typeof operation.roadTravelMode,
              )
            }
          >
            {ROAD_TRAVEL_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {ROAD_TRAVEL_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </>
  );
}

function RouteStructureActions({
  isDisabled,
  layer,
  operation,
  pointCount,
}: {
  isDisabled: boolean;
  layer: ContentLayer;
  operation: RouteOperation;
  pointCount: number;
}) {
  return (
    <>
      <button
        type="button"
        disabled={isDisabled || operation.targetKind === layer.route?.kind}
        onClick={operation.beginConvert}
      >
        Convert
      </button>
      <div className="route-structure-actions">
        <button type="button" disabled={isDisabled} onClick={operation.beginReverse}>
          Reverse
        </button>
        <RouteLoopAction
          isDisabled={isDisabled}
          layer={layer}
          operation={operation}
          pointCount={pointCount}
        />
      </div>
      <RouteCloseReason layer={layer} pointCount={pointCount} />
    </>
  );
}

function RouteLoopAction({
  isDisabled,
  layer,
  operation,
  pointCount,
}: {
  isDisabled: boolean;
  layer: ContentLayer;
  operation: RouteOperation;
  pointCount: number;
}) {
  if (layer.route?.closed) {
    return (
      <button type="button" disabled={isDisabled} onClick={operation.beginOpen}>
        Open loop
      </button>
    );
  }
  const closeReasonId = `${layer.id}-close-loop-reason`;
  const isTooShort = pointCount < 3;
  const isOverClosedRoadLimit = layer.route?.kind === "road" && pointCount > 24;
  return (
    <button
      type="button"
      aria-describedby={isTooShort || isOverClosedRoadLimit ? closeReasonId : undefined}
      disabled={isDisabled || isTooShort || isOverClosedRoadLimit}
      onClick={operation.beginClose}
    >
      Close loop
    </button>
  );
}

function RouteCloseReason({
  layer,
  pointCount,
}: {
  layer: ContentLayer;
  pointCount: number;
}) {
  if (layer.route?.closed) return null;
  let message: string | null = null;
  if (pointCount < 3) message = "Add at least three distinct points to close this route.";
  else if (layer.route?.kind === "road" && pointCount > 24) {
    message = "Closed Road routes support at most 24 distinct waypoints.";
  }
  if (!message) return null;
  return (
    <small id={`${layer.id}-close-loop-reason`} className="route-close-reason">
      {message}
    </small>
  );
}

function RouteOperationStatus({
  layer,
  operation,
}: {
  layer: ContentLayer;
  operation: RouteOperation;
}) {
  const state = operation.state;
  if (!state) return null;
  const label = operationLabel(layer, state.operation);
  if (state.phase === "confirming") {
    return (
      <div className="route-structure-confirmation" role="group" aria-label="Confirm road routing">
        <p>
          Mapbox must calculate the roads to {label}. The route changes only after
          routing succeeds.
        </p>
        <div>
          <button type="button" onClick={operation.cancel}>Cancel</button>
          <button className="primary-button" type="button" onClick={operation.confirm}>
            Route and apply
          </button>
        </div>
      </div>
    );
  }
  if (state.phase === "routing") {
    return (
      <div className="route-structure-progress">
        <p role="status">Finding roads to {label}…</p>
        <button type="button" onClick={operation.cancel}>Cancel routing</button>
      </div>
    );
  }
  return (
    <div className="route-structure-error" role="alert">
      <p>{state.error}</p>
      <div>
        <button type="button" onClick={operation.retry}>Retry</button>
        <button type="button" onClick={operation.cancel}>Cancel</button>
      </div>
    </div>
  );
}

export function RouteStructureControls({
  directionsProvider,
  documentEpoch,
  layer,
  onTransformRoute,
}: RouteStructureControlsProps) {
  const operation = useRouteTransformOperations({
    documentEpoch,
    layer,
    ...(directionsProvider && { provider: directionsProvider }),
    transformRoute: onTransformRoute,
  });
  const pointCount = (semanticRoutePoints(layer) ?? []).length
    - (layer.route?.closed ? 1 : 0);
  const isRouting = operation.state?.phase === "routing";
  const isDisabled = layer.locked || !layer.visible || isRouting;
  return (
    <div className="route-structure-controls">
      <RouteConversionFields isDisabled={isDisabled} operation={operation} />
      <RouteStructureActions
        isDisabled={isDisabled}
        layer={layer}
        operation={operation}
        pointCount={pointCount}
      />
      <RouteOperationStatus layer={layer} operation={operation} />
    </div>
  );
}
