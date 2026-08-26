import { FileUp, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ContentLayer } from '../../domain/project';
import { parseMapDataFiles } from '../../import/mapDataBatch';

type Position = readonly [number, number];

export type LocalProfileRoute = Readonly<{
  coordinates: readonly Position[];
  filename: string;
  name: string;
}>;

type ProfileRouteSourceProps = Readonly<{
  localRoute: LocalProfileRoute | null;
  onReadingChange: (isReading: boolean) => void;
  onReadingStart: () => void;
  onSourceChange: (route: LocalProfileRoute | null) => void;
}>;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'The profile route file could not be read. Try another GPX, KML, or GeoJSON file.';
}

function routeFromLayers(layers: readonly ContentLayer[], filename: string): LocalProfileRoute {
  const routes = layers.filter((layer) => layer.type === 'route' && layer.geometry?.type === 'LineString');
  if (routes.length !== 1) {
    throw new Error('Choose a GPX, KML, or GeoJSON file containing exactly one route.');
  }
  const route = routes[0];
  if (route.geometry?.type !== 'LineString') {
    throw new Error('Choose a GPX, KML, or GeoJSON file containing exactly one route.');
  }
  return { coordinates: route.geometry.coordinates, filename, name: route.name };
}

export function ProfileRouteSource({ localRoute, onReadingChange, onReadingStart, onSourceChange }: ProfileRouteSourceProps) {
  const [isReading, setIsReading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectionRef = useRef(0);

  useEffect(() => () => { selectionRef.current += 1; }, []);

  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    const selection = selectionRef.current + 1;
    selectionRef.current = selection;
    setFileError(null);
    setIsReading(true);
    onReadingChange(true);
    onReadingStart();
    void parseMapDataFiles([file], [])
      .then(({ layers }) => {
        if (selectionRef.current === selection) onSourceChange(routeFromLayers(layers, file.name));
      })
      .catch((error: unknown) => {
        if (selectionRef.current !== selection) return;
        setFileError(errorMessage(error));
      })
      .finally(() => {
        if (selectionRef.current !== selection) return;
        setIsReading(false);
        onReadingChange(false);
      });
  };

  const useSelectedRoute = () => {
    selectionRef.current += 1;
    setFileError(null);
    setIsReading(false);
    onReadingChange(false);
    onSourceChange(null);
  };

  return (
    <div className="elevation-profile-source" role="group" aria-label="Profile route source" aria-busy={isReading}>
      <span>Profile route</span>
      <strong>{localRoute ? `${localRoute.name} · ${localRoute.filename}` : 'Selected map route'}</strong>
      <div>
        <button className="quiet-button" type="button" disabled={isReading} onClick={() => fileInputRef.current?.click()}><FileUp aria-hidden="true" size={14} />{isReading ? 'Reading…' : 'Choose file'}</button>
        {localRoute && <button className="quiet-button" type="button" onClick={useSelectedRoute}><RotateCcw aria-hidden="true" size={14} />Use selected map route</button>}
      </div>
      <input
        ref={fileInputRef}
        aria-label="Profile route file"
        accept=".geojson,.gpx,.kml,application/geo+json,application/gpx+xml,application/vnd.google-earth.kml+xml"
        hidden
        type="file"
        onChange={(event) => {
          chooseFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      {fileError && <p role="alert">{fileError}</p>}
    </div>
  );
}
