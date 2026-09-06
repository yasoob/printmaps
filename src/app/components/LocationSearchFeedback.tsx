import { X } from 'lucide-react';
import { useId } from 'react';

export type SearchSelectionFeedback = {
  message: string;
  onDismiss: () => void;
  action?: {
    label: string;
    onInvoke: () => void;
    disabledReason?: string;
  };
};

export function LocationSearchFeedback({ feedback }: {
  feedback: SearchSelectionFeedback;
}) {
  const reasonId = useId();
  const action = feedback.action;
  return (
    <div className="location-search-status location-search-feedback">
      <span>{feedback.message}</span>
      <div className="location-search-feedback-actions">
        {action && (
          <button
            type="button"
            disabled={Boolean(action.disabledReason)}
            aria-describedby={action.disabledReason ? reasonId : undefined}
            onClick={action.onInvoke}
          >{action.label}</button>
        )}
        <button type="button" aria-label="Dismiss place confirmation" onClick={feedback.onDismiss}>
          <X aria-hidden="true" size={16} />
        </button>
      </div>
      {action?.disabledReason && <small id={reasonId}>{action.disabledReason}</small>}
    </div>
  );
}
