import { ROUTE_TRAVEL_PROFILES, type RouteTravelProfile } from './routeProfiles';
import {
  hasPoiLabelControlCharacter,
  isPoiLabelValid,
  MAX_POI_LABEL_CHARACTERS,
  POI_MARKER_SHAPES,
  POI_MARKER_SYMBOLS,
  type PoiMarkerShape,
  type PoiMarkerSymbol,
} from './poiMarkers';

export type RouteAppearance = {
  kind: 'route';
  color: string;
  width: number;
  travelProfile: RouteTravelProfile;
  showTravelModeIcon: boolean;
};
export type PoiAppearance = {
  kind: 'poi';
  color: string;
  size: number;
  markerShape: PoiMarkerShape;
  markerSymbol: PoiMarkerSymbol;
  label: string;
  customAssetId?: string | null;
};
export type ShapeAppearance = {
  kind: 'shape';
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  invert: boolean;
  label?: string;
};
export type LayerAppearance = RouteAppearance | PoiAppearance | ShapeAppearance;
export type AppearanceLayerType = LayerAppearance['kind'] | 'basemap';

type Fail = (message: string) => never;
type JsonObject = Record<string, unknown>;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function createDefaultLayerAppearance(type: AppearanceLayerType): LayerAppearance | undefined {
  if (type === 'route') {
    return {
      kind: 'route',
      color: '#d9363e',
      width: 4,
      travelProfile: 'car',
      showTravelModeIcon: false,
    };
  }
  if (type === 'poi') {
    return {
      kind: 'poi',
      color: '#0d78b5',
      size: 14,
      markerShape: 'circle',
      markerSymbol: 'none',
      label: '',
      customAssetId: null,
    };
  }
  if (type === 'shape') {
    return { kind: 'shape', fillColor: '#d18b25', strokeColor: '#d18b25', strokeWidth: 2, invert: false };
  }
  return;
}

function normalizedAppearance(appearance: LayerAppearance): LayerAppearance {
  if (appearance.kind === 'shape') {
    return {
      ...appearance,
      fillColor: appearance.fillColor.toLowerCase(),
      strokeColor: appearance.strokeColor.toLowerCase(),
    };
  }
  if (appearance.kind === 'poi') {
    return { ...appearance, color: appearance.color.toLowerCase(), customAssetId: appearance.customAssetId ?? null };
  }
  return { ...appearance, color: appearance.color.toLowerCase() };
}

function isRouteAppearanceValid(appearance: RouteAppearance): boolean {
  return HEX_COLOR.test(appearance.color)
    && Number.isFinite(appearance.width)
    && appearance.width >= 1
    && appearance.width <= 16
    && ROUTE_TRAVEL_PROFILES.includes(appearance.travelProfile)
    && typeof appearance.showTravelModeIcon === 'boolean';
}

function isPoiAppearanceValid(appearance: PoiAppearance): boolean {
  return HEX_COLOR.test(appearance.color)
    && Number.isFinite(appearance.size)
    && appearance.size >= 8
    && appearance.size <= 48
    && POI_MARKER_SHAPES.includes(appearance.markerShape)
    && POI_MARKER_SYMBOLS.includes(appearance.markerSymbol)
    && isPoiLabelValid(appearance.label)
    && (appearance.customAssetId == null || /^sha256-[0-9a-f]{64}$/.test(appearance.customAssetId));
}

function isShapeAppearanceValid(appearance: ShapeAppearance): boolean {
  return HEX_COLOR.test(appearance.fillColor)
    && HEX_COLOR.test(appearance.strokeColor)
    && Number.isFinite(appearance.strokeWidth)
    && appearance.strokeWidth >= 0.5
    && appearance.strokeWidth <= 12
    && typeof appearance.invert === 'boolean'
    && (appearance.label === undefined || (
      typeof appearance.label === 'string'
      && appearance.label.trim() === appearance.label
      && !hasPoiLabelControlCharacter(appearance.label)
      && [...appearance.label].length <= MAX_POI_LABEL_CHARACTERS
    ));
}

