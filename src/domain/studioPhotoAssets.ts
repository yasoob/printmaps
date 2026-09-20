import type { PhotoAsset } from './studio';
import { rasterImageDimensions } from './customMarkerAssets';
import { sha256Hex } from './sha256';
import { ProjectFileError } from './projectFileError';
import { studioEnum, studioId, studioNumber, studioObject } from './studioValidation';

export const MAX_PHOTO_ASSET_BYTES = 1024 * 1024;
export const MAX_PHOTO_ASSETS = 24;
export const MAX_PHOTO_STOPS = 24;
export const MAX_PHOTO_PROJECT_BYTES = 6 * 1024 * 1024;
export const MAX_PHOTO_EDGE_PIXELS = 2048;
export const MAX_PHOTO_PROJECT_PIXELS = 16 * 1024 * 1024;

function photoDimensions(mimeType: PhotoAsset['mimeType'], bytes: Uint8Array): [number, number] {
  try {
    return rasterImageDimensions(mimeType, bytes);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    throw new ProjectFileError(`Photo image data is invalid: ${error.message}`);
  }
}

export function parsePhotoAsset(value: unknown): PhotoAsset {
  const asset = studioObject(value, 'Photo asset', ['id', 'mimeType', 'width', 'height', 'dataUri']);
  const id = studioId(asset.id, 'Photo asset ID');
  if (!/^sha256-[\da-f]{64}$/.test(id)) throw new ProjectFileError('Photo asset IDs must be SHA-256 content hashes.');
  const mimeType = studioEnum(asset.mimeType, 'Photo format', ['image/png', 'image/jpeg']);
  const width = studioNumber(asset.width, 'Photo width', [1, MAX_PHOTO_EDGE_PIXELS], true);
  const height = studioNumber(asset.height, 'Photo height', [1, MAX_PHOTO_EDGE_PIXELS], true);
  const prefix = `data:${mimeType};base64,`;
  if (typeof asset.dataUri !== 'string' || !asset.dataUri.startsWith(prefix)
    || asset.dataUri.length > prefix.length + 4 * Math.ceil(MAX_PHOTO_ASSET_BYTES / 3)) {
    throw new ProjectFileError('Photo data must be an embedded PNG or JPEG of at most 1 MiB.');
  }
  const encoded = asset.dataUri.slice(prefix.length);
  if (!encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new ProjectFileError('Photo data must use valid base64.');
  }
  const bytes = Uint8Array.from(atob(encoded), (character) => character.codePointAt(0)!);
  if (bytes.length > MAX_PHOTO_ASSET_BYTES) throw new ProjectFileError('Photo image data exceeds the 1 MiB limit.');
  const [actualWidth, actualHeight] = photoDimensions(mimeType, bytes);
  if (actualWidth !== width || actualHeight !== height) throw new ProjectFileError('Photo dimensions do not match the raster image.');
  if (id !== `sha256-${sha256Hex(bytes)}`) throw new ProjectFileError('Photo content does not match its SHA-256 ID.');
  return { id, mimeType, width, height, dataUri: asset.dataUri };
}

export function parsePhotoAssets(value: unknown): Record<string, PhotoAsset> {
  const assets = studioObject(value, 'Photo assets');
  const entries = Object.entries(assets);
  if (entries.length > MAX_PHOTO_ASSETS) throw new ProjectFileError(`Projects may contain at most ${MAX_PHOTO_ASSETS} photo assets.`);
  let encodedBytes = 0, pixels = 0;
  const parsed = entries.map(([key, candidate]) => {
    const asset = parsePhotoAsset(candidate);
    if (asset.id !== key) throw new ProjectFileError('Photo asset keys must match their content IDs.');
    encodedBytes += asset.dataUri.length;
    pixels += asset.width * asset.height;
    return [key, asset] as const;
  });
  if (encodedBytes > MAX_PHOTO_PROJECT_BYTES) throw new ProjectFileError('Photo assets exceed the 6 MiB encoded project limit.');
  if (pixels > MAX_PHOTO_PROJECT_PIXELS) throw new ProjectFileError('Photo assets exceed the 16,777,216 decoded pixel project limit.');
  return Object.fromEntries(parsed);
}

export async function validatePhotoFile(file: File): Promise<PhotoAsset> {
  const mimeType = studioEnum(file.type, 'Photo format', ['image/png', 'image/jpeg']);
  if (file.size === 0 || file.size > MAX_PHOTO_ASSET_BYTES) throw new ProjectFileError('Photo files must be between 1 byte and 1 MiB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const [width, height] = photoDimensions(mimeType, bytes);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCodePoint(...bytes.subarray(offset, offset + 32_768));
  }
  return parsePhotoAsset({
    id: `sha256-${sha256Hex(bytes)}`, mimeType, width, height,
    dataUri: `data:${mimeType};base64,${btoa(binary)}`,
  });
}
