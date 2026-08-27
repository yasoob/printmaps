import type { AdministrativeArea, AdministrativeAreaId, AdministrativeCountryCode } from '../../domain/administrativeAreas';
import type { GeneratedAdministrativeIndex } from '../../domain/generatedAdministrativeCatalogue';

export type RegionPickerState = Readonly<{
  catalogue: GeneratedAdministrativeIndex | null;
  countryCode: AdministrativeCountryCode;
  error: string;
  loaded: { countryCode: string; regions: readonly AdministrativeArea[] } | null;
  loadStatus: Readonly<{ countryCode?: string; text: string }>;
  query: string;
  selectedIds: AdministrativeAreaId[];
}>;

export type RegionPickerAction =
  | Readonly<{ type: 'catalogue-loaded'; catalogue: GeneratedAdministrativeIndex }>
  | Readonly<{ type: 'catalogue-unavailable'; message: string }>
  | Readonly<{ type: 'country-changed'; countryCode: AdministrativeCountryCode; countryName: string }>
  | Readonly<{ type: 'shard-loaded'; countryCode: string; regions: readonly AdministrativeArea[]; message: string }>
  | Readonly<{ type: 'shard-unavailable'; countryCode: string; message: string }>
  | Readonly<{ type: 'query-changed'; query: string }>
  | Readonly<{ type: 'selection-changed'; id: AdministrativeAreaId; isChecked: boolean }>
  | Readonly<{ type: 'merge-failed'; message: string }>;

export const INITIAL_REGION_PICKER_STATE: RegionPickerState = {
  catalogue: null,
  countryCode: 'AUT',
  error: '',
  loaded: null,
  loadStatus: { text: 'Loading worldwide region catalogue…' },
  query: '',
  selectedIds: [],
};

export function reduceRegionPicker(state: RegionPickerState, action: RegionPickerAction): RegionPickerState {
  if (action.type === 'catalogue-loaded') return { ...state, catalogue: action.catalogue };
  if (action.type === 'catalogue-unavailable') {
    return { ...state, loadStatus: { text: action.message } };
  }
  if (action.type === 'country-changed') {
    return {
      ...state,
      countryCode: action.countryCode,
      error: '',
      loaded: null,
      loadStatus: { countryCode: action.countryCode, text: `Loading ${action.countryName} boundaries…` },
      query: '',
      selectedIds: [],
    };
  }
  if (action.type === 'shard-loaded') {
    if (action.countryCode !== state.countryCode) return state;
    return {
      ...state,
      loaded: { countryCode: action.countryCode, regions: action.regions },
      loadStatus: { countryCode: action.countryCode, text: action.message },
    };
  }
  if (action.type === 'shard-unavailable') {
    if (action.countryCode !== state.countryCode) return state;
    return { ...state, loadStatus: { countryCode: action.countryCode, text: action.message } };
  }
  if (action.type === 'query-changed') return { ...state, query: action.query };
  if (action.type === 'merge-failed') return { ...state, error: action.message };
  const selectedIds = action.isChecked
    ? [...state.selectedIds, action.id]
    : state.selectedIds.filter((candidate) => candidate !== action.id);
  return { ...state, error: '', selectedIds };
}
