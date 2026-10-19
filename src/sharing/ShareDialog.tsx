import { useEffect, useRef, useState, type RefObject } from 'react';
import { Check, Copy } from 'lucide-react';
import { Dialog } from '../components/ui/dialog';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '../components/ui/input-group';
import { Textarea } from '../components/ui/textarea';
import { Notice } from '../components/ui/notice';
import { StudioDialog, StudioDialogActions, StudioDialogBody, StudioDialogButton, StudioDialogHeader } from '../components/ui/studio-dialog';
import { PropertyRow } from '../app/components/PropertyControls';
import { Switch } from '../app/components/UiControls';
import { createEmbedHtml, createShareUrl } from './urls';
import { FeatureHelp } from '../app/components/FeatureHelp';

type ShareResult = { payload: string; title: string } | { error: string };
type CopyTarget = 'link' | 'embed';
type CopyFeedback = Readonly<{ target: CopyTarget; error?: string }>;
const COPIED_RESET_MS = 2000;

// Copy confirmation lives on the button itself ("Copied" + check), so no loose status line is needed.
function CopyButton({ label, state, onCopy }: Readonly<{ label: string; state: 'idle' | 'copied'; onCopy: () => void }>) {
  const isCopied = state === 'copied';
  return (
    <InputGroupButton variant="secondary" size="sm" className="share-copy-button" aria-label={label} data-state={state} onClick={onCopy}>
      {isCopied ? <Check aria-hidden="true" size={16} strokeWidth={1.75} /> : <Copy aria-hidden="true" size={16} strokeWidth={1.75} />}
      {isCopied ? 'Copied' : 'Copy'}
    </InputGroupButton>
  );
}

function shareOutput(result: ShareResult, canNavigate: boolean) {
  if ('error' in result) return result;
  try {
    const link = createShareUrl(result.payload, { embedded: false, navigation: true });
    const embedUrl = createShareUrl(result.payload, { embedded: true, navigation: canNavigate });
    return { link, embedUrl, title: result.title };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'The share link could not be created.' };
  }
}

function embedOutput(output: ReturnType<typeof shareOutput>, height: string) {
  if ('error' in output) return { error: output.error };
  try {
    return { html: createEmbedHtml(output.embedUrl, output.title, Number(height)) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'The embed code could not be created.' };
  }
}

export function ShareDialog({ result, onClose, returnFocusRef }: {
  result: ShareResult;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [navigation, setNavigation] = useState(true);
  const [height, setHeight] = useState('480');
  const [feedback, setFeedback] = useState<CopyFeedback | null>(null);
  const request = useRef(0);
  const resetTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => { request.current += 1; window.clearTimeout(resetTimer.current); }, []);
  const output = shareOutput(result, navigation);
  const embed = embedOutput(output, height);
  const copy = async (target: CopyTarget, text: string) => {
    const id = ++request.current;
    window.clearTimeout(resetTimer.current);
    try {
      const clipboard = window.navigator.clipboard;
      if (!clipboard?.writeText) throw new Error('Clipboard access is unavailable. Select and copy the text manually.');
      await clipboard.writeText(text);
      if (request.current !== id) return;
      setFeedback({ target });
      resetTimer.current = window.setTimeout(() => { if (request.current === id) setFeedback(null); }, COPIED_RESET_MS);
    } catch (error) {
      if (request.current === id) setFeedback({ target, error: error instanceof Error ? error.message : 'Copy failed. Select and copy the text manually.' });
    }
  };
  const clearCopyFeedback = () => { request.current += 1; window.clearTimeout(resetTimer.current); setFeedback(null); };
  const copyState = (target: CopyTarget) => (feedback?.target === target && !feedback.error ? 'copied' : 'idle');
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <StudioDialog ref={dialogRef} initialFocus={dialogRef} className="share-dialog" finalFocus={returnFocusRef}>
      <StudioDialogHeader title="Share this map" description="Anyone with the link can view, download and remix."
        help={<FeatureHelp label="Share snapshot help">A read-only snapshot, with no account or upload. Later edits do not change this link.</FeatureHelp>} />
      <StudioDialogBody className="share-dialog-body">
        <Notice tone="warning" role="note" title="Not private. Links cannot be revoked."
          action={<FeatureHelp label="Share privacy help">Anyone with the link can access all included data and images. Links are not encrypted. Do not share private information.</FeatureHelp>} />
        {'error' in output ? <Notice tone="error">{output.error}</Notice> : <>
          <section className="share-section">
            <label className="share-section-title" htmlFor="share-link">Read-only link</label>
            <InputGroup className="share-link-field">
              <InputGroupInput id="share-link" className="text-label text-ink-secondary text-ellipsis" readOnly value={output.link} onFocus={(event) => event.currentTarget.select()} />
              <InputGroupAddon align="inline-end">
                <CopyButton label="Copy link" state={copyState('link')} onCopy={() => void copy('link', output.link)} />
              </InputGroupAddon>
            </InputGroup>
            {feedback?.target === 'link' && feedback.error && <Notice tone="error">{feedback.error}</Notice>}
          </section>
          <section className="share-section" aria-labelledby="share-embed-title">
            <div className="feature-help-row"><h3 id="share-embed-title" className="share-section-title">Embed this map</h3><FeatureHelp label="Embed preview help">Responsive width, map attribution retained. Preview pan and zoom never changes the shared design.</FeatureHelp></div>
            <Switch className="share-switch" label="Allow preview pan and zoom" labelPlacement="start" isChecked={navigation} onCheckedChange={(checked) => { clearCopyFeedback(); setNavigation(checked); }} />
            <PropertyRow label="Height">
              <InputGroup>
                <InputGroupInput id="embed-height" aria-label="Embed height (pixels)" inputMode="numeric" value={height} onChange={(event) => { clearCopyFeedback(); setHeight(event.currentTarget.value); }} />
                <InputGroupAddon align="inline-end">px</InputGroupAddon>
              </InputGroup>
            </PropertyRow>
            {'error' in embed ? <p role="alert" className="export-error">{embed.error}</p> : <>
              <div className="share-code-block">
                <Textarea id="embed-code" aria-label="Embed HTML" className="share-code h-28 [field-sizing:fixed] resize-none pr-24 font-mono text-meta text-ink-secondary break-all" readOnly value={embed.html} rows={5} onFocus={(event) => event.currentTarget.select()} />
                <CopyButton label="Copy embed code" state={copyState('embed')} onCopy={() => void copy('embed', embed.html)} />
              </div>
              {feedback?.target === 'embed' && feedback.error && <Notice tone="error">{feedback.error}</Notice>}
            </>}
          </section>
        </>}
        <p className="sr-only" role="status">{feedback && !feedback.error ? 'Copied to clipboard.' : ''}</p>
      </StudioDialogBody>
      <StudioDialogActions><StudioDialogButton onClick={onClose}>Done</StudioDialogButton></StudioDialogActions>
    </StudioDialog>
  </Dialog>;
}
