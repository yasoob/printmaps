import { MapboxProviderError } from './errors';

declare const publicBrowserTokenBrand: unique symbol;

export type PublicBrowserToken = string & { readonly [publicBrowserTokenBrand]: true };

export function validatePublicBrowserToken(token: string | null | undefined): PublicBrowserToken {
  const candidate = token?.trim();
  if (!candidate) {
    throw new MapboxProviderError(
      'TOKEN_MISSING',
      'Configure a public browser token (pk.) before making provider requests.',
    );
  }
  if (candidate.startsWith('sk.')) {
    throw new MapboxProviderError(
      'TOKEN_SECRET',
      'Secret Mapbox tokens (sk.) must never be used in a browser. Replace it with a least-scope public token (pk.).',
    );
  }
  if (!candidate.startsWith('pk.')) {
    throw new MapboxProviderError(
      'TOKEN_INVALID',
      'A browser token must start with "pk.". Configure a least-scope public token.',
    );
  }
  if (candidate !== token || !/^pk\.[\w-]+\.[\w-]+$/u.test(candidate)) {
    throw new MapboxProviderError(
      'TOKEN_INVALID',
      'A public browser token must contain exactly three dot-separated segments using URL-safe characters.',
    );
  }
  return candidate as PublicBrowserToken;
}
