import { LocateFixed } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

  useEffect(() => () => {
    requestId.current += 1;
  }, [locked, requestScope]);

  const locate = () => {
    const geolocation = navigator.geolocation;
    if (!geolocation) {
      setStatus({ kind: 'error', message: 'Location is unavailable in this browser.' });
      return;
    }
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setStatus({ kind: 'pending', message: 'Finding your location…' });
    geolocation.getCurrentPosition((position) => {
      if (requestId.current !== currentRequest) return;
      const { latitude, longitude } = position.coords;
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)
        || Math.abs(longitude) > 180 || Math.abs(latitude) > MAX_MERCATOR_LATITUDE) {
        setStatus({ kind: 'error', message: 'Your browser returned an invalid location. Try again.' });
        return;
      }
      setStatus({ kind: 'located', message: 'Location found. Waiting for the map renderer…' });
      onLocate([longitude, latitude], () => {
        if (requestId.current !== currentRequest) return;
        setStatus({ kind: 'success', message: 'Map centered on your current location.' });
      });
    }, (error) => {
      if (requestId.current !== currentRequest) return;
      setStatus({ kind: 'error', message: locationErrorMessage(error) });
    }, LOCATION_OPTIONS);
  };

  const isPending = status?.kind === 'pending';
  const displayedStatus = locked
    ? { kind: 'error' as const, message: 'Unlock the map area to use your location.' }
    : status;

  return (
    <div className="map-location-control">
      <button className="quiet-button" type="button" disabled={locked || isPending} onClick={locate}>
        <LocateFixed aria-hidden="true" size={14} /> Use my location
      </button>
      {displayedStatus && (
        <p className={`map-location-status is-${displayedStatus.kind}`} role={displayedStatus.kind === 'error' ? 'alert' : 'status'}>
          {displayedStatus.message}
        </p>
      )}
    </div>
  );
}
