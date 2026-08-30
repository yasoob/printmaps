import { ListPlus } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import {
  MAX_POI_ADDRESS_ROWS,
  MAX_POI_SPREADSHEET_CHARACTERS,
  MAX_POI_SPREADSHEET_ROWS,
  parsePoiAddressSpreadsheet,
  parsePoiSpreadsheet,
  type PoiSpreadsheetEntry,
} from '../../domain/poiSpreadsheet';
import type { SearchProvider } from '../../services/mapbox/contracts';
import { ToolCardActions, ToolCardHeader } from './ToolAuthoringCard';

type PoiSpreadsheetPanelProps = {
  documentEpoch: number;
  onCancel: () => void;
  onSubmit: (entries: readonly PoiSpreadsheetEntry[]) => void;
  searchProvider?: SearchProvider;
};

type SpreadsheetMode = 'coordinates' | 'addresses';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The POI list could not be read.';
}

async function geocodeAddressRows(provider: SearchProvider, value: string, signal: AbortSignal) {
  const rows = parsePoiAddressSpreadsheet(value);
  const resolved: PoiSpreadsheetEntry[] = [];
  const resolveRow = async (index: number): Promise<PoiSpreadsheetEntry[]> => {
    const row = rows[index];
    if (!row) return resolved;
    const response = await provider.search({ autocomplete: false, query: row.address, limit: 1, signal });
    if (signal.aborted) return [];
    const result = response.results[0];
    if (!result) throw new Error(`Spreadsheet row ${index + 1} address could not be found.`);
    resolved.push({
      name: row.name,
      coordinates: [...result.center] as [number, number],
      providerFeatureId: result.providerFeatureId,
    });
    // The input is capped at 25 rows; bounded recursion preserves sequential provider calls without await-in-loop.
    return resolveRow(index + 1);
  };
  return resolveRow(0);
}

function submitLabel(isAddressMode: boolean, isResolving: boolean) {
  if (isResolving) return 'Finding POIs…';
  return isAddressMode ? 'Find and add POIs' : 'Add POIs';
}

export function PoiSpreadsheetPanel({ documentEpoch, onCancel, onSubmit, searchProvider }: PoiSpreadsheetPanelProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [mode, setMode] = useState<SpreadsheetMode>('coordinates');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useLayoutEffect(() => {
    textareaRef.current?.focus();
    return () => requestRef.current?.abort();
  }, [documentEpoch]);
  useLayoutEffect(() => {
    if (error && !isResolving) textareaRef.current?.focus();
  }, [error, isResolving]);

  const cancel = () => {
    requestRef.current?.abort();
    onCancel();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (mode === 'coordinates') {
      try {
        onSubmit(parsePoiSpreadsheet(value));
      } catch (error_) {
        setError(errorMessage(error_));
      }
      return;
    }

    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    try {
      if (!searchProvider) throw new Error('Configure a Mapbox public token before looking up spreadsheet addresses.');
      setIsResolving(true);
      const resolved = await geocodeAddressRows(searchProvider, value, controller.signal);
      if (!controller.signal.aborted) onSubmit(resolved);
    } catch (error_) {
      if (!controller.signal.aborted) {
        setError(errorMessage(error_));
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsResolving(false);
      }
    }
  };

  const isAddressMode = mode === 'addresses';
  return (
    <form className="map-authoring-panel tool-authoring-card poi-spreadsheet-panel" aria-label="Place multiple points" onSubmit={(event) => { void submit(event); }}>
      <ToolCardHeader closeLabel="Close POI list" icon={ListPlus} onClose={cancel} title="Place multiple" />
      <div className="poi-spreadsheet-intro">
        <span className="tool-control-label">Source data</span>
        <p>{isAddressMode ? `Look up up to ${MAX_POI_ADDRESS_ROWS} address rows with Mapbox.` : `Paste up to ${MAX_POI_SPREADSHEET_ROWS} tab-separated rows.`}</p>
      </div>
      <fieldset className="poi-spreadsheet-mode" disabled={isResolving}>
        <legend>Location columns</legend>
        <label><input type="radio" name="poi-spreadsheet-mode" checked={!isAddressMode} onChange={() => { setMode('coordinates'); setError(null); setValue(''); }} /> Coordinates</label>
        <label><input type="radio" name="poi-spreadsheet-mode" checked={isAddressMode} onChange={() => { setMode('addresses'); setError(null); setValue(''); }} /> Addresses</label>
      </fieldset>
      <label htmlFor="poi-spreadsheet-rows">{isAddressMode ? 'Name · Address' : 'Name · Longitude · Latitude'}</label>
      <textarea
        ref={textareaRef}
        id="poi-spreadsheet-rows"
        aria-label="POI spreadsheet rows"
        aria-invalid={error ? true : undefined}
        disabled={isResolving}
        maxLength={MAX_POI_SPREADSHEET_CHARACTERS}
        placeholder={isAddressMode ? 'Name\tAddress\nCafé Central\tHerrengasse 14, Vienna' : 'Name\tLongitude\tLatitude\nCafé Central\t16.3725\t48.2084'}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
      />
      {isResolving && <p role="status">Finding spreadsheet addresses…</p>}
      {error && <p role="alert">{error}</p>}
      <ToolCardActions>
        <button type="button" onClick={cancel}>Cancel list</button>
        <button className="primary-button" type="submit" disabled={isResolving}>{submitLabel(isAddressMode, isResolving)}</button>
      </ToolCardActions>
    </form>
  );
}
