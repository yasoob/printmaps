import type { LayerGeometry } from './project';

// Generated catalogue IDs are runtime-validated so world coverage does not become a compiler-heavy union.
export type AdministrativeCountryCode = string;
export type AdministrativeAreaId = string;

export type AdministrativeArea = Readonly<{
  countryCode: AdministrativeCountryCode;
  id: AdministrativeAreaId;
  name: string;
  level: 'country' | 'region';
  source: string;
  geometry: Extract<LayerGeometry, { type: 'Polygon' | 'MultiPolygon' }>;
}>;
