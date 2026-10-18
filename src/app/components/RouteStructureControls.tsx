import { PropertyRow } from './PropertyControls';
import { Button } from '../../components/ui/button';
import type { ContentLayer, RouteKind } from "../../domain/project";
import { semanticRoutePoints } from "../../domain/routeModel";
import {
  ROAD_TRAVEL_MODES,
  ROAD_TRAVEL_MODE_LABELS,
} from "../../domain/routeProfiles";
import type { DirectionsProvider } from "../../services/mapbox/contracts";
import { useRouteTransformOperations } from "../hooks/useRouteTransformOperations";
import type { ProjectState } from "../store";
import { memo } from "react";
import { useStableEvent } from "../hooks/useStableEvent";

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

function operationLabel(isRoad: boolean, operation: ActiveOperation): string {
  if (operation.type === "convert") {
    return `convert to ${ROUTE_KIND_LABELS[operation.targetKind]}`;
  }
  if (operation.type === "close") return "close this loop";
  if (operation.type === "open") return "open this loop";
  return isRoad ? "reverse this Road route" : "reverse this route";
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
      <PropertyRow label="Convert to">
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
      </PropertyRow>
      {operation.targetKind === "road" ? (
        <PropertyRow label="Travel mode">
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
        </PropertyRow>
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
      <Button variant="secondary"
        disabled={isDisabled || operation.targetKind === layer.route?.kind}
        onClick={operation.beginConvert}
      >
        Convert
      </Button>
      <div className="route-structure-actions">
        <Button variant="secondary" disabled={isDisabled} onClick={operation.beginReverse}>
          Reverse
        </Button>
        <RouteLoopAction
          isDisabled={isDisabled}
          layer={layer}
          operation={operation}
          pointCount={pointCount}
        />
      </div>
      <RouteCloseReason id={layer.id} message={closeReason({ layer, pointCount })} />
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
      <Button variant="secondary" disabled={isDisabled} onClick={operation.beginOpen}>
        Open loop
      </Button>
    );
  }
  const closeReasonId = `${layer.id}-close-loop-reason`;
  const isTooShort = pointCount < 3;
  const isOverClosedRoadLimit = layer.route?.kind === "road" && pointCount > 24;
  return (
    <Button variant="secondary"
      aria-describedby={isTooShort || isOverClosedRoadLimit ? closeReasonId : undefined}
      disabled={isDisabled || isTooShort || isOverClosedRoadLimit}
      onClick={operation.beginClose}
    >
      Close loop
    </Button>
  );
}

function closeReason({
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
  return message;
}

const RouteCloseReason = memo(function RouteCloseReason({ id, message }: { id: string; message: string | null }) {
  return message ? <small id={`${id}-close-loop-reason`} className="route-close-reason">{message}</small> : null;
});

const RouteOperationStatus = memo(function RouteOperationStatus({ isRoad, state, cancel, confirm, retry }: {
  isRoad: boolean; state: RouteOperation["state"]; cancel: () => void; confirm: () => void; retry: () => void;
}) {
  if (!state) return null;
  const label = operationLabel(isRoad, state.operation);
  if (state.phase === "confirming") {
    return (
      <div className="route-structure-confirmation" role="group" aria-label="Confirm road routing">
        <p>
          Mapbox must calculate the roads to {label}. The route changes only after
          routing succeeds.
        </p>
        <div>
          <Button variant="ghost" onClick={cancel}>Cancel</Button>
          <Button variant="primary" onClick={confirm}>
            Route and apply
          </Button>
        </div>
      </div>
    );
  }
  if (state.phase === "routing") {
    return (
      <div className="route-structure-progress">
        <p role="status">Finding roads to {label}…</p>
        <Button variant="ghost" onClick={cancel}>Cancel routing</Button>
      </div>
    );
  }
  return (
    <div className="route-structure-error" role="alert">
      <p>{state.error}</p>
      <div>
        <Button variant="secondary" onClick={retry}>Retry</Button>
        <Button variant="ghost" onClick={cancel}>Cancel</Button>
      </div>
    </div>
  );
});

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
  const cancel = useStableEvent(operation.cancel);
  const confirm = useStableEvent(operation.confirm);
  const retry = useStableEvent(operation.retry);
  return (
    <div className="route-structure-controls">
      <RouteConversionFields isDisabled={isDisabled} operation={operation} />
      <RouteStructureActions
        isDisabled={isDisabled}
        layer={layer}
        operation={operation}
        pointCount={pointCount}
      />
      <RouteOperationStatus isRoad={layer.route?.kind === "road"} state={operation.state} cancel={cancel} confirm={confirm} retry={retry} />
    </div>
  );
}
