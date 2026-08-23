import {
  validateCustomMarkerAssetCollection,
  validateStoredCustomMarkerAsset,
  type CustomMarkerAsset,
  type CustomMarkerMimeType,
} from './customMarkerAssets';

type Fail = (message: string) => never;
type JsonObject = Record<string, unknown>;
const MIME_TYPES = new Set<CustomMarkerMimeType>(['image/png', 'image/jpeg', 'image/svg+xml']);

function objectValue(value: unknown, label: string, fail: Fail): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${label} must be a JSON object.`);
  return value as JsonObject;
}

function finiteNumber(value: unknown, label: string, fail: Fail): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be a finite number.`);
  return value;
}

function dimensions(asset: JsonObject, key: string, fail: Fail) {
  const width = finiteNumber(asset.width, `Custom marker asset ${key} width`, fail);
  const height = finiteNumber(asset.height, `Custom marker asset ${key} height`, fail);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 100 || height < 100 || width > 2048 || height > 2048) {
    fail('Custom marker asset dimensions must be integers from 100 through 2048 pixels.');
  }
  return { height, width };
}

function dataUri(asset: JsonObject, mimeType: CustomMarkerMimeType, fail: Fail): string {
  if (typeof asset.dataUri !== 'string' || !asset.dataUri.startsWith(`data:${mimeType};base64,`)
    || asset.dataUri.length > 1_500_000) {
    fail('Custom marker asset data must be a bounded embedded base64 image.');
  }
  return asset.dataUri;
}

function customMarkerAsset(key: string, candidate: unknown, fail: Fail): CustomMarkerAsset {
  if (!/^sha256-[0-9a-f]{64}$/.test(key)) fail('Each custom marker asset key must be a SHA-256 ID.');
  const asset = objectValue(candidate, `Custom marker asset ${key}`, fail);
  if (asset.id !== key) fail('Each custom marker asset key must match its SHA-256 ID.');
  if (!MIME_TYPES.has(asset.mimeType as CustomMarkerMimeType)) fail('Custom marker assets must be PNG, JPEG, or SVG images.');
  const mimeType = asset.mimeType as CustomMarkerMimeType;
  const canonical = { id: key, mimeType, ...dimensions(asset, key, fail), dataUri: dataUri(asset, mimeType, fail) };
  try {
    validateStoredCustomMarkerAsset(canonical);
  } catch (error) {
    fail(error instanceof Error ? error.message : 'Custom marker asset data is invalid.');
  }
  return canonical;
}

export function parseProjectAssets(value: unknown, fail: Fail): Record<string, CustomMarkerAsset> {
  const assets = objectValue(value, 'Project assets', fail);
  if (Object.keys(assets).length > 1000) fail('Projects may contain at most 1,000 custom marker assets.');
  const parsed = Object.fromEntries(Object.entries(assets).map(([key, candidate]) => [
    key,
    customMarkerAsset(key, candidate, fail),
  ]));
  try {
    validateCustomMarkerAssetCollection(parsed);
  } catch (error) {
    fail(error instanceof Error ? error.message : 'Custom marker asset collection is invalid.');
  }
  return parsed;
}
