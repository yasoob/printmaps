export type RouteAppearance = { kind: 'route'; color: string; width: number };
export type PoiAppearance = { kind: 'poi'; color: string; size: number };
export type ShapeAppearance = {
  kind: 'shape';
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
};
export type LayerAppearance = RouteAppearance | PoiAppearance | ShapeAppearance;
export type AppearanceLayerType = LayerAppearance['kind'] | 'basemap';

type Fail = (message: string) => never;
type JsonObject = Record<string, unknown>;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function createDefaultLayerAppearance(type: AppearanceLayerType): LayerAppearance | undefined {
  if (type === 'route') return { kind: 'route', color: '#d9363e', width: 4 };
  if (type === 'poi') return { kind: 'poi', color: '#0d78b5', size: 14 };
  if (type === 'shape') {
    return { kind: 'shape', fillColor: '#d18b25', strokeColor: '#d18b25', strokeWidth: 2 };
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
  return { ...appearance, color: appearance.color.toLowerCase() };
}

function isRouteAppearanceValid(appearance: RouteAppearance): boolean {
  return HEX_COLOR.test(appearance.color)
    && Number.isFinite(appearance.width)
    && appearance.width >= 1
    && appearance.width <= 16;
}

function isPoiAppearanceValid(appearance: PoiAppearance): boolean {
  return HEX_COLOR.test(appearance.color)
    && Number.isFinite(appearance.size)
    && appearance.size >= 8
    && appearance.size <= 48;
}

function isShapeAppearanceValid(appearance: ShapeAppearance): boolean {
  return HEX_COLOR.test(appearance.fillColor)
    && HEX_COLOR.test(appearance.strokeColor)
    && Number.isFinite(appearance.strokeWidth)
    && appearance.strokeWidth >= 0.5
    && appearance.strokeWidth <= 12;
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
  if (type === 'route') {
    const width = finiteValue(appearance.width, `${label} route width`, fail);
    if (width < 1 || width > 16) fail(`${label} route width must be between 1 and 16 pixels.`);
    return { kind: 'route', color: colorValue(appearance.color, `${label} route color`, fail), width };
  }
  if (type === 'poi') {
    const size = finiteValue(appearance.size, `${label} POI marker size`, fail);
    if (size < 8 || size > 48) fail(`${label} POI marker size must be between 8 and 48 pixels.`);
    return { kind: 'poi', color: colorValue(appearance.color, `${label} POI color`, fail), size };
  }
  const strokeWidth = finiteValue(appearance.strokeWidth, `${label} shape outline width`, fail);
  if (strokeWidth < 0.5 || strokeWidth > 12) {
    fail(`${label} shape outline width must be between 0.5 and 12 pixels.`);
  }
  return {
    kind: 'shape',
    fillColor: colorValue(appearance.fillColor, `${label} shape fill color`, fail),
    strokeColor: colorValue(appearance.strokeColor, `${label} shape outline color`, fail),
    strokeWidth,
  };
}
