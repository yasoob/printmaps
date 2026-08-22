import {
  migrateProjectDocument,
  type ContentLayer,
  type LayerGeometry,
  type LayerType,
  type MapStylePreset,
  type PageOrientation,
  type PagePreset,
  type ProjectDocument,
  type ProjectDocumentV1,
  type ProjectDocumentV2,
  type ProjectDocumentV3,
  type ProjectDocumentV4,
  type ProjectDocumentV5,
  type ProjectDocumentV6,
  type StoredProjectDocument,
} from './project';

export const MAX_PROJECT_FILE_BYTES = 10 * 1024 * 1024;
const MAX_LAYERS = 1000;
const MAX_COORDINATES = 200_000;
const LAYER_TYPES = new Set<LayerType>(['route', 'poi', 'shape', 'basemap']);
const PAGE_PRESETS = new Set<PagePreset>(['A4', 'A3', 'Letter', 'Custom']);
const PAGE_ORIENTATIONS = new Set<PageOrientation>(['landscape', 'portrait']);
const MAP_STYLE_PRESETS = new Set<MapStylePreset>(['liberty', 'positron']);
const SUPPORTED_SCHEMA_VERSIONS = new Set([1, 2, 3, 4, 5, 6, 7]);

type JsonObject = Record<string, unknown>;

function isSupportedSchemaVersion(value: unknown): value is StoredProjectDocument['schemaVersion'] {
  return typeof value === 'number' && SUPPORTED_SCHEMA_VERSIONS.has(value);
}

export class ProjectFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectFileError';
  }
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

function positionAt(value: unknown, label: string, coordinateCount: { value: number }): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new ProjectFileError(`${label} must contain exactly longitude and latitude.`);
  }
  const longitude = finiteNumber(value[0], `${label} longitude`);
  const latitude = finiteNumber(value[1], `${label} latitude`);
  if (Math.abs(longitude) > 180) {
    throw new ProjectFileError(`${label} longitude must be between -180 and 180.`);
  }
  if (Math.abs(latitude) > 90) {
    throw new ProjectFileError(`${label} latitude must be between -90 and 90.`);
  }
  coordinateCount.value += 1;
  if (coordinateCount.value > MAX_COORDINATES) {
    throw new ProjectFileError(`Projects may contain at most ${MAX_COORDINATES.toLocaleString()} positions.`);
  }
  return [longitude, latitude];
}

function geometryAt(value: unknown, label: string, coordinateCount: { value: number }): LayerGeometry {
  const geometry = objectAt(value, `${label} geometry`);
  if (geometry.type === 'Point') {
    return { type: 'Point', coordinates: positionAt(geometry.coordinates, `${label} Point`, coordinateCount) };
  }
  if (geometry.type === 'LineString') {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) {
      throw new ProjectFileError('LineString geometry needs at least two positions.');
    }
    return {
      type: 'LineString',
      coordinates: geometry.coordinates.map((position, index) => (
        positionAt(position, `${label} LineString position ${index + 1}`, coordinateCount)
      )),
    };
  }
  if (geometry.type === 'Polygon') {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      throw new ProjectFileError('Polygon geometry needs at least one ring.');
    }
    const coordinates = geometry.coordinates.map((candidateRing, ringIndex) => {
      if (!Array.isArray(candidateRing) || candidateRing.length < 4) {
        throw new ProjectFileError('Each Polygon ring needs at least four positions.');
      }
      const ring = candidateRing.map((position, positionIndex) => positionAt(
        position,
        `${label} Polygon ring ${ringIndex + 1} position ${positionIndex + 1}`,
        coordinateCount,
      ));
      const first = ring[0];
      const last = ring.at(-1);
      if (!last || first[0] !== last[0] || first[1] !== last[1]) {
        throw new ProjectFileError('Each Polygon ring must end at its starting position.');
      }
      return ring;
    });
    return { type: 'Polygon', coordinates };
  }
  throw new ProjectFileError(`${label} geometry type must be Point, LineString, or Polygon.`);
}

function layersAt(value: unknown) {
  if (!Array.isArray(value)) throw new ProjectFileError('Project layers must be an array.');
  if (value.length > MAX_LAYERS) throw new ProjectFileError(`Projects may contain at most ${MAX_LAYERS} layers.`);
  const ids = new Set<string>();
  const coordinateCount = { value: 0 };
  return value.map((candidate, index): ContentLayer => {
    const layer = objectAt(candidate, `Layer ${index + 1}`);
    const id = nonEmptyString(layer.id, `Layer ${index + 1} ID`);
    if (ids.has(id)) throw new ProjectFileError('Layer IDs must be unique.');
    ids.add(id);
    if (typeof layer.type !== 'string' || !LAYER_TYPES.has(layer.type as LayerType)) {
      throw new ProjectFileError(`Layer ${index + 1} type is not supported.`);
    }
    const opacity = finiteNumber(layer.opacity, `Layer ${index + 1} opacity`);
    if (opacity < 0 || opacity > 100) {
      throw new ProjectFileError(`Layer ${index + 1} opacity must be between 0 and 100.`);
    }
    const type = layer.type as LayerType;
    const geometry = layer.geometry === undefined
      ? undefined
      : geometryAt(layer.geometry, `Layer ${index + 1}`, coordinateCount);
    const expectedGeometry = {
      route: 'LineString',
      poi: 'Point',
      shape: 'Polygon',
      basemap: null,
    } as const;
    if (geometry && geometry.type !== expectedGeometry[type]) {
      const layerLabel = type === 'poi' ? 'POI' : `${type[0].toUpperCase()}${type.slice(1)}`;
      const expectedLabel = expectedGeometry[type] ?? 'no';
      throw new ProjectFileError(`${layerLabel} layers may only contain ${expectedLabel} geometry.`);
    }
    return {
      id,
      name: nonEmptyString(layer.name, `Layer ${index + 1} name`),
      type,
      visible: booleanAt(layer.visible, `Layer ${index + 1} visibility`),
      locked: booleanAt(layer.locked, `Layer ${index + 1} lock state`),
      opacity,
      ...(geometry && { geometry }),
    };
  });
}

