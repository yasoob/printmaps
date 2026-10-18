import { ChevronDown, TriangleAlert } from 'lucide-react';

export function UnfinishedDrawingNotice({ hasPoiList = false, hasDrawing = true }: { hasPoiList?: boolean; hasDrawing?: boolean }) {
  const label = hasPoiList ? (hasDrawing ? 'Unfinished drawings and POI lists' : 'Unfinished POI lists') : 'Unfinished drawing';
  const work = hasPoiList ? (hasDrawing ? 'Unfinished drawings and POI lists' : 'Unadded POI lists') : 'Unfinished drawings';
  return (
    <details className="unfinished-drawing-notice">
      <summary>
        <TriangleAlert className="unfinished-drawing-notice-icon" aria-hidden="true" size={16} strokeWidth={1.75} />
        <span role="status" aria-label={label}>{work}: not saved or downloaded</span>
        <ChevronDown className="unfinished-drawing-notice-chevron" aria-hidden="true" size={16} strokeWidth={1.75} />
      </summary>
      <p>Only completed layers can be saved or downloaded. Finish or cancel unfinished work to share or export the map.</p>
      {hasDrawing && <p>Finish your route or area, or cancel its unfinished drawing and point inputs. Closing the Area menu keeps its outline only in this tab.</p>}
      {hasPoiList && <p>Pasted POI lists, row corrections and address suggestions stay only in this tab until you add them. Add or discard your lists before leaving.</p>}
      <p>Reloading or leaving loses unfinished work. Browsers may not show a warning when a mobile app or operating system closes the tab.</p>
    </details>
  );
}
