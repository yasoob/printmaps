import { ListPlus, MapPin } from 'lucide-react';
import type { RefObject } from 'react';
import type { PoiSpreadsheetEntry } from '../../domain/poiSpreadsheet';
import type { SearchProvider } from '../../services/mapbox/contracts';
import { PoiSpreadsheetPanel } from './PoiSpreadsheetPanel';
import { ToolCardActions, ToolCardHeader } from './ToolAuthoringCard';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import type { PoiSpreadsheetRegistration } from '../hooks/poiSpreadsheetController';

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
  onSubmitSpreadsheet: (entries: readonly PoiSpreadsheetEntry[]) => ProjectMutationResult;
  onCompleteSpreadsheet: () => void;
  onChangeTool: (tool: string) => void;
  spreadsheetRegistration: PoiSpreadsheetRegistration;
};

export function PoiAuthoringControls(props: PoiAuthoringControlsProps) {
  const { active, documentEpoch, error, onCancel, onCancelSpreadsheet, onOpenSpreadsheet, onSubmitSpreadsheet, searchProvider, spreadsheetOpen, spreadsheetTriggerRef } = props;
  if (!active) return null;
  if (spreadsheetOpen) {
    return <PoiSpreadsheetPanel key={documentEpoch} documentEpoch={documentEpoch} onCancel={onCancelSpreadsheet} onComplete={props.onCompleteSpreadsheet} onSubmit={onSubmitSpreadsheet} onChangeTool={props.onChangeTool} registration={props.spreadsheetRegistration} searchProvider={searchProvider} />;
  }
  return (
    <div className="map-authoring-panel tool-authoring-card poi-authoring-panel">
      <ToolCardHeader closeLabel="Close Place menu" icon={MapPin} onClose={onCancel} title="Place" />
      <div className="poi-placement-content">
        <span className="tool-control-label">Place one point</span>
        <p role="status" aria-label="POI placement status">Click the map or choose a search result to add a point.</p>
      </div>
      {error && <span className="isochrone-error" role="alert">{error}</span>}
      <button ref={spreadsheetTriggerRef} className="tool-card-secondary-action" type="button" aria-label="Paste POI list" onClick={onOpenSpreadsheet}>
        <ListPlus aria-hidden="true" size={15} />
        <span><strong>Add multiple points</strong><small>Paste coordinates or addresses from a spreadsheet</small></span>
      </button>
      <ToolCardActions>
        <button type="button" aria-label="Cancel POI" onClick={onCancel}>Cancel</button>
      </ToolCardActions>
    </div>
  );
}
