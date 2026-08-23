import { requestMapboxJson } from './request';
import type { PublicBrowserToken } from './token';

export const MAPBOX_CONNECTION_PROBE_ENDPOINT =
  'https://api.mapbox.com/styles/v1/mapbox/streets-v12' as const;

export type MapboxConnectionProbeOptions = {
  signal: AbortSignal;
  token: PublicBrowserToken;
};

export type MapboxConnectionProbe = (options: MapboxConnectionProbeOptions) => Promise<void>;

export const probeMapboxConnection: MapboxConnectionProbe = async ({ signal, token }) => {
  await requestMapboxJson<unknown>({
    endpoint: MAPBOX_CONNECTION_PROBE_ENDPOINT,
    signal,
    token,
  });
};
