import type { RefObject } from 'react';
import type { PoiSpreadsheetEntry } from '../../domain/poiSpreadsheet';
import { PoiSpreadsheetPanel } from './PoiSpreadsheetPanel';

type PoiAuthoringControlsProps = {
  active: boolean;
  spreadsheetOpen: boolean;
  spreadsheetTriggerRef: RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onCancelSpreadsheet: () => void;
  onOpenSpreadsheet: () => void;
  onSubmitSpreadsheet: (entries: readonly PoiSpreadsheetEntry[]) => void;
};

export function PoiAuthoringControls(props: PoiAuthoringControlsProps) {
  const { active, onCancel, onCancelSpreadsheet, onOpenSpreadsheet, onSubmitSpreadsheet, spreadsheetOpen, spreadsheetTriggerRef } = props;
  if (!active) return null;
  if (spreadsheetOpen) {
    return <PoiSpreadsheetPanel onCancel={onCancelSpreadsheet} onSubmit={onSubmitSpreadsheet} />;
  }
  return (
    <div className="map-authoring-panel">
      <span role="status" aria-label="POI placement status">Click the map to place a POI</span>
      <button ref={spreadsheetTriggerRef} type="button" onClick={onOpenSpreadsheet}>Paste POI list</button>
      <button type="button" onClick={onCancel}>Cancel POI</button>
    </div>
  );
}
