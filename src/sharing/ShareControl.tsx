import { Share2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useProjectStoreApi } from '../app/projectStoreContext';
import { encodeSharedProject } from './codec';
import { ShareDialog } from './ShareDialog';
import './sharing.css';

export function ShareControl({ disabled }: { disabled: boolean }) {
  const store = useProjectStoreApi();
  const button = useRef<HTMLButtonElement>(null);
  const [result, setResult] = useState<{ payload: string; title: string } | { error: string } | null>(null);
  const share = () => {
    try {
      // Capture at the action, not during a later render or clipboard request.
      const document = store.getState().document;
      setResult({ payload: encodeSharedProject(document), title: document.title });
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'The share link could not be created.' });
    }
  };
  return <>
    <button ref={button} className="quiet-button share-button" type="button" disabled={disabled}
      title={disabled ? 'Finish or cancel map authoring before sharing' : undefined} onClick={share}>
      <Share2 size={14} strokeWidth={1.8} aria-hidden="true" /><span>Share</span>
    </button>
    {result && <ShareDialog result={result} onClose={() => setResult(null)} returnFocusRef={button} />}
  </>;
}
