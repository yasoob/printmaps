import type { ContentLayer } from '../domain/project';
import {
  MAX_PROJECT_COORDINATES,
  MAX_PROJECT_LAYERS,
} from '../domain/projectFile';
import {
  MAX_GEOJSON_FILE_BYTES,
  parseGeoJsonText,
} from './geojson';
import {
  MAX_GPX_KML_FILE_BYTES,
  parseGpxText,
  parseKmlText,
} from './gpxKml';

export const MAX_MAP_DATA_FILES = 10;
export const MAX_MAP_DATA_BATCH_BYTES = 20 * 1024 * 1024;

type MapDataImporter = {
  format: 'GeoJSON' | 'GPX' | 'KML';
  maxBytes: number;
  parse: (text: string, options: { existingLayerIds: Iterable<string> }) => ContentLayer[];
};

export type MapDataFileSummary = Readonly<{
  format: MapDataImporter['format'];
  layerCount: number;
  name: string;
}>;

export type ParsedMapDataBatch = Readonly<{
  files: readonly MapDataFileSummary[];
  layers: readonly ContentLayer[];
}>;

function parseRequiredGeoJson(text: string, options: { existingLayerIds: Iterable<string> }) {
  const layers = parseGeoJsonText(text, options);
  if (layers.length === 0) {
    throw new Error('GeoJSON must contain at least one supported Point, LineString, or Polygon feature.');
  }
  return layers;
}

function importerForFilename(filename: string): MapDataImporter {
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith('.geojson')) {
    return { format: 'GeoJSON', maxBytes: MAX_GEOJSON_FILE_BYTES, parse: parseRequiredGeoJson };
  }
  if (lowerName.endsWith('.gpx')) {
    return { format: 'GPX', maxBytes: MAX_GPX_KML_FILE_BYTES, parse: parseGpxText };
  }
  if (lowerName.endsWith('.kml')) {
    return { format: 'KML', maxBytes: MAX_GPX_KML_FILE_BYTES, parse: parseKmlText };
  }
  throw new Error(`${filename}: choose a GeoJSON, GPX, or KML file with the matching filename suffix.`);
}

function geometryPositionCount(layer: ContentLayer): number {
  const geometry = layer.geometry;
  if (!geometry) return 0;
  if (geometry.type === 'Point') return 1;
  if (geometry.type === 'LineString') return geometry.coordinates.length;
  return geometry.coordinates.reduce((total, ring) => total + ring.length, 0);
}

function preflightMapDataFile(file: File) {
  const importer = importerForFilename(file.name);
  if (file.size > importer.maxBytes) {
    throw new Error(`${file.name}: ${importer.format} files must be 5 MB or smaller.`);
  }
  return { file, importer };
}

function uniqueImportedLayers(parsedLayers: readonly ContentLayer[], usedIds: Set<string>) {
  return parsedLayers.map((layer) => {
    let id = layer.id;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${layer.id}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    return id === layer.id ? layer : { ...layer, id };
  });
}

function settledTexts(results: readonly PromiseSettledResult<string>[]) {
  const texts: string[] = [];
  for (const result of results) {
    if (result.status === 'rejected') throw result.reason;
    texts.push(result.value);
  }
  return texts;
}

export async function parseMapDataFiles(
  files: readonly File[],
  existingLayers: readonly ContentLayer[],
): Promise<ParsedMapDataBatch> {
  if (files.length === 0) throw new Error('Choose at least one GeoJSON, GPX, or KML file.');
  if (files.length > MAX_MAP_DATA_FILES) {
    throw new Error(`Import at most ${MAX_MAP_DATA_FILES} map-data files at once.`);
  }
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > MAX_MAP_DATA_BATCH_BYTES) {
    throw new Error('A map-data batch must be 20 MB or smaller.');
  }

  const preparedFiles = files.map((file) => preflightMapDataFile(file));
  const texts = settledTexts(await Promise.allSettled(
    preparedFiles.map(({ file }) => file.text()),
  ));
  const usedIds = new Set(existingLayers.map(({ id }) => id));
  const layers: ContentLayer[] = [];
  let positionCount = existingLayers.reduce(
    (total, layer) => total + geometryPositionCount(layer),
    0,
  );
  const parsedFiles = preparedFiles.map(({ file, importer }, index) => {
    const fileLayers = uniqueImportedLayers(
      importer.parse(texts[index], { existingLayerIds: usedIds }),
      usedIds,
    );
    if (existingLayers.length + layers.length + fileLayers.length > MAX_PROJECT_LAYERS) {
      throw new Error(`Projects may contain at most ${MAX_PROJECT_LAYERS} layers.`);
    }
    positionCount += fileLayers.reduce(
      (total, layer) => total + geometryPositionCount(layer),
      0,
    );
    if (positionCount > MAX_PROJECT_COORDINATES) {
      throw new Error(`Projects may contain at most ${MAX_PROJECT_COORDINATES.toLocaleString()} positions.`);
    }
    layers.push(...fileLayers);
    return {
      summary: { format: importer.format, layerCount: fileLayers.length, name: file.name } satisfies MapDataFileSummary,
    };
  });

  return { files: parsedFiles.map(({ summary }) => summary), layers };
}
