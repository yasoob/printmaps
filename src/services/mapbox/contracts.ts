import type { ProviderBoundResponse } from './terms';

export type ProviderCoordinate = readonly [longitude: number, latitude: number];
export type ProviderTravelProfile = 'driving' | 'cycling' | 'walking';

export interface ProviderRequestControl {
  readonly signal?: AbortSignal;
}

export interface SearchRequest extends ProviderRequestControl {
  readonly autocomplete?: boolean;
  readonly query: string;
  readonly limit?: number;
  readonly proximity?: ProviderCoordinate;
}

export interface SearchResult {
  readonly providerFeatureId: string;
  readonly label: string;
  readonly center: ProviderCoordinate;
}

export interface SearchResponse extends ProviderBoundResponse {
  readonly results: readonly SearchResult[];
}

export interface SearchProvider {
  search(request: SearchRequest): Promise<SearchResponse>;
}

export interface IsochroneRequest extends ProviderRequestControl {
  readonly center: ProviderCoordinate;
  readonly minutes: number;
  readonly profile: ProviderTravelProfile;
}

export interface IsochroneResponse extends ProviderBoundResponse {
  readonly geometry: {
    readonly type: 'Polygon';
    readonly coordinates: readonly (readonly ProviderCoordinate[])[];
  };
}

export interface IsochroneProvider {
  isochrone(request: IsochroneRequest): Promise<IsochroneResponse>;
}

export interface DirectionsRequest extends ProviderRequestControl {
  readonly waypoints: readonly ProviderCoordinate[];
  readonly profile: ProviderTravelProfile;
}

export interface ProviderRoute {
  readonly geometry: readonly ProviderCoordinate[];
  readonly distanceMeters: number;
  readonly durationSeconds: number;
}

export interface DirectionsResponse extends ProviderBoundResponse {
  readonly routes: readonly ProviderRoute[];
}

export interface DirectionsProvider {
  directions(request: DirectionsRequest): Promise<DirectionsResponse>;
}

export interface MapMatchingRequest extends ProviderRequestControl {
  readonly trace: readonly ProviderCoordinate[];
  readonly profile: ProviderTravelProfile;
}

export interface ProviderMatch {
  readonly geometry: readonly ProviderCoordinate[];
  readonly confidence?: number;
}

export interface MapMatchingResponse extends ProviderBoundResponse {
  readonly matches: readonly ProviderMatch[];
}

export interface MapMatchingProvider {
  match(request: MapMatchingRequest): Promise<MapMatchingResponse>;
}
