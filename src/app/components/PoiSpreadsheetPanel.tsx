import { ListPlus } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MAX_POI_ADDRESS_ROWS, MAX_POI_SPREADSHEET_CHARACTERS, MAX_POI_SPREADSHEET_ROWS, type PoiSpreadsheetEntry } from '../../domain/poiSpreadsheet';
import type { SearchProvider } from '../../services/mapbox/contracts';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { usePoiSpreadsheet } from '../hooks/usePoiSpreadsheet';
import { usePoiSpreadsheetSurface } from '../hooks/usePoiSpreadsheetSurface';
import { hasPoiSpreadsheetWork, visiblePoiSpreadsheetAnnouncement } from '../hooks/poiSpreadsheetDraft';
import type { PoiSpreadsheetRegistration } from '../hooks/poiSpreadsheetController';
import { useStableEvent } from '../hooks/useStableEvent';
import { ToolCardActions, ToolCardHeader } from './ToolAuthoringCard';
import { PoiAddressReview } from './PoiAddressReview';

type PoiSpreadsheetPanelProps = {
  documentEpoch: number;
  onCancel: () => void;
  onComplete: () => void;
  onSubmit: (entries: readonly PoiSpreadsheetEntry[]) => ProjectMutationResult;
  onChangeTool?: (tool: string) => void;
  registration?: PoiSpreadsheetRegistration;
  searchProvider?: SearchProvider;
};

type DiscardRequest = { documentEpoch: number; nextTool: string; onApproved?: () => ProjectMutationResult };

function useSpreadsheetExit(model: ReturnType<typeof usePoiSpreadsheet>, props: PoiSpreadsheetPanelProps) {
  const [pending, setPending] = useState<DiscardRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<DiscardRequest | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const shouldRestoreRef = useRef(false);
  const request = useStableEvent((nextTool: string, onApproved?: () => ProjectMutationResult) => {
    model.stopLookup();
    const draft = model.getCurrent();
    if (!draft || !hasPoiSpreadsheetWork(draft)) { props.onCancel(); return; }
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    shouldRestoreRef.current = false;
    pendingRef.current = { documentEpoch: props.documentEpoch, nextTool, onApproved };
    setError(null);
    setPending(pendingRef.current);
  });
  const requestToolChange = useStableEvent((tool: string, onApproved?: () => ProjectMutationResult) => {
    const draft = model.getCurrent();
    if (tool === 'pin' || !draft || !hasPoiSpreadsheetWork(draft)) return true;
    request(tool, onApproved);
    return false;
  });
  const controller = useMemo(() => ({
    documentEpoch: props.documentEpoch, requestToolChange, retire: model.retireLookup,
  }), [model.retireLookup, props.documentEpoch, requestToolChange]);
  useLayoutEffect(() => props.registration?.register(controller), [controller, props.registration]);
  useLayoutEffect(() => { props.registration?.reportWork(controller, model.hasWork); }, [controller, model.hasWork, props.registration]);
  useLayoutEffect(() => () => { pendingRef.current = null; shouldRestoreRef.current = false; }, []);
  const keepEditing = () => {
    shouldRestoreRef.current = true;
    pendingRef.current = null;
    setPending(null);
  };
  const discard = () => {
    const decision = pendingRef.current;
    if (!decision || decision.documentEpoch !== props.documentEpoch) return;
    if (decision.onApproved) {
      const result = decision.onApproved();
      if (!result.ok) {
        setError(result.error);
        return;
      }
    }
    pendingRef.current = null;
    shouldRestoreRef.current = false;
    model.discard();
    setPending(null);
    if (!decision.onApproved) {
      if (decision.nextTool === 'menu') props.onCancel();
      else props.onChangeTool?.(decision.nextTool);
    }
  };
  return {
    isOpen: pending?.documentEpoch === props.documentEpoch, error,
    cancel: () => request('menu'), keepEditing, discard,
    finalFocus: () => shouldRestoreRef.current && returnFocusRef.current?.isConnected ? returnFocusRef.current : false as const,
  };
}

