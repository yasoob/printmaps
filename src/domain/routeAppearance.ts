import { ROUTE_TRAVEL_MARKERS, type RouteTravelMarker } from './routeProfiles';

export const ROUTE_STROKE_STYLES = ['solid', 'dashed'] as const;
export const MIN_ROUTE_MARKER_REPEAT_SPACING = 0.01;
export const MAX_RENDERED_ROUTE_MARKERS = 100;
export type RouteStrokeStyle = typeof ROUTE_STROKE_STYLES[number];
export type RouteMarkerPlacement =
  | { type: 'center' }
  | { type: 'fraction'; fraction: number }
  | { type: 'repeat'; spacing: number };
export type RouteMarkerAppearance = {
  pictogram: RouteTravelMarker;
  placement: RouteMarkerPlacement;
  orientToPath: boolean;
  reverseFacing: boolean;
};
export type RouteSegmentStyleOverride = {
  color?: string;
  width?: number;
  strokeStyle?: RouteStrokeStyle;
};
export type ResolvedRouteSegmentStyle = {
  color: string;
  width: number;
  strokeStyle: RouteStrokeStyle;
};
export type RouteAppearance = {
  kind: 'route';
  color: string;
  width: number;
  strokeStyle: RouteStrokeStyle;
  marker: RouteMarkerAppearance | null;
  segmentStyles: (RouteSegmentStyleOverride | null)[];
};

type Fail = (message: string) => never;
type JsonObject = Record<string, unknown>;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function createDefaultRouteAppearance(semanticLegCount: number): RouteAppearance {
  return {
    kind: 'route',
    color: '#d9363e',
    width: 4,
    strokeStyle: 'solid',
    marker: null,
    segmentStyles: Array.from({ length: Math.max(0, semanticLegCount) }, () => null),
  };
}

export function canonicalRouteAppearance(appearance: RouteAppearance): RouteAppearance {
  return {
    ...appearance,
    color: appearance.color.toLowerCase(),
    marker: appearance.marker === null
      ? null
      : { ...appearance.marker, placement: { ...appearance.marker.placement } },
    segmentStyles: appearance.segmentStyles.map((override) => override === null
      ? null
      : { ...override, ...(override.color && { color: override.color.toLowerCase() }) }),
  };
}

function isMarkerPlacementValid(placement: RouteMarkerPlacement): boolean {
  if (placement.type === 'center') return true;
  if (placement.type === 'fraction') {
    return Number.isFinite(placement.fraction)
      && placement.fraction >= 0
      && placement.fraction <= 1;
  }
  return placement.type === 'repeat'
    && Number.isFinite(placement.spacing)
    && placement.spacing >= MIN_ROUTE_MARKER_REPEAT_SPACING
    && placement.spacing <= 1;
}

function isRouteMarkerValid(marker: RouteMarkerAppearance | null): boolean {
  if (marker === null) return true;
  return ROUTE_TRAVEL_MARKERS.includes(marker.pictogram)
    && typeof marker.orientToPath === 'boolean'
    && typeof marker.reverseFacing === 'boolean'
    && (marker.orientToPath || !marker.reverseFacing)
    && isMarkerPlacementValid(marker.placement);
}

function isSegmentStyleValid(override: RouteSegmentStyleOverride | null): boolean {
  if (override === null) return true;
  const keys = Object.keys(override);
  return keys.length > 0
    && keys.every((key) => ['color', 'width', 'strokeStyle'].includes(key))
    && (override.color === undefined || HEX_COLOR.test(override.color))
    && (override.width === undefined || (
      Number.isFinite(override.width) && override.width >= 1 && override.width <= 16
    ))
    && (override.strokeStyle === undefined || ROUTE_STROKE_STYLES.includes(override.strokeStyle));
}

export function isRouteAppearanceValid(appearance: RouteAppearance): boolean {
  return HEX_COLOR.test(appearance.color)
    && Number.isFinite(appearance.width)
    && appearance.width >= 1
    && appearance.width <= 16
    && ROUTE_STROKE_STYLES.includes(appearance.strokeStyle)
    && isRouteMarkerValid(appearance.marker)
    && appearance.segmentStyles.every((style) => isSegmentStyleValid(style));
}

function objectValue(value: unknown, label: string, fail: Fail): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${label} must be a JSON object.`);
  }
  return value as JsonObject;
}

function finiteValue(value: unknown, label: string, fail: Fail): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be a finite number.`);
  return value;
}

function colorValue(value: unknown, label: string, fail: Fail): string {
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
    fail(`${label} must be a six-digit hexadecimal color.`);
  }
  return value.toLowerCase();
}

function exactKeys(value: JsonObject, allowed: readonly string[], label: string, fail: Fail) {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpected) fail(`${label} contains unsupported field "${unexpected}".`);
}

