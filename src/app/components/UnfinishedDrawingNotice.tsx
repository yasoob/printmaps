export function UnfinishedDrawingNotice({ hasPoiList = false, hasDrawing = true }: { hasPoiList?: boolean; hasDrawing?: boolean }) {
  const label = hasPoiList ? (hasDrawing ? 'Unfinished drawings and POI lists' : 'Unfinished POI lists') : 'Unfinished drawing';
  const work = hasPoiList ? (hasDrawing ? 'Unfinished drawings and POI lists' : 'Unadded POI lists') : 'Unfinished drawings';
  return (
    <details className="unfinished-drawing-notice">
      <summary>
        <span role="status" aria-label={label}>{work}: not saved or downloaded</span>
      </summary>
      <p>Only completed layers can be saved or downloaded.</p>
      {hasDrawing && <p>Finish your route or area, or cancel its unfinished drawing and point inputs. Closing the Area menu keeps its outline only in this tab.</p>}
      {hasPoiList && <p>Pasted POI lists, row corrections and address suggestions stay only in this tab until you add them. Add or discard your lists before leaving.</p>}
      <p>Reloading or leaving loses unfinished work. Browsers may not show a warning when a mobile app or operating system closes the tab.</p>
    </details>
  );
}
