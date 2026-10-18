import { ROUTE_TRAVEL_MARKERS, ROUTE_TRAVEL_MARKER_LABELS, type RouteTravelMarker } from "../../domain/routeProfiles";

// Shared, referentially stable option lists for memoized route selects.
export const LINE_STYLE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
] as const;
export const TRAVEL_MARKER_OPTIONS: readonly { value: RouteTravelMarker | "none"; label: string }[] = [
  { value: "none", label: "None" },
  ...ROUTE_TRAVEL_MARKERS.map((marker) => ({ value: marker, label: ROUTE_TRAVEL_MARKER_LABELS[marker] })),
];

