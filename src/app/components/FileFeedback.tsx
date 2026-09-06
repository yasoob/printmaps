import { createContext, useContext, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { isInteractiveElement } from '../../lib/focus';

type FeedbackHosts = { error: HTMLDivElement | null; success: HTMLDivElement | null };
const FeedbackContext = createContext<FeedbackHosts | null>(null);

export function FileFeedbackGroup({ children }: { children: ReactNode }) {
  const [error, setError] = useState<HTMLDivElement | null>(null);
  const [success, setSuccess] = useState<HTMLDivElement | null>(null);
  const hosts = useMemo(() => ({ error, success }), [error, success]);
  return <FeedbackContext value={hosts}>
    {children}
    <div className="file-feedback-stack" role="region" aria-label="File notifications">
      <div className="file-feedback-priority" ref={setError} />
      <div className="file-feedback-priority" ref={setSuccess} />
    </div>
  </FeedbackContext>;
}

export function FileFeedback({ kind, label, message, onDismiss, returnFocusRef }: {
  kind: 'error' | 'success';
  label: string;
  message: string;
  onDismiss: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const hosts = useContext(FeedbackContext);
  const notice = <div className={`project-file-status${kind === 'error' ? ' is-error' : ''}`} role={kind === 'error' ? 'alert' : 'status'} aria-label={label}>
    <span>{message}</span>
    <button type="button" className="project-file-status-dismiss" aria-label={`Dismiss ${label.toLowerCase()}`} onClick={(event) => {
      const target = returnFocusRef.current;
      if (target && document.activeElement === event.currentTarget && isInteractiveElement(target)) target.focus();
      onDismiss();
    }}><X size={16} aria-hidden="true" /></button>
  </div>;
  const host = hosts?.[kind];
  return host ? createPortal(notice, host) : notice;
}
