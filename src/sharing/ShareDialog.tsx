import { useEffect, useRef, useState, type RefObject } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog';
import { StudioDialogActions, StudioDialogBody, StudioDialogButton, StudioDialogHeader, StudioDialogSection } from '../components/ui/studio-dialog';
import { createEmbedHtml, createShareUrl } from './urls';

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
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="share-dialog" finalFocus={returnFocusRef}>
      <StudioDialogBody>
        <StudioDialogHeader><div>
          <DialogTitle>Share this map</DialogTitle>
          <DialogDescription>A read-only snapshot, with no account or upload. Later edits do not change this link.</DialogDescription>
        </div></StudioDialogHeader>
        <p>Anyone with the link can view, download and remix all included data and images. Links are not encrypted or revocable. Do not share private information.</p>
        {'error' in output ? <p role="alert">{output.error}</p> : <>
          <StudioDialogSection>
            <label htmlFor="share-link">Read-only link</label>
            <textarea id="share-link" readOnly value={output.link} rows={3} onFocus={(event) => event.currentTarget.select()} />
            <StudioDialogButton variant="secondary" onClick={() => void copy(output.link)}>Copy link</StudioDialogButton>
          </StudioDialogSection>
          <StudioDialogSection>
            <h3>Embed this map</h3>
            <label><input type="checkbox" checked={navigation} onChange={(event) => { request.current += 1; setFeedback(null); setNavigation(event.target.checked); }} /> Allow preview pan and zoom</label>
            <label htmlFor="embed-height">Embed height (pixels)</label>
            <input id="embed-height" type="number" min={240} max={2000} value={height} onChange={(event) => { request.current += 1; setFeedback(null); setHeight(event.currentTarget.value); }} />
            <label htmlFor="embed-code">Embed HTML</label>
            {'error' in embed ? <p role="alert">{embed.error}</p> : <>
              <textarea id="embed-code" readOnly value={embed.html} rows={4} onFocus={(event) => event.currentTarget.select()} />
              <StudioDialogButton variant="secondary" onClick={() => void copy(embed.html)}>Copy embed code</StudioDialogButton>
            </>}
            <p>Responsive width, map attribution retained. Preview navigation never changes the shared design.</p>
          </StudioDialogSection>
        </>}
        {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
      </StudioDialogBody>
      <StudioDialogActions><StudioDialogButton onClick={onClose}>Done</StudioDialogButton></StudioDialogActions>
    </DialogContent>
  </Dialog>;
}
