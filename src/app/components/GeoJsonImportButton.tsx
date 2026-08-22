import { FileUp } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ContentLayer } from '../../domain/project';
import {
  MAX_GEOJSON_FILE_BYTES,
  parseGeoJsonText,
} from '../../import/geojson';

type GeoJsonImportStatus = {
  kind: 'success' | 'error';
  message: string;
};

type GeoJsonImportButtonProps = {
  documentEpoch: number;
  existingLayerIds: readonly string[];
  onImport: (layers: readonly ContentLayer[], documentEpoch: number) => boolean;
};

export function GeoJsonImportButton({ documentEpoch, existingLayerIds, onImport }: GeoJsonImportButtonProps) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<GeoJsonImportStatus | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(false);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);

    try {
      if (!file.name.toLowerCase().endsWith('.geojson')) {
        throw new Error('Choose a GeoJSON file with the .geojson filename suffix.');
      }
      if (file.size > MAX_GEOJSON_FILE_BYTES) {
        throw new Error('GeoJSON files must be 5 MB or smaller.');
      }
      const layers = parseGeoJsonText(await file.text(), { existingLayerIds });
      if (layers.length === 0) {
        throw new Error('GeoJSON must contain at least one supported Point, LineString, or Polygon feature.');
      }
      if (!onImport(layers, documentEpoch)) return;
      const noun = layers.length === 1 ? 'layer' : 'layers';
      setStatus({
        kind: 'success',
        message: `Imported ${layers.length} GeoJSON ${noun}. Undo removes the whole import.`,
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'This GeoJSON file could not be imported.',
      });
    } finally {
      pendingRef.current = false;
      setPending(false);
      input.value = '';
      window.setTimeout(() => {
        window.requestAnimationFrame(() => buttonRef.current?.focus());
      }, 0);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        hidden
        type="file"
        accept=".geojson,application/geo+json"
        onChange={handleChange}
      />
      <button ref={buttonRef} className="quiet-button" type="button" disabled={pending} onClick={() => inputRef.current?.click()}>
        <FileUp size={14} /> Import
      </button>
      {status && (
        <div
          className={`project-file-status${status.kind === 'error' ? ' is-error' : ''}`}
          role={status.kind === 'error' ? 'alert' : 'status'}
          aria-label="GeoJSON import status"
        >
          {status.message}
        </div>
      )}
    </>
  );
}
