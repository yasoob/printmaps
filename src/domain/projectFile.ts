import {
  PROJECT_SCHEMA_VERSION,
  type ContentLayer,
  type LayerGeometry,
  type LayerType,
  type MapLanguage,
  type MapStylePreset,
  type PageOrientation,
  type PagePreset,
  type ProjectDocument,
} from './project';
import { parseLayerGeometry } from './projectGeometry';
import { parseProjectCamera } from './projectCamera';
import { parseLayerAppearance, type LayerAppearance } from './layerAppearance';
import type { CustomMarkerAsset } from './customMarkerAssets';
import { parseProjectAssets } from './projectAssets';
import { MAP_STYLE_PRESETS as MAP_STYLE_PRESET_DEFINITIONS } from './mapStylePresets';
import { ProjectFileError } from './projectFileError';
import { parseLayerProvenance, validateProviderGeometry } from './projectProvenance';
import { PAGE_PRESET_DEFINITIONS, pagePresetDimensions } from './pagePresets';
import {
  routeLayerValidationError,
  parseRouteMetadata,
  semanticLegCount,
  semanticRoutePoints,
} from './routeModel';

export { ProjectFileError } from './projectFileError';

export const MAX_PROJECT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PROJECT_LAYERS = 1000;
export const MAX_PROJECT_COORDINATES = 200_000;
const LAYER_TYPES = new Set<LayerType>(['route', 'poi', 'shape', 'basemap']);
const PAGE_PRESETS = new Set<PagePreset>([
  ...PAGE_PRESET_DEFINITIONS.map(({ id }) => id),
  'Custom',
]);
const PAGE_ORIENTATIONS = new Set<PageOrientation>(['landscape', 'portrait']);
const MAP_STYLE_PRESETS = new Set<MapStylePreset>(MAP_STYLE_PRESET_DEFINITIONS.map(({ id }) => id));
const MAP_LANGUAGES = new Set<MapLanguage>(['local', 'en', 'de', 'fr', 'it', 'es', 'zh']);
type JsonObject = Record<string, unknown>;

function isCurrentSchemaVersion(value: unknown): value is ProjectDocument['schemaVersion'] {
  return value === PROJECT_SCHEMA_VERSION;
}

function objectAt(value: unknown, label: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProjectFileError(`${label} must be a JSON object.`);
  }
  return value as JsonObject;
}

function nonEmptyString(value: unknown, label: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ProjectFileError(`${label} must be a non-empty string.`);
  }
  if (value.length > 200) throw new ProjectFileError(`${label} must be 200 characters or fewer.`);
  return value;
}

function booleanAt(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new ProjectFileError(`${label} must be true or false.`);
  return value;
}

function finiteNumber(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ProjectFileError(`${label} must be a finite number.`);
  }
  return value;
}

function positiveNumber(value: unknown, label: string) {
  const number = finiteNumber(value, label);
  if (number <= 0) throw new ProjectFileError(`${label} must be a positive finite number.`);
  return number;
}

function geometryAt(value: unknown, label: string, coordinateCount: { value: number }): LayerGeometry {
  return parseLayerGeometry(value, label, coordinateCount, {
    maximumCoordinates: MAX_PROJECT_COORDINATES,
    fail: (message) => { throw new ProjectFileError(message); },
  });
}

function optionalAppearance(appearance: LayerAppearance | undefined) {
  return appearance ? { appearance } : {};
}

function layerAppearanceAt(
  layer: JsonObject,
  type: LayerType,
  index: number,
  context: Readonly<{
    assets: Record<string, CustomMarkerAsset>;
    semanticRouteLegCount?: number;
  }>,
): LayerAppearance | undefined {
  const appearance = parseLayerAppearance({
    value: layer.appearance,
    type,
    label: `Layer ${index + 1}`,
    fail: (message) => { throw new ProjectFileError(message); },
    semanticLegCount: context.semanticRouteLegCount,
  });
  if (appearance?.kind === 'poi'
    && appearance.customAssetId
    && !Object.hasOwn(context.assets, appearance.customAssetId)) {
    throw new ProjectFileError(`Layer ${index + 1} references a missing custom marker asset.`);
  }

  return appearance;
}

const EXPECTED_GEOMETRY = { poi: 'Point', basemap: null } as const;

function layerTypeAt(value: unknown, index: number): LayerType {
  if (typeof value !== 'string' || !LAYER_TYPES.has(value as LayerType)) {
    throw new ProjectFileError(`Layer ${index + 1} type is not supported.`);
  }
  return value as LayerType;
}

