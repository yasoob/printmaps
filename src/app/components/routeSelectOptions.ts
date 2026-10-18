import type { SimpleSelectOption } from '@/components/ui/select';
import {
  ROAD_TRAVEL_MODES,
  ROAD_TRAVEL_MODE_LABELS,
  ROUTE_TRAVEL_MARKERS,
  ROUTE_TRAVEL_MARKER_LABELS,
  type RoadTravelMode,
  type RouteTravelMarker,
} from '../../domain/routeProfiles';

// Module constants keep memoized SimpleSelects stable across tool-card and inspector renders.
export const ROAD_TRAVEL_MODE_OPTIONS: readonly SimpleSelectOption<RoadTravelMode>[] = ROAD_TRAVEL_MODES.map(
  (mode) => ({ value: mode, label: ROAD_TRAVEL_MODE_LABELS[mode] }),
);

export const TRAVEL_MARKER_OPTIONS: readonly SimpleSelectOption<RouteTravelMarker | 'none'>[] = [
  { value: 'none', label: 'None' },
  ...ROUTE_TRAVEL_MARKERS.map((marker) => ({ value: marker, label: ROUTE_TRAVEL_MARKER_LABELS[marker] })),
];

export const LINE_STYLE_OPTIONS: readonly SimpleSelectOption<'solid' | 'dashed'>[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
];
