import { Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ProjectDocument } from '../../domain/project';
import { createPortableProjectFile, downloadProjectDocument } from './projectDownload';

type ShareStatus = Readonly<{
  kind: 'success' | 'error';
  message: string;
}>;

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

export function ProjectShareButton({ document, fallbackDownload = downloadProjectDocument }: Readonly<{
  document: ProjectDocument;
  fallbackDownload?: (document: ProjectDocument) => void;
}>) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ShareStatus | null>(null);

  useEffect(() => {
    if (busy || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    const activeElement = globalThis.document.activeElement;
    if (
      activeElement !== null
      && activeElement !== globalThis.document.body
      && activeElement !== globalThis.document.documentElement
      && activeElement !== buttonRef.current
    ) return;
    buttonRef.current?.focus();
  }, [busy]);

  const shareProject = async () => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const file = createPortableProjectFile(document);
      const shareData: ShareData = {
        files: [file],
        text: 'Editable Print Map Studio project',
        title: document.title,
      };
      if (typeof globalThis.navigator.share !== 'function' || !globalThis.navigator.canShare?.(shareData)) {
        fallbackDownload(document);
        setStatus({ kind: 'success', message: 'Project file downloaded. Send it to share this editable map.' });
        return;
      }
      await globalThis.navigator.share(shareData);
      setStatus({ kind: 'success', message: 'Project shared.' });
    } catch (error) {
      setStatus(isAbortError(error)
        ? { kind: 'success', message: 'Sharing cancelled.' }
        : {
            kind: 'error',
            message: error instanceof Error ? error.message : 'This project could not be shared.',
          });
    } finally {
      restoreFocusRef.current = true;
      setBusy(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        className="quiet-button project-share-button"
        type="button"
        aria-label={busy ? 'Sharing project…' : 'Share'}
        disabled={busy}
        onClick={shareProject}
      >
        <Share2 aria-hidden="true" size={14} /> {busy ? 'Sharing…' : 'Share'}
      </button>
      {status && (
        <div
          className={`project-file-status${status.kind === 'error' ? ' is-error' : ''}`}
          role={status.kind === 'error' ? 'alert' : 'status'}
          aria-label="Project share status"
        >
          {status.message}
        </div>
      )}
    </>
  );
}
