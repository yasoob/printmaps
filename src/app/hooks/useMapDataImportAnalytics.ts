import { trackEditorAction } from '../../analytics/editorAnalytics';

type ImportFormat = 'geojson' | 'gpx' | 'kml' | 'mixed' | 'unknown';

export function mapDataImportFormat(files: readonly File[]): ImportFormat {
  const formats = new Set(files.map((file): ImportFormat => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.geojson')) return 'geojson';
    if (name.endsWith('.gpx')) return 'gpx';
    if (name.endsWith('.kml')) return 'kml';
    return 'unknown';
  }));
  return formats.size > 1 ? 'mixed' : [...formats][0] ?? 'unknown';
}

export function createImportAnalytics(files: readonly File[], source: 'file' | 'drop') {
  const parameters = { format: mapDataImportFormat(files), source };
  let isActive = true;
  trackEditorAction('importStarted', parameters);
  return {
    start() {
      if (isActive) return;
      isActive = true;
      trackEditorAction('importStarted', parameters);
    },
    finish(action: 'importCompleted' | 'importFailed' | 'importCancelled') {
      if (!isActive) return;
      isActive = false;
      trackEditorAction(action, parameters);
    },
  };
}
