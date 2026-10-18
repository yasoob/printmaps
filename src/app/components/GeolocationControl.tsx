import { LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useId, useRef, useState } from 'react';
import { trackEditorAction } from '../../analytics/editorAnalytics';
import { MAX_MERCATOR_LATITUDE } from '../../domain/project';

type GeolocationControlProps = {
  locked: boolean;
  onLocate: (coordinate: [number, number], onApplied: () => void) => void;
  requestScope?: number;
};

type LocationStatus =
  | { kind: 'error'; message: string }
  | { kind: 'located'; message: string }
  | { kind: 'pending'; message: string }
  | { kind: 'success'; message: string }
  | null;

const LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 60_000,
  timeout: 10_000,
};

function locationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Location permission was denied. Allow location access in your browser and try again.';
  }
  if (error.code === error.TIMEOUT) {
    return 'Finding your location timed out. Check location services and try again.';
  }
  return 'Your current location is unavailable. Check location services and try again.';
}

export function GeolocationControl({ locked, onLocate, requestScope = 0 }: GeolocationControlProps) {
  const [status, setStatus] = useState<LocationStatus>(null);
  const requestId = useRef(0);
  const activeRequest = useRef<number | null>(null);

  useEffect(() => () => {
    requestId.current += 1;
    if (activeRequest.current !== null) {
      activeRequest.current = null;
      trackEditorAction('geolocationCancelled');
    }
  }, [locked, requestScope]);

  const locate = () => {
    if (activeRequest.current !== null) trackEditorAction('geolocationCancelled');
    activeRequest.current = null;
    trackEditorAction('geolocationStarted');
    const geolocation = navigator.geolocation;
    if (!geolocation) {
      trackEditorAction('geolocationFailed');
      setStatus({ kind: 'error', message: 'Location is unavailable in this browser.' });
      return;
    }
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    activeRequest.current = currentRequest;
    setStatus({ kind: 'pending', message: 'Finding your location…' });
    geolocation.getCurrentPosition((position) => {
      if (requestId.current !== currentRequest) return;
      const { latitude, longitude } = position.coords;
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)
        || Math.abs(longitude) > 180 || Math.abs(latitude) > MAX_MERCATOR_LATITUDE) {
        activeRequest.current = null;
        trackEditorAction('geolocationFailed');
        setStatus({ kind: 'error', message: 'Your browser returned an invalid location. Try again.' });
        return;
      }
      setStatus({ kind: 'located', message: 'Location found. Waiting for the map renderer…' });
      onLocate([longitude, latitude], () => {
        if (requestId.current !== currentRequest) return;
        if (activeRequest.current === currentRequest) {
          activeRequest.current = null;
          trackEditorAction('geolocationCompleted');
        }
        setStatus({ kind: 'success', message: 'Map centered on your current location.' });
      });
    }, (error) => {
      if (requestId.current !== currentRequest) return;
      activeRequest.current = null;
      trackEditorAction('geolocationFailed');
      setStatus({ kind: 'error', message: locationErrorMessage(error) });
    }, LOCATION_OPTIONS);
  };

  const isPending = status?.kind === 'pending';
  const lockedHintId = useId();

  return (
    <div className="map-location-control">
      <Button variant="secondary" busy={isPending} disabled={locked} aria-describedby={locked ? lockedHintId : undefined} onClick={locate}>
        {!isPending && <LocateFixed aria-hidden="true" size={16} strokeWidth={1.75} />} Use my location
      </Button>
      {locked
        ? <p id={lockedHintId} className="map-location-status">Unlock the map area to use your location.</p>
        : status && (
          <p className={`map-location-status is-${status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'}>
            {status.message}
          </p>
        )}
    </div>
  );
}
