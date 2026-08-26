import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { IsochroneAreaInput } from '../../domain/project';
import type { IsochroneProvider, ProviderTravelProfile } from '../../services/mapbox/contracts';
import { MapboxProviderError } from '../../services/mapbox/errors';
import { createMapboxIsochroneProvider } from '../../services/mapbox/isochrone';

export type IsochroneCenter = {
  coordinate: [number, number];
  label: string;
};

type IsochroneAuthoringOptions = {
  active: boolean;
  documentEpoch: number;
  onCreate: (input: IsochroneAreaInput, expectedDocumentEpoch: number) => string | null;
  onCreated?: (id: string) => void;
  provider?: IsochroneProvider;
};

type Generation = { documentEpoch: number; lifecycleVersion: number; requestId: number };
type RequestError = { lifecycleVersion: number; message: string };
type Lifecycle = { active: boolean; documentEpoch: number; version: number };

const defaultProvider = createMapboxIsochroneProvider({
  token: import.meta.env.VITE_MAPBOX_PUBLIC_ACCESS,
});

function mutableGeometry(geometry: Awaited<ReturnType<IsochroneProvider['isochrone']>>['geometry']) {
  return {
    type: 'Polygon' as const,
    coordinates: geometry.coordinates.map((ring) => ring.map((position) => (
      [position[0], position[1]] as [number, number]
    ))),
  };
}

function cancelRequest(controllerRef: { current: AbortController | null }) {
  controllerRef.current?.abort();
  controllerRef.current = null;
}

function shouldIgnoreResponse(identity: {
  currentActive: boolean;
  currentDocumentEpoch: number;
  currentRequestId: number;
  expectedDocumentEpoch: number;
  requestId: number;
  signal: AbortSignal;
}) {
  return !identity.currentActive
    || identity.signal.aborted
    || identity.requestId !== identity.currentRequestId
    || identity.expectedDocumentEpoch !== identity.currentDocumentEpoch;
}

function requestErrorMessage(error: unknown) {
  return error instanceof MapboxProviderError || error instanceof Error
    ? error.message
    : 'The travel-time area could not be created. Try again.';
}

export function useIsochroneAuthoring(options: IsochroneAuthoringOptions) {
  const [center, setCenter] = useState<IsochroneCenter | null>(null);
  const [profile, setProfile] = useState<ProviderTravelProfile>('walking');
  const [minutes, setMinutes] = useState(15);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [requestError, setRequestError] = useState<RequestError | null>(null);
  const [lifecycle, setLifecycle] = useState<Lifecycle>({
    active: options.active,
    documentEpoch: options.documentEpoch,
    version: 0,
  });
  if (lifecycle.active !== options.active || lifecycle.documentEpoch !== options.documentEpoch) {
    if (lifecycle.documentEpoch !== options.documentEpoch) setCenter(null);
    setLifecycle({
      active: options.active,
      documentEpoch: options.documentEpoch,
      version: lifecycle.version + 1,
    });
  }
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const lifecycleRef = useRef({ active: options.active, documentEpoch: options.documentEpoch });
  const provider = options.provider ?? defaultProvider;
  useLayoutEffect(() => {
    lifecycleRef.current = { active: options.active, documentEpoch: options.documentEpoch };
    requestIdRef.current += 1;
    cancelRequest(requestControllerRef);
  }, [options.active, options.documentEpoch]);
  useEffect(() => () => cancelRequest(requestControllerRef), []);

  const resetRequest = useCallback(() => {
    requestIdRef.current += 1;
    cancelRequest(requestControllerRef);
    setGeneration(null);
    setRequestError(null);
  }, []);

  const updateCenter = useCallback((nextCenter: IsochroneCenter) => {
    resetRequest();
    setCenter(nextCenter);
  }, [resetRequest]);

  const updateProfile = useCallback((nextProfile: ProviderTravelProfile) => {
    resetRequest();
    setProfile(nextProfile);
  }, [resetRequest]);

  const updateMinutes = useCallback((nextMinutes: number) => {
    resetRequest();
    setMinutes(nextMinutes);
  }, [resetRequest]);

  const generate = useCallback(async () => {
    if (!center || !options.active) return;
    cancelRequest(requestControllerRef);
    const controller = new AbortController();
    requestControllerRef.current = controller;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    const expectedDocumentEpoch = options.documentEpoch;
    setGeneration({
      documentEpoch: expectedDocumentEpoch,
      lifecycleVersion: lifecycle.version,
      requestId,
    });
    setRequestError(null);
    try {
      const response = await provider.isochrone({
        center: center.coordinate,
        minutes,
        profile,
        signal: controller.signal,
      });
      if (shouldIgnoreResponse({
        currentActive: lifecycleRef.current.active,
        currentDocumentEpoch: lifecycleRef.current.documentEpoch,
        currentRequestId: requestIdRef.current,
        expectedDocumentEpoch,
        requestId,
        signal: controller.signal,
      })) return;
      const label = `${minutes} min ${profile} area`;
      const id = options.onCreate({
        center: [...center.coordinate],
        geometry: mutableGeometry(response.geometry),
        label,
        minutes,
        profile,
      }, expectedDocumentEpoch);
      if (id) options.onCreated?.(id);
    } catch (requestError) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setRequestError({ lifecycleVersion: lifecycle.version, message: requestErrorMessage(requestError) });
    } finally {
      if (requestId === requestIdRef.current) {
        requestControllerRef.current = null;
        setGeneration(null);
      }
    }
  }, [center, lifecycle.version, minutes, options, profile, provider]);

  return {
    cancel: resetRequest,
    center,
    error: options.active && requestError?.lifecycleVersion === lifecycle.version
      ? requestError.message
      : null,
    generate,
    isGenerating: options.active
      && generation?.documentEpoch === options.documentEpoch
      && generation.lifecycleVersion === lifecycle.version,
    minutes,
    profile,
    setCenter: updateCenter,
    setMinutes: updateMinutes,
    setProfile: updateProfile,
  };
}
