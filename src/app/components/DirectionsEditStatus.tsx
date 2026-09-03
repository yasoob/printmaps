import { memo } from "react";

export const DirectionsEditStatus = memo(function DirectionsEditStatus({
  error,
  isRouting,
  onCancel,
  onRetry,
}: {
  error?: string | null;
  isRouting?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
}) {
  return (
    <>
      {isRouting ? <p role="status">Finding an updated road route…</p> : null}
      {error ? (
        <div className="isochrone-error" role="alert">
          <p>{error}</p>
          <div className="route-vertex-actions">
            <button type="button" onClick={onRetry}>Retry</button>
            <button type="button" onClick={onCancel}>Cancel edit</button>
          </div>
        </div>
      ) : null}
    </>
  );
});