function layerOpacityAt(value: unknown, index: number): number {
  const opacity = finiteNumber(value, `Layer ${index + 1} opacity`);
  if (opacity < 0 || opacity > 100) {
    throw new ProjectFileError(`Layer ${index + 1} opacity must be between 0 and 100.`);
  }
  return opacity;
}

function isLayerGeometryAllowed(type: LayerType, geometry: LayerGeometry) {
  if (type === 'shape') return geometry.type === 'Polygon' || geometry.type === 'MultiPolygon';
  if (type === 'route') return geometry.type === 'LineString' || geometry.type === 'Arc';
  return geometry.type === EXPECTED_GEOMETRY[type];
}

function expectedGeometryLabel(type: LayerType) {
  if (type === 'shape') return 'Polygon or MultiPolygon';
  if (type === 'route') return 'LineString or Arc';
  return EXPECTED_GEOMETRY[type] ?? 'no';
}

function validatedLayerGeometry(
  value: unknown,
  type: LayerType,
  index: number,
  coordinateCount: { value: number },
): LayerGeometry | undefined {
  if (value === undefined) return;
  const geometry = geometryAt(value, `Layer ${index + 1}`, coordinateCount);
  if (isLayerGeometryAllowed(type, geometry)) return geometry;
  const layerLabel = type === 'poi' ? 'POI' : `${type[0].toUpperCase()}${type.slice(1)}`;
  throw new ProjectFileError(`${layerLabel} layers may only contain ${expectedGeometryLabel(type)} geometry.`);
}

function routeLegCountFor(layer: Pick<ContentLayer, 'type' | 'route' | 'geometry' | 'provenance'>) {
  const points = layer.route ? semanticRoutePoints(layer) : null;
  return points ? semanticLegCount(points) : undefined;
}

function validateParsedRoute(layer: ContentLayer, index: number) {
  if (layer.type !== 'route') return;
  const error = routeLayerValidationError(layer);
  if (error) throw new ProjectFileError(`Layer ${index + 1}: ${error}`);
}

function layerAt(
  candidate: unknown,
  index: number,
  context: Readonly<{
    ids: Set<string>;
    coordinateCount: { value: number };
    assets: Record<string, CustomMarkerAsset>;
  }>,
): ContentLayer {
  const layer = objectAt(candidate, `Layer ${index + 1}`);
  const id = nonEmptyString(layer.id, `Layer ${index + 1} ID`);
  if (context.ids.has(id)) throw new ProjectFileError('Layer IDs must be unique.');
  context.ids.add(id);
  const type = layerTypeAt(layer.type, index);
  const route = parseRouteMetadata(
    layer.route,
    type === 'route',
    `Layer ${index + 1}`,
    (message) => { throw new ProjectFileError(message); },
  );
  const geometry = validatedLayerGeometry(layer.geometry, type, index, context.coordinateCount);
  const provenance = parseLayerProvenance(layer.provenance, type, index, context.coordinateCount);
  validateProviderGeometry(provenance, geometry, (message) => {
    throw new ProjectFileError(message);
  });
  const routeLegCount = routeLegCountFor({ type, route, geometry, provenance });
  const appearance = layerAppearanceAt(layer, type, index, {
    assets: context.assets,
    semanticRouteLegCount: routeLegCount,
  });
  const parsed: ContentLayer = {
    id,
    name: nonEmptyString(layer.name, `Layer ${index + 1} name`),
    type,
    visible: booleanAt(layer.visible, `Layer ${index + 1} visibility`),
    locked: booleanAt(layer.locked, `Layer ${index + 1} lock state`),
    opacity: layerOpacityAt(layer.opacity, index),
    ...(route && { route }),
    ...optionalAppearance(appearance),
    ...(geometry && { geometry }),
    ...(provenance && { provenance }),
  };
  validateParsedRoute(parsed, index);
  return parsed;
}

function layersAt(value: unknown, assets: Record<string, CustomMarkerAsset>) {
  if (!Array.isArray(value)) throw new ProjectFileError('Project layers must be an array.');
  if (value.length > MAX_PROJECT_LAYERS) throw new ProjectFileError(`Projects may contain at most ${MAX_PROJECT_LAYERS} layers.`);
  const context = { ids: new Set<string>(), coordinateCount: { value: 0 }, assets };
  return value.map((candidate, index) => layerAt(candidate, index, context));
}

