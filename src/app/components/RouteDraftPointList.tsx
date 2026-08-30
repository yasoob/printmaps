import { ChevronDown, ChevronUp, Crosshair, Trash2 } from "lucide-react";
import type { RouteDrawingPanelProps } from "./RouteDrawingPanel";

type DraftPointListProps = Pick<
  RouteDrawingPanelProps,
  | "closed"
  | "isRouting"
  | "minimumPointCount"
  | "onFocusPoint"
  | "onMovePointDown"
  | "onMovePointUp"
  | "onRemovePoint"
  | "points"
>;

function focusAfterRemoval(index: number, remainingCount: number) {
  window.setTimeout(() => {
    const nextIndex = Math.min(index, remainingCount - 1);
    const next = [...document.querySelectorAll<HTMLElement>(
      "[data-draft-focus-index]",
    )].find((element) => element.dataset.draftFocusIndex === String(nextIndex))
      ?? document.querySelector<HTMLElement>(".route-draft-points > summary");
    next?.focus();
  }, 0);
}

export function RouteDraftPointList(props: DraftPointListProps) {
  return (
    <details className="route-draft-points">
      <summary>Draft points ({props.points.length})</summary>
      <ol className="route-point-list" aria-label="Draft route points">
        {props.points.map(([longitude, latitude], index) => (
          <li key={`${longitude},${latitude}`} className="route-point-row">
            <span className="route-point-coordinate">
              <span>Point {index + 1}: {longitude}, {latitude}</span>
            </span>
            <span className="route-point-actions">
              <button
                type="button"
                aria-label={`Focus draft point ${index + 1} on map`}
                data-draft-focus-index={index}
                onClick={() => props.onFocusPoint(index)}
              >
                <Crosshair aria-hidden="true" size={14} />
              </button>
              <button
                type="button"
                aria-label={`Move draft point ${index + 1} up`}
                disabled={index === 0 || props.isRouting}
                onClick={() => props.onMovePointUp(index)}
              >
                <ChevronUp aria-hidden="true" size={14} />
              </button>
              <button
                type="button"
                aria-label={`Move draft point ${index + 1} down`}
                disabled={index === props.points.length - 1 || props.isRouting}
                onClick={() => props.onMovePointDown(index)}
              >
                <ChevronDown aria-hidden="true" size={14} />
              </button>
              <button
                type="button"
                aria-label={`Remove draft point ${index + 1}`}
                disabled={
                  props.points.length <= props.minimumPointCount
                  || props.isRouting
                }
                onClick={() => {
                  props.onRemovePoint(index);
                  focusAfterRemoval(index, props.points.length - 1);
                }}
              >
                <Trash2 aria-hidden="true" size={14} />
              </button>
            </span>
          </li>
        ))}
      </ol>
      {props.closed && (
        <small className="route-loop-note">
          The return leg closes back to point 1 automatically.
        </small>
      )}
    </details>
  );
}