function pageAt(value: unknown, shouldIncludePreset: false): ProjectDocumentV2['page'];
function pageAt(value: unknown, shouldIncludePreset: true): ProjectDocument['page'];
function pageAt(
  value: unknown,
  shouldIncludePreset: boolean,
): ProjectDocumentV2['page'] | ProjectDocument['page'] {
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
  if (!shouldIncludePreset) return base;
  if (typeof page.preset !== 'string' || !PAGE_PRESETS.has(page.preset as PagePreset)) {
    throw new ProjectFileError('Page preset must be A4, A3, Letter, or Custom.');
  }
  const preset = page.preset as PagePreset;
  if (preset !== 'Custom') {
    const presetEdges = {
      A4: [297, 210],
      A3: [420, 297],
      Letter: [279.4, 215.9],
    } as const;
    const [longEdge, shortEdge] = presetEdges[preset];
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

function cameraAt(value: unknown): ProjectDocument['camera'] {
  const camera = objectAt(value, 'Project camera');
  const bearing = finiteNumber(camera.bearing, 'Camera bearing');
  if (Math.abs(bearing) > 180) {
    throw new ProjectFileError('Camera bearing must be between -180 and 180.');
  }
  const pitch = finiteNumber(camera.pitch, 'Camera pitch');
  if (pitch < 0 || pitch > 60) {
    throw new ProjectFileError('Camera pitch must be between 0 and 60.');
  }
  return { bearing, pitch };
}

function styleAt(value: unknown, schemaVersion: 5): ProjectDocumentV5['style'];
function styleAt(value: unknown, schemaVersion: 6): ProjectDocumentV6['style'];
function styleAt(value: unknown, schemaVersion: 7): ProjectDocument['style'];
function styleAt(value: unknown, schemaVersion: 5 | 6 | 7): ProjectDocumentV5['style'] | ProjectDocumentV6['style'] | ProjectDocument['style'] {
  const style = objectAt(value, 'Project style');
  if (typeof style.preset !== 'string' || !MAP_STYLE_PRESETS.has(style.preset as MapStylePreset)) {
    throw new ProjectFileError('Map style preset must be liberty or positron.');
  }
  const preset = style.preset as MapStylePreset;
  if (schemaVersion === 5) return { preset };
  const textScalePercent = finiteNumber(style.textScalePercent, 'Map text scale');
  if (textScalePercent < 50 || textScalePercent > 200) {
    throw new ProjectFileError('Map text scale must be between 50 and 200 percent.');
  }
  if (schemaVersion === 6) return { preset, textScalePercent };
  const visibility = objectAt(style.visibility, 'Map feature visibility');
  return {
    preset,
    textScalePercent,
    visibility: {
      roads: booleanAt(visibility.roads, 'Map road visibility'),
      buildings: booleanAt(visibility.buildings, 'Map building visibility'),
      labels: booleanAt(visibility.labels, 'Map label visibility'),
    },
  };
}

function storedDocumentAt(value: unknown): StoredProjectDocument {
  const root = objectAt(value, 'Project file');
  const schemaVersion = root.schemaVersion;
  if (!isSupportedSchemaVersion(schemaVersion)) {
    const displayed = typeof schemaVersion === 'number' || typeof schemaVersion === 'string'
      ? String(schemaVersion)
      : 'missing';
    throw new ProjectFileError(`Schema version ${displayed} is not supported.`);
  }
  const common = {
    id: nonEmptyString(root.id, 'Project ID'),
    title: nonEmptyString(root.title, 'Project title'),
    layers: layersAt(root.layers),
  };
  if (schemaVersion === 1) return { schemaVersion, ...common } satisfies ProjectDocumentV1;
  if (schemaVersion === 2) {
    return { schemaVersion, ...common, page: pageAt(root.page, false) } satisfies ProjectDocumentV2;
  }
  const page = pageAt(root.page, true);
  if (schemaVersion === 3) return { schemaVersion, ...common, page } satisfies ProjectDocumentV3;
  const camera = cameraAt(root.camera);
  if (schemaVersion === 4) return { schemaVersion, ...common, page, camera } satisfies ProjectDocumentV4;
  if (schemaVersion === 5) {
    return { schemaVersion, ...common, page, camera, style: styleAt(root.style, 5) } satisfies ProjectDocumentV5;
  }
  if (schemaVersion === 6) {
    return { schemaVersion, ...common, page, camera, style: styleAt(root.style, 6) } satisfies ProjectDocumentV6;
  }
  return {
    schemaVersion,
    ...common,
    page,
    camera,
    style: styleAt(root.style, 7),
  } satisfies ProjectDocument;
}

export function parseProjectFileText(text: string): ProjectDocument {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new ProjectFileError('This file is not valid JSON.');
  }
  return migrateProjectDocument(storedDocumentAt(value));
}