function pageAt(value: unknown): ProjectDocument['page'] {
  const page = objectAt(value, 'Project page');
  const orientation = page.orientation;
  if (typeof orientation !== 'string' || !PAGE_ORIENTATIONS.has(orientation as PageOrientation)) {
    throw new ProjectFileError('Page orientation must be landscape or portrait.');
  }
  const base = {
    widthMm: positiveNumber(page.widthMm, 'Page width'),
    heightMm: positiveNumber(page.heightMm, 'Page height'),
    orientation: orientation as PageOrientation,
  };
  const presetValue = page.preset;
  if (typeof presetValue !== 'string' || !PAGE_PRESETS.has(presetValue as PagePreset)) {
    throw new ProjectFileError('Page preset must be A2, A3, A4, A5, A6, US Letter, or Custom.');
  }
  const preset = presetValue as PagePreset;
  if (preset !== 'Custom') {
    const [longEdge, shortEdge] = pagePresetDimensions(preset);
    const expectedWidth = orientation === 'landscape' ? longEdge : shortEdge;
    const expectedHeight = orientation === 'landscape' ? shortEdge : longEdge;
    if (base.widthMm !== expectedWidth || base.heightMm !== expectedHeight) {
      throw new ProjectFileError(
        `${preset} page dimensions must be ${expectedWidth} × ${expectedHeight} mm in ${orientation}.`,
      );
    }
  }
  return { preset, ...base };
}

function styleAt(value: unknown): ProjectDocument['style'] {
  const style = objectAt(value, 'Project style');
  if (typeof style.preset !== 'string' || !MAP_STYLE_PRESETS.has(style.preset as MapStylePreset)) {
    throw new ProjectFileError('Map style preset is not supported by this version of Print Map Studio.');
  }
  const preset = style.preset as MapStylePreset;
  if (typeof style.language !== 'string' || !MAP_LANGUAGES.has(style.language as MapLanguage)) {
    throw new ProjectFileError('Map language must be local, en, de, fr, it, es, or zh.');
  }
  const textScalePercent = finiteNumber(style.textScalePercent, 'Map text scale');
  if (textScalePercent < 50 || textScalePercent > 200) {
    throw new ProjectFileError('Map text scale must be between 50 and 200 percent.');
  }
  const visibility = objectAt(style.visibility, 'Map feature visibility');
  return {
    preset,
    language: style.language as MapLanguage,
    textScalePercent,
    visibility: {
      roads: booleanAt(visibility.roads, 'Map road visibility'),
      buildings: booleanAt(visibility.buildings, 'Map building visibility'), labels: booleanAt(visibility.labels, 'Map label visibility'),
      water: booleanAt(visibility.water, 'Map water visibility'), parks: booleanAt(visibility.parks, 'Map park visibility'),
      landuse: booleanAt(visibility.landuse, 'Map land-detail visibility'), transit: booleanAt(visibility.transit, 'Map transit visibility'),
    },
  };
}

function currentDocumentAt(value: unknown): ProjectDocument {
  const root = objectAt(value, 'Project file');
  const schemaVersion = root.schemaVersion;
  if (!isCurrentSchemaVersion(schemaVersion)) {
    if (typeof schemaVersion === 'number' && schemaVersion >= 1 && schemaVersion < PROJECT_SCHEMA_VERSION) {
      throw new ProjectFileError(
        `Schema version ${schemaVersion} is obsolete. Start a new project or reopen a current Print Map Studio file.`,
      );
    }
    const displayed = typeof schemaVersion === 'number' || typeof schemaVersion === 'string'
      ? String(schemaVersion)
      : 'missing';
    throw new ProjectFileError(`Schema version ${displayed} is not supported.`);
  }
  const assets = parseProjectAssets(root.assets, (message) => { throw new ProjectFileError(message); });
  const layers = layersAt(root.layers, assets);
  const referencedAssets = new Set(layers.flatMap(({ appearance }) => (
    appearance?.kind === 'poi' && appearance.customAssetId ? [appearance.customAssetId] : []
  )));
  for (const assetId of Object.keys(assets)) {
    if (!referencedAssets.has(assetId)) {
      throw new ProjectFileError(`Custom marker asset ${assetId} is not referenced by a POI layer.`);
    }
  }
  const common = {
    id: nonEmptyString(root.id, 'Project ID'),
    title: nonEmptyString(root.title, 'Project title'),
    assets,
    layers,
  };
  return {
    schemaVersion,
    ...common,
    page: pageAt(root.page),
    camera: parseProjectCamera(root.camera, (message) => { throw new ProjectFileError(message); }),
    style: styleAt(root.style),
  } satisfies ProjectDocument;
}

export function parseProjectFileText(text: string): ProjectDocument {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new ProjectFileError('This file is not valid JSON.');
  }
  return currentDocumentAt(value);
}
