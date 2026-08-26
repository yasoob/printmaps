import { useEffect, useMemo, useRef, useState } from 'react';
import { MapboxProviderError } from '../../services/mapbox/errors';
import {
  probeMapboxConnection,
  type MapboxConnectionProbe,
} from '../../services/mapbox/configuration';
import { validatePublicBrowserToken, type PublicBrowserToken } from '../../services/mapbox/token';

type ConnectionIdentity = {
  origin: string;
  probe: MapboxConnectionProbe;
  token: PublicBrowserToken;
};

type ConnectionState =
  | { kind: 'idle' }
  | { kind: 'checking'; identity: ConnectionIdentity }
  | { kind: 'ready'; identity: ConnectionIdentity }
  | { kind: 'error'; identity: ConnectionIdentity; message: string };

type TokenConfiguration =
  | { kind: 'configured'; token: PublicBrowserToken }
  | { kind: 'error'; message: string };

type MapboxServiceStatusProps = {
  origin?: string;
  probe?: MapboxConnectionProbe;
  token?: string | null;
};

function resolveTokenConfiguration(token: string | null | undefined): TokenConfiguration {
  try {
    return { kind: 'configured', token: validatePublicBrowserToken(token) };
  } catch (error) {
    const message = error instanceof MapboxProviderError
      ? error.message
      : 'Configure a least-scope public Mapbox token before enabling provider services.';
    return { kind: 'error', message };
  }
}

function safeProbeError(error: unknown, origin: string) {
  const message = error instanceof MapboxProviderError
    ? error.message
    : 'Mapbox could not verify this browser connection. Check the public token and network, then retry.';
  return `${message} Confirm that ${origin} is included in the token's allowed URL restrictions.`;
}

export function MapboxServiceStatus({
  origin = window.location.origin,
  probe = probeMapboxConnection,
  token = import.meta.env.VITE_MAPBOX_PUBLIC_ACCESS,
}: MapboxServiceStatusProps) {
  const configuration = useMemo(() => resolveTokenConfiguration(token), [token]);

  if (configuration.kind === 'error') {
    return (
      <div className="mapbox-service-status is-error" role="alert">
        <strong>Mapbox services unavailable</strong>
        <p>{configuration.message}</p>
        <p>Set <code>VITE_MAPBOX_PUBLIC_ACCESS</code> to a least-scope <code>pk.</code> token and allow <strong>{origin}</strong>.</p>
      </div>
    );
  }

  return <ConfiguredMapboxServiceStatus origin={origin} probe={probe} token={configuration.token} />;
}

function connectionButtonLabel(connection: ConnectionState) {
  if (connection.kind === 'checking') return 'Checking Mapbox connection';
  if (connection.kind === 'error') return 'Retry Mapbox connection';
  return 'Check Mapbox connection';
}

function connectionButtonText(connection: ConnectionState) {
  if (connection.kind === 'checking') return 'Checking…';
  if (connection.kind === 'error') return 'Retry connection';
  return 'Check connection';
}

function ConfiguredMapboxServiceStatus({
  origin,
  probe,
  token,
}: Required<Pick<MapboxServiceStatusProps, 'origin' | 'probe'>> & { token: PublicBrowserToken }) {
  const identity = useMemo(() => ({ origin, probe, token }), [origin, probe, token]);
  const controllerRef = useRef<AbortController | null>(null);
  const [storedConnection, setConnection] = useState<ConnectionState>({ kind: 'idle' });
  const connection = storedConnection.kind === 'idle' || storedConnection.identity === identity
    ? storedConnection
    : { kind: 'idle' as const };

  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    return () => controllerRef.current?.abort();
  }, [identity]);

  if (connection.kind === 'ready') {
    return (
      <div className="mapbox-service-status is-ready" role="status">
        <strong>Mapbox connection ready</strong>
        <p>Mapbox accepted this public token from {origin}.</p>
        <p>This browser connection is ready for provider requests.</p>
        <p>Search and travel-time Areas are active. Road-routing integration is next.</p>
      </div>
    );
  }

  const checkConnection = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setConnection({ identity, kind: 'checking' });
    try {
      await probe({ signal: controller.signal, token });
      if (!controller.signal.aborted) setConnection({ identity, kind: 'ready' });
    } catch (error) {
      if (!controller.signal.aborted) setConnection({
        identity,
        kind: 'error',
        message: safeProbeError(error, origin),
      });
    }
  };
  const isError = connection.kind === 'error';

  return (
    <div className={`mapbox-service-status${isError ? ' is-error' : ''}`} role={isError ? 'alert' : undefined}>
      <strong>{isError ? 'Mapbox connection failed' : 'Public token configured'}</strong>
      <p>{isError
        ? connection.message
        : `Verify that this browser origin (${origin}) is allowed before enabling provider services.`}</p>
      <button
        className="quiet-button"
        type="button"
        disabled={connection.kind === 'checking'}
        onClick={() => void checkConnection()}
        aria-label={connectionButtonLabel(connection)}
      >
        {connectionButtonText(connection)}
      </button>
    </div>
  );
}
