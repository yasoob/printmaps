export type MapboxProviderErrorCode =
  | 'TOKEN_MISSING'
  | 'TOKEN_SECRET'
  | 'TOKEN_INVALID'
  | 'ENDPOINT_INVALID'
  | 'REQUEST_ABORTED'
  | 'NETWORK_OFFLINE'
  | 'NETWORK_ERROR'
  | 'HTTP_UNAUTHORIZED'
  | 'HTTP_FORBIDDEN'
  | 'HTTP_UNPROCESSABLE'
  | 'HTTP_RATE_LIMITED'
  | 'HTTP_SERVER'
  | 'HTTP_ERROR'
  | 'RESPONSE_INVALID';

export class MapboxProviderError extends Error {
  readonly code: MapboxProviderErrorCode;
  readonly retryAfterSeconds?: number;
  readonly status?: number;

  constructor(
    code: MapboxProviderErrorCode,
    message: string,
    options: { cause?: unknown; retryAfterSeconds?: number; status?: number } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'MapboxProviderError';
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.status = options.status;
  }
}

function retryAfterSeconds(response: Response): number | undefined {
  const header = response.headers.get('Retry-After');
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : undefined;
}

export function createMapboxHttpError(response: Response): MapboxProviderError {
  const status = response.status;
  if (status === 401) {
    return new MapboxProviderError(
      'HTTP_UNAUTHORIZED',
      'Mapbox rejected the credentials. Check the public token and replace it if it was revoked.',
      { status },
    );
  }
  if (status === 403) {
    return new MapboxProviderError(
      'HTTP_FORBIDDEN',
      'Mapbox denied this request. Check token scopes and URL restrictions.',
      { status },
    );
  }
  if (status === 422) {
    return new MapboxProviderError(
      'HTTP_UNPROCESSABLE',
      'Mapbox could not process this input. Review the request coordinates and parameters.',
      { status },
    );
  }
  if (status === 429) {
    return new MapboxProviderError(
      'HTTP_RATE_LIMITED',
      'Mapbox rate-limited this client. Wait before retrying the request.',
      { retryAfterSeconds: retryAfterSeconds(response), status },
    );
  }
  if (status >= 500) {
    return new MapboxProviderError(
      'HTTP_SERVER',
      'Mapbox is temporarily unavailable. Try again later.',
      { status },
    );
  }
  return new MapboxProviderError(
    'HTTP_ERROR',
    `Mapbox returned HTTP ${status}. Review the request and try again.`,
    { status },
  );
}
