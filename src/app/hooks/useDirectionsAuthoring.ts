import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DirectionsRouteInput } from '../../domain/project';
import type { RouteAuthoringOptions, RouteTravelProfile } from '../../domain/routeProfiles';
import type { DirectionsProvider, ProviderTravelProfile } from '../../services/mapbox/contracts';
import { MapboxProviderError } from '../../services/mapbox/errors';
import { createMapboxDirectionsProvider } from '../../services/mapbox/directions';

const defaultProvider = createMapboxDirectionsProvider({
  token: import.meta.env.VITE_MAPBOX_PUBLIC_ACCESS,
});

const ROAD_PROFILE: Partial<Record<RouteTravelProfile, ProviderTravelProfile>> = {
  car: 'driving',
  walk: 'walking',
  bike: 'cycling',
};

type DirectionsAuthoringOptions = {
  active: boolean;
  documentEpoch: number;
  onCreate: (
    input: DirectionsRouteInput,
    options: RouteAuthoringOptions,
    expectedDocumentEpoch: number,
  ) => string | null;
  provider?: DirectionsProvider;
};

type Lifecycle = { active: boolean; documentEpoch: number; version: number };
type Generation = { documentEpoch: number; lifecycleVersion: number; requestId: number };
type RequestError = { lifecycleVersion: number; message: string };

function errorMessage(error: unknown) {
  return error instanceof MapboxProviderError || error instanceof Error
    ? error.message
    : 'The road route could not be created. Try again.';
}

export function roadProfileFor(travelProfile: RouteTravelProfile) {
  return ROAD_PROFILE[travelProfile] ?? null;
}

export function useDirectionsAuthoring(options: DirectionsAuthoringOptions) {
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [requestError, setRequestError] = useState<RequestError | null>(null);
  const [lifecycle, setLifecycle] = useState<Lifecycle>({
    active: options.active,
    documentEpoch: options.documentEpoch,
    version: 0,
  });
  if (lifecycle.active !== options.active || lifecycle.documentEpoch !== options.documentEpoch) {
    setLifecycle({ active: options.active, documentEpoch: options.documentEpoch, version: lifecycle.version + 1 });
  }
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const lifecycleRef = useRef({ active: options.active, documentEpoch: options.documentEpoch });
  const provider = options.provider ?? defaultProvider;

  const cancel = useCallback(() => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setGeneration(null);
    setRequestError(null);
  }, []);

  useLayoutEffect(() => {
    lifecycleRef.current = { active: options.active, documentEpoch: options.documentEpoch };
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, [options.active, options.documentEpoch]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const route = useCallback(async (
    waypoints: readonly (readonly [number, number])[],
    authoringOptions: RouteAuthoringOptions,
  ) => {
    const profile = roadProfileFor(authoringOptions.travelProfile);
    if (!profile) {
      setRequestError({ lifecycleVersion: lifecycle.version, message: 'Road routing supports Car, Walking, or Cycling.' });
      return null;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    const expectedDocumentEpoch = options.documentEpoch;
    setGeneration({ documentEpoch: expectedDocumentEpoch, lifecycleVersion: lifecycle.version, requestId });
    setRequestError(null);
    try {
      const response = await provider.directions({ waypoints, profile, signal: controller.signal });
      if (controller.signal.aborted
        || requestId !== requestIdRef.current
        || !lifecycleRef.current.active
        || lifecycleRef.current.documentEpoch !== expectedDocumentEpoch) return null;
      const selected = response.routes[0];
      if (!selected) throw new Error('Mapbox did not return a road route. Try different points.');
      return options.onCreate({
        geometry: selected.geometry.map(([longitude, latitude]) => [longitude, latitude]),
        waypoints: waypoints.map(([longitude, latitude]) => [longitude, latitude]),
        profile,
        distanceMeters: selected.distanceMeters,
        durationSeconds: selected.durationSeconds,
      }, authoringOptions, expectedDocumentEpoch);
    } catch (requestError) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return null;
      setRequestError({ lifecycleVersion: lifecycle.version, message: errorMessage(requestError) });
      return null;
    } finally {
      if (requestId === requestIdRef.current) {
        controllerRef.current = null;
        setGeneration(null);
      }
    }
  }, [lifecycle.version, options, provider]);

  return {
    cancel,
    error: options.active && requestError?.lifecycleVersion === lifecycle.version ? requestError.message : null,
    isRouting: options.active
      && generation?.documentEpoch === options.documentEpoch
      && generation.lifecycleVersion === lifecycle.version,
    route,
  };
}