function SpreadsheetDiscardDialog({ exit }: { exit: ReturnType<typeof useSpreadsheetExit> }) {
  const keepRef = useRef<HTMLButtonElement>(null);
  return <Dialog open onOpenChange={(open) => { if (!open) exit.keepEditing(); }}>
    <DialogContent className="poi-spreadsheet-discard-dialog route-discard-dialog" overlayClassName="route-discard-backdrop" showCloseButton={false} initialFocus={keepRef} finalFocus={exit.finalFocus}>
      <DialogTitle>Discard unadded POI lists?</DialogTitle>
      <DialogDescription>Both pasted lists and their lookup suggestions will be lost. They are not saved or included in project downloads. Completed layers stay unchanged.</DialogDescription>
      {exit.error && <p role="alert">{exit.error}</p>}
      <div className="route-discard-actions">
        <button ref={keepRef} type="button" onClick={exit.keepEditing}>Keep editing lists</button>
        <button type="button" className="primary-button" onClick={exit.discard}>Discard lists</button>
      </div>
    </DialogContent>
  </Dialog>;
}

type Spreadsheet = ReturnType<typeof usePoiSpreadsheet>;
function focusReviewedRows(body: HTMLDivElement | null) {
  const rows = body?.querySelector(':scope .poi-address-review ol');
  if (!body || !rows) return;
  body.scrollTop += rows.getBoundingClientRect().top - body.getBoundingClientRect().top;
  body.focus({ preventScroll: true });
}

function useSpreadsheetFocus(isReview: boolean, rows: Spreadsheet['draft']['rows'], bodyRef: RefObject<HTMLDivElement | null>, textareaRef: RefObject<HTMLTextAreaElement | null>) {
  const pendingRef = useRef<'review' | 'text' | null>(null);
  useLayoutEffect(() => {
    const target = pendingRef.current;
    if (target === 'review' && isReview) {
      pendingRef.current = null;
      focusReviewedRows(bodyRef.current);
    } else if (target === 'text' && !isReview) {
      pendingRef.current = null;
      textareaRef.current?.focus();
    }
  }, [bodyRef, isReview, rows, textareaRef]);
  return (target: 'review' | 'text') => { pendingRef.current = target; };
}

function SpreadsheetSource({ model }: { model: Spreadsheet }) {
  const isAddressMode = model.draft.mode === 'addresses';
  return <>
    {(!isAddressMode || model.draft.addressView === 'edit') && <div className="poi-spreadsheet-intro">
      <span className="tool-control-label">Source data</span>
      <p>{isAddressMode ? `Look up up to ${MAX_POI_ADDRESS_ROWS} address rows, then review before adding.` : `Paste up to ${MAX_POI_SPREADSHEET_ROWS} tab-separated rows.`}</p>
      <p>Unadded lists stay only in this tab. They are not saved or downloaded and will be lost on reload.</p>
    </div>}
    <fieldset className="poi-spreadsheet-mode">
      <legend>Location columns</legend>
      <label><input type="radio" name="poi-spreadsheet-mode" checked={!isAddressMode} onChange={() => model.changeMode('coordinates')} /> Coordinates</label>
      <label><input type="radio" name="poi-spreadsheet-mode" checked={isAddressMode} onChange={() => model.changeMode('addresses')} /> Addresses</label>
    </fieldset>
  </>;
}

function SpreadsheetContent({ model, textareaRef, bodyRef, requestFocus }: {
  model: Spreadsheet;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  bodyRef: RefObject<HTMLDivElement | null>;
  requestFocus: (target: 'review' | 'text') => void;
}) {
  const { draft } = model;
  const isAddressMode = draft.mode === 'addresses';
  if (isAddressMode && draft.addressView === 'review') return <>
    <PoiAddressReview model={model} onPageChange={(page) => {
      model.setPage(page);
      focusReviewedRows(bodyRef.current);
    }} />
    <button type="button" onClick={() => { requestFocus('text'); model.backToEdit(); }}>Back to pasted rows</button>
  </>;
  const error = draft.errors[draft.mode];
  return <>
    <label htmlFor="poi-spreadsheet-rows">{isAddressMode ? 'Name · Address' : 'Name · Longitude · Latitude'}</label>
    <textarea ref={textareaRef} id="poi-spreadsheet-rows" aria-label="POI spreadsheet rows" aria-invalid={Boolean(error)} aria-describedby={error ? 'poi-spreadsheet-error' : undefined} maxLength={MAX_POI_SPREADSHEET_CHARACTERS} placeholder={isAddressMode ? 'Name\tAddress\nCafé Central\tHerrengasse 14, Vienna' : 'Name\tLongitude\tLatitude\nCafé Central\t16.3725\t48.2084'} value={draft.buffers[draft.mode]} onChange={(event) => model.changeText(event.target.value)} />
    {isAddressMode && draft.rows.length > 0 && <>
      <p>Your pasted text is unchanged. Row corrections and choices are kept in review. Editing this text starts a new review.</p>
      <button type="button" onClick={() => { requestFocus('review'); model.returnToReview(); }}>Return to review</button>
    </>}
  </>;
}

