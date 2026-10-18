import { Notice } from '../../components/ui/notice';
import { Button } from '../../components/ui/button';
import { FileUp, RotateCcw } from 'lucide-react';
import { useRef } from 'react';
import type { ElevationProfileSession } from '../elevation/ElevationProfileSession';
import type { ProfileSessionState } from '../elevation/profileSessionTypes';

export function ProfileRouteSource({ model, state }: { model: ElevationProfileSession; state: ProfileSessionState }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { localRoute, readingFilename, fileError } = state;
  const isReading = readingFilename !== null;
  let statusMessage = '';
  if (isReading) statusMessage = `Reading profile route file… ${readingFilename}`;
  else if (localRoute) statusMessage = `Profile route loaded: ${localRoute.name}.`;
  return <>
    <div className="elevation-profile-source" role="group" aria-label="Profile route source" aria-busy={isReading}>
      <span>Profile route</span>
      <strong>{localRoute ? `${localRoute.name} · ${localRoute.filename}` : 'Selected map route'}</strong>
      <div>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}><FileUp aria-hidden="true" />{isReading ? 'Choose another file' : 'Choose file'}</Button>
        {isReading && <Button variant="secondary" onClick={model.cancelFile}>Cancel file read</Button>}
        {localRoute && <Button variant="secondary" onClick={model.useSelectedRoute}><RotateCcw aria-hidden="true" />Use selected map route</Button>}
      </div>
      <input ref={fileInputRef} aria-label="Profile route file" accept=".geojson,.gpx,.kml,application/geo+json,application/gpx+xml,application/vnd.google-earth.kml+xml" hidden type="file" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        void model.chooseFile(file);
      }} />
      {fileError && <Notice tone="error">{fileError}</Notice>}
    </div>
    <p className="elevation-profile-source-status" role="status">{statusMessage}</p>
  </>;
}