export function canonicalLayerAppearance(
  layerType: AppearanceLayerType,
  appearance: LayerAppearance,
): LayerAppearance | undefined {
  const normalized = normalizedAppearance(appearance);
  if (layerType !== normalized.kind) return;
  if (normalized.kind === 'route') {
    return isRouteAppearanceValid(normalized) ? normalized : undefined;
  }
  if (normalized.kind === 'poi') {
    return isPoiAppearanceValid(normalized) ? normalized : undefined;
  }
  return isShapeAppearanceValid(normalized) ? normalized : undefined;
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

function routeAppearanceAt(appearance: JsonObject, label: string, fail: Fail): RouteAppearance {
  const width = finiteValue(appearance.width, `${label} route width`, fail);
  if (width < 1 || width > 16) fail(`${label} route width must be between 1 and 16 pixels.`);
  if (!ROUTE_TRAVEL_PROFILES.includes(appearance.travelProfile as RouteTravelProfile)) {
    fail(`${label} route travel profile is not supported.`);
  }
  if (typeof appearance.showTravelModeIcon !== 'boolean') {
    fail(`${label} route travel-mode marker must be true or false.`);
  }
  return {
    kind: 'route',
    color: colorValue(appearance.color, `${label} route color`, fail),
    width,
    travelProfile: appearance.travelProfile as RouteTravelProfile,
    showTravelModeIcon: appearance.showTravelModeIcon,
  };
}

function poiAppearanceAt(appearance: JsonObject, label: string, fail: Fail): PoiAppearance {
  const size = finiteValue(appearance.size, `${label} POI marker size`, fail);
  if (size < 8 || size > 48) fail(`${label} POI marker size must be between 8 and 48 pixels.`);
  if (!POI_MARKER_SHAPES.includes(appearance.markerShape as PoiMarkerShape)) {
    fail(`${label} POI marker shape is not supported.`);
  }
  if (!POI_MARKER_SYMBOLS.includes(appearance.markerSymbol as PoiMarkerSymbol)) {
    fail(`${label} POI marker symbol is not supported.`);
  }
  if (typeof appearance.label !== 'string' || appearance.label.trim() !== appearance.label) {
    fail(`${label} POI label must be a trimmed string.`);
  }
  if (hasPoiLabelControlCharacter(appearance.label)) {
    fail(`${label} POI label may not contain control characters.`);
  }
  if ([...appearance.label].length > MAX_POI_LABEL_CHARACTERS) {
    fail(`${label} POI label must be ${MAX_POI_LABEL_CHARACTERS} characters or fewer.`);
  }
  if (appearance.customAssetId !== null
    && (typeof appearance.customAssetId !== 'string' || !/^sha256-[0-9a-f]{64}$/.test(appearance.customAssetId))) {
    fail(`${label} custom marker asset ID is invalid.`);
  }
  return {
    kind: 'poi',
    color: colorValue(appearance.color, `${label} POI color`, fail),
    size,
    markerShape: appearance.markerShape as PoiMarkerShape,
    markerSymbol: appearance.markerSymbol as PoiMarkerSymbol,
    label: appearance.label,
    customAssetId: appearance.customAssetId,
  };
}

function optionalShapeLabel(value: unknown, label: string, fail: Fail) {
  if (value === undefined) return {};
  if (typeof value !== 'string'
    || value.trim() !== value
    || hasPoiLabelControlCharacter(value)
    || [...value].length > MAX_POI_LABEL_CHARACTERS) {
    fail(`${label} shape label must be a trimmed text value of ${MAX_POI_LABEL_CHARACTERS} characters or fewer.`);
  }
  return { label: value };
}

export function parseLayerAppearance(
  value: unknown,
  type: AppearanceLayerType,
  label: string,
  fail: Fail,
): LayerAppearance | undefined {
  if (type === 'basemap') {
    if (value !== undefined) fail(`${label} basemap may not define content appearance.`);
    return;
  }
  const appearance = objectValue(value, `${label} appearance`, fail);
  if (appearance.kind !== type) fail(`${label} appearance must match its ${type} layer type.`);
  if (type === 'route') return routeAppearanceAt(appearance, label, fail);
  if (type === 'poi') return poiAppearanceAt(appearance, label, fail);
  const strokeWidth = finiteValue(appearance.strokeWidth, `${label} shape outline width`, fail);
  if (strokeWidth < 0.5 || strokeWidth > 12) {
    fail(`${label} shape outline width must be between 0.5 and 12 pixels.`);
  }
  if (typeof appearance.invert !== 'boolean') {
    fail(`${label} shape invert state must be true or false.`);
  }
  return {
    kind: 'shape',
    fillColor: colorValue(appearance.fillColor, `${label} shape fill color`, fail),
    strokeColor: colorValue(appearance.strokeColor, `${label} shape outline color`, fail),
    strokeWidth,
    invert: appearance.invert,
    ...optionalShapeLabel(appearance.label, label, fail),
  };
}