function SpreadsheetFeedback({ model }: { model: Spreadsheet }) {
  const { draft } = model;
  const error = draft.errors[draft.mode];
  const hint = draft.mode === 'addresses' && draft.addressView === 'review' ? model.commitError : null;
  const announcement = visiblePoiSpreadsheetAnnouncement(draft);
  if (!error && !hint && !announcement && !draft.lookup) return null;
  return <div className="poi-spreadsheet-feedback" role="region" aria-label="POI list messages" tabIndex={0}>
    {draft.lookup && <p role="status">{draft.lookup.completed} of {draft.lookup.total} addresses checked. Nothing has been added.</p>}
    {announcement && <p role="status">{announcement}</p>}
    {error && <p id="poi-spreadsheet-error" className="poi-spreadsheet-error" role="alert">{error}</p>}
    {hint && <p className="poi-spreadsheet-hint">{hint}</p>}
  </div>;
}

function SpreadsheetActions({ model, onCancel }: { model: Spreadsheet; onCancel: () => void }) {
  const isAddressMode = model.draft.mode === 'addresses';
  const isReview = isAddressMode && model.draft.addressView === 'review';
  return <ToolCardActions>
    <button type="button" onClick={onCancel}>Cancel list</button>
    {model.draft.lookup ? <button type="button" onClick={model.stopLookup}>Stop lookup</button>
      : <button className="primary-button" type="submit" disabled={isReview && Boolean(model.commitError)}>{isAddressMode ? (isReview ? 'Add selected POIs' : 'Look up addresses') : 'Add POIs'}</button>}
  </ToolCardActions>;
}

export function PoiSpreadsheetPanel(props: PoiSpreadsheetPanelProps) {
  const model = usePoiSpreadsheet(props);
  const isShortViewport = usePoiSpreadsheetSurface();
  const exit = useSpreadsheetExit(model, props);
  const { draft } = model;
  const isAddressMode = draft.mode === 'addresses';
  const isReview = isAddressMode && draft.addressView === 'review';
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const requestFocus = useSpreadsheetFocus(isReview, draft.rows, bodyRef, textareaRef);
  useLayoutEffect(() => { textareaRef.current?.focus(); }, []);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (isAddressMode && !isReview) {
      model.findAddresses();
      if (model.getCurrent()?.addressView === 'review') requestFocus('review');
    }
    else model.commit();
  };
  const form = <form className="map-authoring-panel tool-authoring-card poi-spreadsheet-panel" aria-label="Place multiple points" onSubmit={submit}>
      <ToolCardHeader closeLabel="Close POI list" icon={ListPlus} onClose={exit.cancel} title="Place multiple" />
      <div ref={bodyRef} className="poi-spreadsheet-body" role="region" aria-label="POI list workspace" tabIndex={0}>
        <SpreadsheetSource model={model} />
        <SpreadsheetContent model={model} textareaRef={textareaRef} bodyRef={bodyRef} requestFocus={requestFocus} />
      </div>
      <div className="poi-spreadsheet-footer">
        <SpreadsheetFeedback model={model} />
        <SpreadsheetActions model={model} onCancel={exit.cancel} />
      </div>
    </form>;
  const decision = exit.isOpen && <SpreadsheetDiscardDialog exit={exit} />;
  if (isShortViewport) return <Dialog open onOpenChange={(open) => { if (!open) exit.cancel(); }}>
    <DialogContent className="poi-spreadsheet-expanded-dialog" showCloseButton={false} initialFocus={() => textareaRef.current ?? bodyRef.current ?? false} finalFocus={false}>
      <DialogTitle className="sr-only">POI list workspace</DialogTitle>
      {form}
    </DialogContent>
    {decision}
  </Dialog>;
  return <>{form}{decision}</>;
}
