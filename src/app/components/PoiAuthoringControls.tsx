import type { RefObject } from 'react';
import type { PoiSpreadsheetEntry } from '../../domain/poiSpreadsheet';
import type { SearchProvider } from '../../services/mapbox/contracts';
import { PoiSpreadsheetPanel } from './PoiSpreadsheetPanel';

type PoiAuthoringControlsProps = {
  active: boolean;
  documentEpoch: number;
  error?: string | null;
  spreadsheetOpen: boolean;
  spreadsheetTriggerRef: RefObject<HTMLButtonElement | null>;
  searchProvider?: SearchProvider;
  onCancel: () => void;
  onCancelSpreadsheet: () => void;
  onOpenSpreadsheet: () => void;
  onSubmitSpreadsheet: (entries: readonly PoiSpreadsheetEntry[]) => void;
};

export function PoiAuthoringControls(props: PoiAuthoringControlsProps) {
  const { active, documentEpoch, error, onCancel, onCancelSpreadsheet, onOpenSpreadsheet, onSubmitSpreadsheet, searchProvider, spreadsheetOpen, spreadsheetTriggerRef } = props;
  if (!active) return null;
  if (spreadsheetOpen) {
    return <PoiSpreadsheetPanel documentEpoch={documentEpoch} onCancel={onCancelSpreadsheet} onSubmit={onSubmitSpreadsheet} searchProvider={searchProvider} />;
  }
  return (
    <div className="map-authoring-panel">
      <span role="status" aria-label="POI placement status">Click the map to place a POI</span>
      {error && <span className="isochrone-error" role="alert">{error}</span>}
      <button ref={spreadsheetTriggerRef} type="button" onClick={onOpenSpreadsheet}>Paste POI list</button>
      <button type="button" onClick={onCancel}>Cancel POI</button>
    </div>
  );
}
