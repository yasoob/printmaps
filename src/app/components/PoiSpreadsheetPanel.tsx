import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  MAX_POI_SPREADSHEET_CHARACTERS,
  MAX_POI_SPREADSHEET_ROWS,
  parsePoiSpreadsheet,
  type PoiSpreadsheetEntry,
} from '../../domain/poiSpreadsheet';

type PoiSpreadsheetPanelProps = {
  onCancel: () => void;
  onSubmit: (entries: readonly PoiSpreadsheetEntry[]) => void;
};

export function PoiSpreadsheetPanel({ onCancel, onSubmit }: PoiSpreadsheetPanelProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      onSubmit(parsePoiSpreadsheet(value));
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'The POI list could not be read.');
      textareaRef.current?.focus();
    }
  };

  return (
    <form className="poi-spreadsheet-panel" aria-labelledby="poi-spreadsheet-title" onSubmit={submit}>
      <div className="poi-spreadsheet-heading">
        <strong id="poi-spreadsheet-title">Add POIs from a spreadsheet</strong>
        <span>Paste up to {MAX_POI_SPREADSHEET_ROWS} tab-separated rows.</span>
      </div>
      <label htmlFor="poi-spreadsheet-rows">Name · Longitude · Latitude</label>
      <textarea
        ref={textareaRef}
        id="poi-spreadsheet-rows"
        aria-label="POI spreadsheet rows"
        aria-invalid={error ? true : undefined}
        maxLength={MAX_POI_SPREADSHEET_CHARACTERS}
        placeholder={'Name\tLongitude\tLatitude\nCafé Central\t16.3725\t48.2084'}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
      />
      {error && <p role="alert">{error}</p>}
      <div className="poi-spreadsheet-actions">
        <button type="button" onClick={onCancel}>Cancel list</button>
        <button className="primary-button" type="submit">Add POIs</button>
      </div>
    </form>
  );
}
