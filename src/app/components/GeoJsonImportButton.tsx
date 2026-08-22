import { FileUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ContentLayer } from '../../domain/project';
import {
  MAX_GEOJSON_FILE_BYTES,
  parseGeoJsonText,
} from '../../import/geojson';
import {
  MAX_GPX_KML_FILE_BYTES,
  parseGpxText,
  parseKmlText,
} from '../../import/gpxKml';

type GeoJsonImportStatus = {
  kind: 'success' | 'error';
  message: string;
};

type GeoJsonImportButtonProps = {
  documentEpoch: number;
  existingLayerIds: readonly string[];
  onImport: (layers: readonly ContentLayer[], documentEpoch: number) => boolean;
};

function parseRequiredGeoJson(...parameters: Parameters<typeof parseGeoJsonText>) {
  const layers = parseGeoJsonText(...parameters);
  if (layers.length === 0) {
    throw new Error('GeoJSON must contain at least one supported Point, LineString, or Polygon feature.');
  }
  return layers;
}

type MapDataImporter = {
  format: string;
  maxBytes: number;
  parse: typeof parseRequiredGeoJson;
};

function importerForFilename(filename: string): MapDataImporter {
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith('.geojson')) {
    return { format: 'GeoJSON', maxBytes: MAX_GEOJSON_FILE_BYTES, parse: parseRequiredGeoJson };
  }
  if (lowerName.endsWith('.gpx')) {
    return { format: 'GPX', maxBytes: MAX_GPX_KML_FILE_BYTES, parse: parseGpxText };
  }
  if (lowerName.endsWith('.kml')) {
    return { format: 'KML', maxBytes: MAX_GPX_KML_FILE_BYTES, parse: parseKmlText };
  }
  throw new Error('Choose a GeoJSON, GPX, or KML file with the matching filename suffix.');
}

export function GeoJsonImportButton({ documentEpoch, existingLayerIds, onImport }: GeoJsonImportButtonProps) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<GeoJsonImportStatus | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(false);
  const shouldRestoreFocusRef = useRef(false);

  useEffect(() => {
    if (pending || !shouldRestoreFocusRef.current) return;
    shouldRestoreFocusRef.current = false;
    const activeElement = document.activeElement;
    const shouldRestoreFocus = !activeElement
      || activeElement === document.body
      || activeElement === document.documentElement
      || activeElement === inputRef.current
      || activeElement === buttonRef.current;
    if (shouldRestoreFocus) buttonRef.current?.focus();
  }, [pending]);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);

    try {
      const importer = importerForFilename(file.name);
      if (file.size > importer.maxBytes) {
        throw new Error(`${importer.format} files must be 5 MB or smaller.`);
      }
      const layers = importer.parse(await file.text(), { existingLayerIds });
      if (!onImport(layers, documentEpoch)) return;
      const noun = layers.length === 1 ? 'layer' : 'layers';
      setStatus({
        kind: 'success',
        message: `Imported ${layers.length} ${importer.format} ${noun}. Undo removes the whole import.`,
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'This map data file could not be imported.',
      });
    } finally {
      pendingRef.current = false;
      shouldRestoreFocusRef.current = true;
      setPending(false);
      input.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        hidden
        type="file"
        accept=".geojson,.gpx,.kml,application/geo+json,application/gpx+xml,application/vnd.google-earth.kml+xml"
        onChange={handleChange}
      />
      <button ref={buttonRef} className="quiet-button" type="button" disabled={pending} onClick={() => inputRef.current?.click()}>
        <FileUp size={14} /> Import
      </button>
      {status && (
        <div
          className={`project-file-status${status.kind === 'error' ? ' is-error' : ''}`}
          role={status.kind === 'error' ? 'alert' : 'status'}
          aria-label="Map data import status"
        >
          {status.message}
        </div>
      )}
    </>
  );
}
