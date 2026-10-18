import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

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
      {isRouting ? <Notice tone="info">Finding an updated road route…</Notice> : null}
      {error ? (
        <Notice tone="error">
          <p>{error}</p>
          <div className="route-vertex-actions">
            <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel edit</Button>
          </div>
        </Notice>
      ) : null}
    </>
  );
});