function markerPlacementAt(value: unknown, label: string, fail: Fail): RouteMarkerPlacement {
  const placement = objectValue(value, `${label} placement`, fail);
  if (placement.type === 'center') {
    exactKeys(placement, ['type'], `${label} placement`, fail);
    return { type: 'center' };
  }
  if (placement.type === 'fraction') {
    exactKeys(placement, ['type', 'fraction'], `${label} placement`, fail);
    const fraction = finiteValue(placement.fraction, `${label} fraction`, fail);
    if (fraction < 0 || fraction > 1) fail(`${label} fraction must be between zero and one.`);
    return { type: 'fraction', fraction };
  }
  if (placement.type === 'repeat') {
    exactKeys(placement, ['type', 'spacing'], `${label} placement`, fail);
    const spacing = finiteValue(placement.spacing, `${label} repeat spacing`, fail);
    if (spacing < MIN_ROUTE_MARKER_REPEAT_SPACING || spacing > 1) {
      fail(`${label} repeat spacing must be at least ${MIN_ROUTE_MARKER_REPEAT_SPACING} and at most one.`);
    }
    return { type: 'repeat', spacing };
  }
  fail(`${label} placement must be center, fraction, or repeat.`);
}

function markerAt(value: unknown, label: string, fail: Fail): RouteMarkerAppearance | null {
  if (value === null) return null;
  const marker = objectValue(value, `${label} marker`, fail);
  exactKeys(marker, ['pictogram', 'placement', 'orientToPath', 'reverseFacing'], `${label} marker`, fail);
  if (!ROUTE_TRAVEL_MARKERS.includes(marker.pictogram as RouteTravelMarker)) {
    fail(`${label} marker pictogram is not supported.`);
  }
  if (typeof marker.orientToPath !== 'boolean' || typeof marker.reverseFacing !== 'boolean') {
    fail(`${label} marker orientation values must be true or false.`);
  }
  if (!marker.orientToPath && marker.reverseFacing) {
    fail(`${label} marker reverse-facing state requires path orientation.`);
  }
  return {
    pictogram: marker.pictogram as RouteTravelMarker,
    placement: markerPlacementAt(marker.placement, `${label} marker`, fail),
    orientToPath: marker.orientToPath,
    reverseFacing: marker.reverseFacing,
  };
}

function segmentStyleAt(value: unknown, label: string, fail: Fail): RouteSegmentStyleOverride | null {
  if (value === null) return null;
  const override = objectValue(value, label, fail);
  exactKeys(override, ['color', 'width', 'strokeStyle'], label, fail);
  if (Object.keys(override).length === 0) fail(`${label} must override at least one route style.`);
  const result: RouteSegmentStyleOverride = {};
  if (override.color !== undefined) result.color = colorValue(override.color, `${label} color`, fail);
  if (override.width !== undefined) {
    const width = finiteValue(override.width, `${label} width`, fail);
    if (width < 1 || width > 16) fail(`${label} width must be between 1 and 16 pixels.`);
    result.width = width;
  }
  if (override.strokeStyle !== undefined) {
    if (!ROUTE_STROKE_STYLES.includes(override.strokeStyle as RouteStrokeStyle)) {
      fail(`${label} stroke style must be solid or dashed.`);
    }
    result.strokeStyle = override.strokeStyle as RouteStrokeStyle;
  }
  return result;
}

export function parseRouteAppearance(
  value: unknown,
  label: string,
  fail: Fail,
  semanticLegCount?: number,
): RouteAppearance {
  const appearance = objectValue(value, `${label} appearance`, fail);
  if (appearance.kind !== 'route') fail(`${label} appearance must match its route layer type.`);
  exactKeys(
    appearance,
    ['kind', 'color', 'width', 'strokeStyle', 'marker', 'segmentStyles'],
    `${label} route appearance`,
    fail,
  );
  const width = finiteValue(appearance.width, `${label} route width`, fail);
  if (width < 1 || width > 16) fail(`${label} route width must be between 1 and 16 pixels.`);
  if (!ROUTE_STROKE_STYLES.includes(appearance.strokeStyle as RouteStrokeStyle)) {
    fail(`${label} route stroke style must be solid or dashed.`);
  }
  if (!Array.isArray(appearance.segmentStyles)) {
    fail(`${label} route segment styles must be an array.`);
  }
  if (semanticLegCount !== undefined && appearance.segmentStyles.length !== semanticLegCount) {
    fail(`${label} route needs exactly one segment style entry per semantic leg.`);
  }
  return {
    kind: 'route',
    color: colorValue(appearance.color, `${label} route color`, fail),
    width,
    strokeStyle: appearance.strokeStyle as RouteStrokeStyle,
    marker: markerAt(appearance.marker, label, fail),
    segmentStyles: appearance.segmentStyles.map((style, index) => (
      segmentStyleAt(style, `${label} route segment ${index + 1} style`, fail)
    )),
  };
}
