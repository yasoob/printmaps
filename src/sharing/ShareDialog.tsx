import { useEffect, useRef, useState, type RefObject } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog';
import { Copy, Lock, X } from 'lucide-react';
import { StudioDialogActions, StudioDialogBody, StudioDialogButton, StudioDialogHeader } from '../components/ui/studio-dialog';
import { PropertyRow } from '../app/components/PropertyControls';
import { Switch } from '../app/components/UiControls';
import { createEmbedHtml, createShareUrl } from './urls';
import { FeatureHelp } from '../app/components/FeatureHelp';

type ShareResult = { payload: string; title: string } | { error: string };

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
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);
  const output = shareOutput(result, navigation);
  const embed = embedOutput(output, height);
  const copy = async (text: string) => {
    const id = ++request.current;
    try {
      const clipboard = window.navigator.clipboard;
      if (!clipboard?.writeText) throw new Error('Clipboard access is unavailable. Select and copy the text manually.');
      await clipboard.writeText(text);
      if (request.current === id) setFeedback({ error: false, text: 'Copied to clipboard.' });
    } catch (error) {
      if (request.current === id) setFeedback({ error: true, text: error instanceof Error ? error.message : 'Copy failed. Select and copy the text manually.' });
    }
  };
  const changeEmbed = (update: () => void) => { request.current += 1; setFeedback(null); update(); };
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent ref={dialogRef} initialFocus={dialogRef} className="share-dialog" finalFocus={returnFocusRef} showCloseButton={false}>
      <StudioDialogHeader>
        <div>
          <div className="feature-help-row"><DialogTitle>Share this map</DialogTitle><FeatureHelp label="Share snapshot help">A read-only snapshot, with no account or upload. Later edits do not change this link.</FeatureHelp></div>
          <DialogDescription>Anyone with the link can view, download and remix.</DialogDescription>
        </div>
        <button className="icon-button close-button" type="button" aria-label="Close share" onClick={onClose}><X size={16} /></button>
      </StudioDialogHeader>
      <StudioDialogBody className="share-dialog-body">
        <div className="share-privacy-note">
          <Lock size={14} strokeWidth={1.8} aria-hidden="true" />
          <span>Not private. Links cannot be revoked.</span>
          <FeatureHelp label="Share privacy help">Anyone with the link can access all included data and images. Links are not encrypted. Do not share private information.</FeatureHelp>
        </div>
        {'error' in output ? <p role="alert" className="export-error">{output.error}</p> : <>
          <section className="share-section">
            <label className="share-section-title" htmlFor="share-link">Read-only link</label>
            <div className="share-copy-row">
              <input id="share-link" readOnly value={output.link} onFocus={(event) => event.currentTarget.select()} />
              <StudioDialogButton variant="secondary" aria-label="Copy link" onClick={() => void copy(output.link)}><Copy size={14} strokeWidth={1.8} aria-hidden="true" />Copy</StudioDialogButton>
            </div>
          </section>
          <section className="share-section" aria-labelledby="share-embed-title">
            <div className="feature-help-row"><h3 id="share-embed-title">Embed this map</h3><FeatureHelp label="Embed preview help">Responsive width, map attribution retained. Preview pan and zoom never changes the shared design.</FeatureHelp></div>
            <Switch className="share-switch" label="Allow preview pan and zoom" isChecked={navigation} onCheckedChange={(checked) => changeEmbed(() => setNavigation(checked))} />
            <PropertyRow label="Height">
              <span className="number-field">
                <input id="embed-height" aria-label="Embed height (pixels)" inputMode="numeric" value={height} onChange={(event) => { const next = event.currentTarget.value; changeEmbed(() => setHeight(next)); }} />
                <small>px</small>
              </span>
            </PropertyRow>
            {'error' in embed ? <p role="alert" className="export-error">{embed.error}</p> : <>
              <textarea id="embed-code" aria-label="Embed HTML" className="share-code" readOnly value={embed.html} rows={4} onFocus={(event) => event.currentTarget.select()} />
              <StudioDialogButton variant="secondary" className="share-copy-embed" onClick={() => void copy(embed.html)}><Copy size={14} strokeWidth={1.8} aria-hidden="true" />Copy embed code</StudioDialogButton>
            </>}
          </section>
        </>}
        {feedback && <p className={feedback.error ? 'export-error' : 'share-feedback'} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
      </StudioDialogBody>
      <StudioDialogActions><StudioDialogButton onClick={onClose}>Done</StudioDialogButton></StudioDialogActions>
    </DialogContent>
  </Dialog>;
}
