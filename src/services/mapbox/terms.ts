export const PROVIDER_RESPONSE_USE_REQUIRES_TERMS_REVIEW =
  'provider-response-use-requires-terms-review' as const;

export const PROVIDER_RESPONSE_USE_BOUNDARY = Object.freeze({
  attribution: 'follow-provider-attribution-requirements',
  storage: 'do-not-persist-without-provider-terms-review',
} as const);

export type ProviderResponseUseBoundary = typeof PROVIDER_RESPONSE_USE_REQUIRES_TERMS_REVIEW;

export interface ProviderBoundResponse {
  readonly useBoundary: ProviderResponseUseBoundary;
}
